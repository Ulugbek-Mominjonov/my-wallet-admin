-- E34-T01, T02: limitlar v2 — ota-kategoriya limiti (BR-132, hisobot yadrosida
-- allaqachon `actual_total` bo'yicha) va rollover (BR-134).
--
-- Rollover: shu oy amaldagi limiti = limit + o'tgan oy qoldig'i. Qoldiq
-- musbat bo'lsa `rollover` bilan, manfiy (oshib ketgan) bo'lsa qo'shimcha
-- `rollover_negative` bilan qo'llanadi. Zanjir emas — faqat bitta oldingi oy
-- (hisob oddiy va bashorat qilinadigan bo'lsin).

alter table public.category_limits
  add column rollover boolean not null default false,
  add column rollover_negative boolean not null default false;

comment on column public.category_limits.rollover is
  'BR-134: o''tgan oydan qolgan limit shu oyga qo''shiladi.';
comment on column public.category_limits.rollover_negative is
  'BR-134: o''tgan oyda oshib ketgan summa shu oy limitidan ayiriladi.';

grant insert (rollover, rollover_negative), update (rollover, rollover_negative)
  on public.category_limits to authenticated;

-- O'tgan oy qoldig'i (limit − fakt) — faqat `rollover` yoqilgan limitlarda.
-- Fakt ota-kategoriyada subkategoriyalar bilan (BR-132).
create or replace function private.limit_carry(p_household uuid, p_month date)
returns table (category_id uuid, carry bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  with prev as (
    select l.category_id, sum(l.amount)::bigint as actual
      from private.budget_lines(p_household,
                                (p_month - interval '1 month')::date,
                                (p_month - interval '1 month')::date) l
     where l.line in ('expense', 'allocation')
     group by l.category_id
  ),
  totals as (
    select li.category_id, li.amount, li.rollover_negative,
           coalesce((select sum(p.actual) from prev p
                       join public.categories cc on cc.id = p.category_id
                      where cc.id = li.category_id or cc.parent_id = li.category_id), 0)::bigint
             as actual_total
      from public.category_limits li
     where li.household_id = p_household and li.deleted_at is null and li.rollover
  )
  select t.category_id, (t.amount - t.actual_total)::bigint
    from totals t
   where t.amount > t.actual_total or t.rollover_negative
$$;

comment on function private.limit_carry(uuid, date) is
  'BR-134: o''tgan oydan o''tadigan limit qoldig''i (musbat yoki manfiy).';

grant execute on function private.limit_carry(uuid, date) to authenticated;

-- ─── Amaldagi limit hisobotlarda va ogohlantirishlarda ─────────────────────

create or replace function public.report_month(p_household uuid, p_month public.month_start)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_today date;
  v_current date;
  v_first date;
  v_days integer := extract(day from (p_month + interval '1 month' - interval '1 day'))::integer;
  v_elapsed integer;
  v_m record;
  v_income_plans integer;
  v_income_pending bigint;
  v_expected bigint;
  v_month_end_spend bigint;
  v_result jsonb;
begin
  if p_household not in (select private.my_household_ids()) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  v_today := private.household_today(p_household);
  v_current := date_trunc('month', v_today::timestamp)::date;
  v_first := least(coalesce(private.first_record_month(p_household), p_month), p_month);

  -- Bitta o'tish: shu oy yig'indilari + barcha oylar (birinchi yozuvdan) bo'yicha
  -- jamg'arma (BR-102) va boshqa oylar o'rtacha daromadi (BR-093).
  with f as materialized (
    select * from private.month_facts(p_household, v_first, greatest(p_month, v_current))
  )
  select m.*,
         a.before_balance, a.months_count, a.total_income
    into v_m
    from f m
    cross join (
      select coalesce(sum(x.income - x.expense) filter (where x.month < p_month), 0)::bigint as before_balance,
             (count(*) filter (where x.has_records))::integer as months_count,
             coalesce(sum(x.income), 0)::bigint as total_income
        from f x
    ) a
   where m.month = p_month;

  -- BR-093: kutilayotgan daromad — rejalar bo'lsa kelgan + kelmaganlar qoldig'i,
  -- aks holda joriy oyda max(kelgan, boshqa oylar o'rtachasi); o'tgan oy — kelgan.
  select count(*), coalesce(sum(p.planned_amount - p.paid_amount) filter (where p.settled_at is null), 0)
    into v_income_plans, v_income_pending
    from public.planned_items p
   where p.household_id = p_household and p.budget_month = p_month and p.kind = 'income'
     and p.deleted_at is null and p.skipped_at is null;
  v_elapsed := case
    when p_month < v_current then v_days
    when p_month = v_current then least(extract(day from v_today)::integer, v_days)
    else 0
  end;
  v_expected := case
    when p_month < v_current then v_m.income
    when v_income_plans > 0 then v_m.income + v_income_pending
    else greatest(
      v_m.income,
      case when v_m.months_count - (case when v_m.has_records then 1 else 0 end) > 0
           then round((v_m.total_income - v_m.income)::numeric
                      / (v_m.months_count - (case when v_m.has_records then 1 else 0 end)))::bigint
           else 0 end
    )
  end;
  v_month_end_spend := case
    when p_month = v_current and v_elapsed > 0 then round(v_m.expense::numeric * v_days / v_elapsed)::bigint
    else v_m.expense
  end;

  with lines as materialized (
    select l.line, l.method, l.category_id, l.amount
      from private.budget_lines(p_household, p_month, p_month) l
  ),
  actual as (
    select l.category_id, sum(l.amount)::bigint as actual
      from lines l
     where l.line in ('expense', 'allocation')
     group by l.category_id
  ),
  planned as (
    select coalesce(p.category_id, sys.id) as category_id, sum(coalesce(p.planned_amount, 0))::bigint as planned
      from public.planned_items p
      left join public.categories sys
        on sys.household_id = p.household_id and sys.system_code = 'personal_allocation' and p.kind = 'allocation'
     where p.household_id = p_household and p.budget_month = p_month
       and p.deleted_at is null and p.skipped_at is null and p.kind <> 'income'
     group by coalesce(p.category_id, sys.id)
  ),
  carry as materialized (
    select * from private.limit_carry(p_household, p_month)
  ),
  categories as (
    select c.id, c.name, c.parent_id, c.sort_order,
           coalesce(pl.planned, 0) as planned,
           coalesce(ac.actual, 0) as actual,
           li.amount as limit_base,
           -- BR-134: o'tgan oy qoldig'i qo'shiladi; amaldagi limit manfiy bo'lmaydi.
           case when li.amount is not null
                then greatest(li.amount + coalesce(ca.carry, 0), 0) end as limit_amount
      from public.categories c
      left join planned pl on pl.category_id = c.id
      left join actual ac on ac.category_id = c.id
      left join public.category_limits li
        on li.household_id = c.household_id and li.category_id = c.id and li.deleted_at is null
      left join carry ca on ca.category_id = c.id
     where c.household_id = p_household and c.kind = 'expense' and c.deleted_at is null
  ),
  -- BR-132: ota-kategoriya fakti (limit uchun) = o'zi + subkategoriyalari.
  category_totals as (
    select c.*, c.actual + coalesce((select sum(ch.actual) from categories ch where ch.parent_id = c.id), 0)::bigint
             as actual_total
      from categories c
  )
  select jsonb_build_object(
    'month', p_month,
    'closed', exists (
      select 1 from public.months mo
       where mo.household_id = p_household and mo.month = p_month and mo.closed_at is not null
    ),
    'is_current', p_month = v_current,
    'totals', jsonb_build_object(
      'income', v_m.income, 'income_card', v_m.income_card, 'income_cash', v_m.income_cash,
      'expense', v_m.expense, 'expense_card', v_m.expense_card, 'expense_cash', v_m.expense_cash,
      'planned', v_m.planned, 'unpaid', v_m.unpaid, 'unknown_count', v_m.unknown_count,
      'allocated', v_m.allocated, 'fund_spent', v_m.fund_spent
    ),
    'derived', private.month_derived(v_m.income, v_m.expense, v_m.unpaid, v_m.allocated, v_m.fund_spent, v_m.planned)
               || jsonb_build_object('card', v_m.income_card - v_m.expense_card,
                                     'cash', v_m.income_cash - v_m.expense_cash),
    'projection', jsonb_build_object(
      'days_in_month', v_days,
      'days_elapsed', v_elapsed,
      'daily_spend', case when v_elapsed > 0 then round(v_m.expense::numeric / v_elapsed)::bigint else 0 end,
      'month_end_spend', v_month_end_spend,
      'income_received', v_m.income,
      'income_expected', v_expected,
      'income_pending', v_expected > v_m.income,
      'month_end_balance', v_expected - v_month_end_spend,
      -- BR-094: faqat joriy oy; bugun ham qolgan kunlarga kiradi.
      'per_day_available', case when p_month = v_current then
        greatest(0, v_expected - v_m.expense - v_m.unpaid)
          / (v_days - extract(day from v_today)::integer + 1)
      end
    ),
    'by_type', coalesce((
      select jsonb_agg(jsonb_build_object('category_id', x.category_id, 'name', c.name,
                                          'card', x.card, 'cash', x.cash) order by c.sort_order, c.name)
        from (
          select l.category_id,
                 coalesce(sum(l.amount) filter (where l.method = 'card'), 0)::bigint as card,
                 coalesce(sum(l.amount) filter (where l.method = 'cash'), 0)::bigint as cash
            from lines l
           where l.line = 'income'
           group by l.category_id
        ) x
        join public.categories c on c.id = x.category_id
    ), '[]'::jsonb),
    'by_category', coalesce((
      select jsonb_agg(jsonb_build_object(
               'category_id', k.id, 'name', k.name, 'parent_id', k.parent_id,
               'planned', k.planned, 'actual', k.actual,
               'actual_total', k.actual_total, 'limit', k.limit_amount,
               'limit_carry', k.limit_amount - k.limit_base,
               'limit_ratio', case when k.limit_amount > 0 then round(k.actual_total::numeric / k.limit_amount, 4) end,
               'limit_status', private.limit_status(k.actual_total, k.limit_amount)
             ) order by k.sort_order, k.name)
        from category_totals k
       where k.planned <> 0 or k.actual_total <> 0 or k.limit_base is not null
    ), '[]'::jsonb),
    'unpaid', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id, 'kind', p.kind, 'name', p.name, 'category_id', p.category_id,
               'planned_amount', p.planned_amount, 'paid_amount', p.paid_amount, 'due_date', p.due_date,
               'auto_pay', p.auto_pay, 'status', private.planned_status(p, v_today)
             ) order by p.due_date, p.name)
        from public.planned_items p
       where p.household_id = p_household and p.budget_month = p_month
         and p.deleted_at is null and p.skipped_at is null and p.settled_at is null
    ), '[]'::jsonb),
    'fund', jsonb_build_object(
      'allocated', v_m.allocated,
      'spent', v_m.fund_spent,
      'balance', (
        select private.account_balance(a.id) from public.accounts a
         where a.household_id = p_household and a.type = 'personal_fund'
      )
    ),
    -- BR-102: oldingi oylardan to'plangan, shu oy qoldig'i, shu oygacha jami.
    'savings', jsonb_build_object(
      'before', v_m.before_balance,
      'this_month', v_m.income - v_m.expense,
      'total', v_m.before_balance + v_m.income - v_m.expense
    ),
    -- BR-114/BR-194: jamlar asosiy valyutadagi ekvivalentda (E29-T03).
    'debts', private.debt_totals(p_household) || jsonb_build_object(
      'paid_this_month', (
        select coalesce(sum(t.amount_base), 0) from public.transactions t
         where t.household_id = p_household and t.budget_month = p_month
           and t.debt_id is not null and t.deleted_at is null
      )
    ),
    'goals', coalesce((
      select jsonb_agg(jsonb_build_object('goal_id', g.id, 'name', g.name, 'saved', gp.saved,
                                          'remaining', gp.remaining, 'progress', gp.progress)
                       order by g.sort_order, g.name)
        from public.goal_progress gp
        join public.goals g on g.id = gp.goal_id
       where gp.household_id = p_household and g.achieved_at is null
    ), '[]'::jsonb)
  )
    into v_result;
  return v_result;
end;
$$;

-- Joriy oy xarajatlari o'zgarganda: limitli kategoriyalar (ota — bolalari
-- bilan, BR-132) 80% / 100% ga yetgan bo'lsa — yoqilgan (`alert_80`,
-- `alert_100`) eng katta chegara bo'yicha, oyda har chegara uchun bir marta.
create or replace function private.enqueue_limit_alerts(p_households uuid[])
returns void
language sql
security definer
set search_path = ''
as $$
  with hh as (
    select h.id, date_trunc('month', private.household_today(h.id)::timestamp)::date as month
      from public.households h
     where h.id = any (p_households)
       and exists (select 1 from public.category_limits l where l.household_id = h.id and l.deleted_at is null)
  ),
  lines as (
    select hh.id as household_id, hh.month, l.category_id, sum(l.amount)::bigint as actual
      from hh
      cross join lateral private.budget_lines(hh.id, hh.month, hh.month) l
     where l.line in ('expense', 'allocation')
     group by hh.id, hh.month, l.category_id
  ),
  carry as (
    select hh.id as household_id, ca.category_id, ca.carry
      from hh
      cross join lateral private.limit_carry(hh.id, hh.month) ca
  ),
  status as (
    select li.household_id, hh.month, c.id as category_id, c.name,
           -- BR-134: amaldagi limit — o'tgan oy qoldig'i bilan (manfiy bo'lmaydi).
           greatest(li.amount + coalesce((select ca.carry from carry ca
                                           where ca.household_id = li.household_id
                                             and ca.category_id = li.category_id), 0), 0) as limit_amount,
           li.alert_80, li.alert_100,
           coalesce((select sum(x.actual) from lines x
                      join public.categories cc on cc.id = x.category_id
                     where x.household_id = li.household_id and (cc.id = c.id or cc.parent_id = c.id)), 0)::bigint
             as actual_total
      from public.category_limits li
      join hh on hh.id = li.household_id
      join public.categories c on c.id = li.category_id
     where li.deleted_at is null
  ),
  crossed as (
    select s.*, (select max(th.pct) from (values (80, s.alert_80), (100, s.alert_100)) as th (pct, enabled)
                  where th.enabled and s.actual_total * 100 >= s.limit_amount * th.pct) as threshold
      from status s
  )
  insert into public.notification_outbox (user_id, household_id, channel, type, payload, dedupe_key)
  select t.user_id, t.household_id, t.channel, 'limit_alert',
         jsonb_build_object('locale', t.locale, 'category', x.name, 'limit', x.limit_amount,
                            'actual', x.actual_total, 'threshold', x.threshold, 'month', x.month),
         format('limit_alert:%s:%s:%s:%s:%s:%s', x.household_id, x.category_id, x.month, x.threshold, t.user_id, t.channel)
    from crossed x
    join private.notification_targets t on t.household_id = x.household_id and t.limit_alerts
   where x.threshold is not null
  on conflict (dedupe_key) do nothing
$$;

create or replace function private.monthly_report_payload(p_household uuid, p_month date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with f as (
    select * from private.month_facts(
      p_household, least(coalesce(private.first_record_month(p_household), p_month), p_month), p_month)
  ),
  m as (select * from f where f.month = p_month),
  other as (
    select avg(f.income) as avg_income from f where f.month < p_month and f.has_records
  ),
  lines as (
    select l.category_id, sum(l.amount)::bigint as actual
      from private.budget_lines(p_household, p_month, p_month) l
     where l.line in ('expense', 'allocation')
     group by l.category_id
  ),
  carry as (
    select * from private.limit_carry(p_household, p_month)
  ),
  totals as (
    select c.id, c.name, c.sort_order,
           coalesce(la.actual, 0) + coalesce((
             select sum(lc.actual) from lines lc join public.categories cc on cc.id = lc.category_id
              where cc.parent_id = c.id
           ), 0)::bigint as actual_total,
           -- BR-134: amaldagi limit — o'tgan oy qoldig'i bilan.
           case when li.amount is not null
                then greatest(li.amount + coalesce(ca.carry, 0), 0) end as limit_amount
      from public.categories c
      left join lines la on la.category_id = c.id
      left join public.category_limits li on li.category_id = c.id and li.household_id = c.household_id and li.deleted_at is null
      left join carry ca on ca.category_id = c.id
     where c.household_id = p_household and c.kind = 'expense'
  )
  select jsonb_build_object(
           'month', p_month,
           'income', m.income, 'expense', m.expense, 'balance', m.income - m.expense,
           'saved', m.income - m.expense + m.allocated - m.fund_spent,
           'saved_ratio', case when m.income > 0
                               then round((m.income - m.expense + m.allocated - m.fund_spent)::numeric / m.income, 4)
                               else 0 end,
           'fund_balance', (select private.account_balance(a.id) from public.accounts a
                             where a.household_id = p_household and a.type = 'personal_fund'),
           'savings_total', (select coalesce(sum(x.income - x.expense), 0) from f x),
           'debts_remaining', ((private.debt_totals(p_household) ->> 'i_owe')::bigint),
           'top_categories', coalesce((
             select jsonb_agg(jsonb_build_object('name', c.name, 'actual', l.actual) order by l.actual desc)
               from (select * from lines order by actual desc limit private.report_top_categories()) l
               join public.categories c on c.id = l.category_id
           ), '[]'::jsonb),
           'limits_exceeded', coalesce((
             select jsonb_agg(jsonb_build_object('name', t.name, 'actual', t.actual_total, 'limit', t.limit_amount)
                              order by t.sort_order, t.name)
               from totals t where t.limit_amount is not null and t.actual_total > t.limit_amount
           ), '[]'::jsonb),
           -- BR-162: boshqa oylar bo'lsa va daromad ularning 60% idan kam bo'lsa.
           'suspicious', coalesce((select m.income < o.avg_income * private.suspicious_income_ratio() from other o), false)
         )
    from m
$$;
