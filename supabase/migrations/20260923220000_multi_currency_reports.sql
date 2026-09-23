-- E29-T03 (BR-191, BR-194): ko'p valyutali qoldiqlar hisobotlarda.
--
-- Qoldiq o'z valyutasida qoladi (BR-021), yoniga asosiy valyutadagi
-- ekvivalent qo'shiladi — joriy kurs bilan (kurs yo'q bo'lsa `null`).
-- Jamlar endi shu ekvivalentdan: avval boshqa valyutadagi qarzlar
-- umuman hisobga olinmasdi.

create or replace view public.account_balances with (security_invoker = true) as
select a.household_id,
       a.id as account_id,
       v.balance,
       private.to_base_amount(v.balance, a.currency, h.base_currency,
                              private.fx_rate(a.currency, h.base_currency,
                                              private.household_today(a.household_id))) as balance_base
  from public.accounts a
  join public.households h on h.id = a.household_id
  cross join lateral (select private.account_balance(a.id) as balance) v
 where a.deleted_at is null;

comment on view public.account_balances is
  'BR-021: hisob qoldig''i (hisob valyutasida) va asosiy valyutadagi ekvivalenti (BR-194).';

create or replace view public.debt_balances with (security_invoker = true) as
select d.household_id,
       d.id as debt_id,
       t.paid as paid_in_app,
       p.pending as pending_amount,
       p.pending_count,
       r.remaining,
       least(1, (d.paid_before + t.paid)::numeric / d.total) as progress,
       s.months_left,
       (date_trunc('month', private.household_today(d.household_id)::timestamp)
         + make_interval(months => s.months_left))::date as end_month,
       case
         when r.remaining = 0 then 'closed'
         when t.payments > 0 then 'paying'
         when p.pending_count > 0 then 'pending'
         else 'unlinked'
       end as status,
       private.to_base_amount(r.remaining, d.currency, h.base_currency,
                              private.fx_rate(d.currency, h.base_currency,
                                              private.household_today(d.household_id))) as remaining_base,
       private.to_base_amount(d.monthly_payment, d.currency, h.base_currency,
                              private.fx_rate(d.currency, h.base_currency,
                                              private.household_today(d.household_id))) as monthly_base
  from public.debts d
  join public.households h on h.id = d.household_id
  cross join lateral (
    select coalesce(sum(x.amount), 0)::bigint as paid, count(*) as payments
      from public.transactions x
     where x.debt_id = d.id and x.deleted_at is null
  ) t
  cross join lateral (
    select coalesce(sum(greatest(0, y.planned_amount - y.paid_amount)), 0)::bigint as pending,
           count(*) as pending_count
      from public.planned_items y
     where y.household_id = d.household_id and y.debt_id = d.id and y.deleted_at is null
       and y.settled_at is null and y.skipped_at is null
  ) p
  cross join lateral (select greatest(0, d.total - d.paid_before - t.paid) as remaining) r
  cross join lateral (
    select case when r.remaining > 0 and d.monthly_payment > 0
                then ceil(r.remaining::numeric / d.monthly_payment)::integer end as months_left
  ) s
 where d.deleted_at is null;

comment on view public.debt_balances is
  'BR-112..116: qarz qoldig''i va holati; `*_base` — asosiy valyutadagi ekvivalent (BR-194).';

-- ─── Hisobotlarda jamlar: asosiy valyutadagi ekvivalent bo'yicha ───────────
-- Kursi yo'q qarz jamga kirmaydi (0 deb hisoblash noto'g'ri bo'lardi) —
-- `remaining_base` null bo'ladi va `sum` uni o'tkazib yuboradi.
create or replace function public.report_debts(p_household uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_current date;
  v_result jsonb;
begin
  if p_household not in (select private.my_household_ids()) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  v_current := date_trunc('month', private.household_today(p_household)::timestamp)::date;

  select jsonb_build_object(
           'debts', coalesce(jsonb_agg(jsonb_build_object(
             'debt_id', d.id, 'name', d.name, 'direction', d.direction, 'currency', d.currency,
             'total', d.total, 'paid_before', d.paid_before, 'monthly_payment', d.monthly_payment,
             'due_date', d.due_date, 'archived', d.archived_at is not null,
             'paid_in_app', b.paid_in_app, 'pending_amount', b.pending_amount,
             'pending_count', b.pending_count,
             'remaining', b.remaining, 'remaining_base', b.remaining_base,
             'progress', round(b.progress, 4), 'months_left', b.months_left,
             'end_month', b.end_month, 'status', b.status
           ) order by d.archived_at nulls first, d.name), '[]'::jsonb),
           -- BR-114/BR-194: jamlar — asosiy valyutadagi ekvivalentda,
           -- arxivlanmagan qarzlar bo'yicha.
           'totals', jsonb_build_object(
             'i_owe', coalesce(sum(b.remaining_base) filter (
               where d.direction = 'i_owe' and d.archived_at is null), 0),
             'owed_to_me', coalesce(sum(b.remaining_base) filter (
               where d.direction = 'owed_to_me' and d.archived_at is null), 0),
             'monthly_obligation', coalesce(sum(b.monthly_base) filter (
               where d.direction = 'i_owe' and b.remaining > 0 and d.archived_at is null), 0),
             'net', coalesce(sum(b.remaining_base) filter (
                      where d.direction = 'owed_to_me' and d.archived_at is null), 0)
                    - coalesce(sum(b.remaining_base) filter (
                      where d.direction = 'i_owe' and d.archived_at is null), 0),
             'paid_this_month', (
               select coalesce(sum(t.amount_base), 0) from public.transactions t
                where t.household_id = p_household and t.budget_month = v_current
                  and t.debt_id is not null and t.deleted_at is null
             )
           )
         )
    into v_result
    from public.debt_balances b
    join public.debts d on d.id = b.debt_id
   where b.household_id = p_household;
  return v_result;
end;
$$;

-- Oylik hisobotdagi (BR-161) va oylik xulosadagi (BR-114) qarz jamlari ham
-- asosiy valyutadagi ekvivalentda.
create or replace function private.debt_totals(p_household uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
           'i_owe', coalesce(sum(b.remaining_base) filter (where d.direction = 'i_owe'), 0),
           'owed_to_me', coalesce(sum(b.remaining_base) filter (where d.direction = 'owed_to_me'), 0),
           'monthly_obligation', coalesce(sum(b.monthly_base) filter (
             where d.direction = 'i_owe' and b.remaining > 0), 0),
           'net', coalesce(sum(b.remaining_base) filter (where d.direction = 'owed_to_me'), 0)
                  - coalesce(sum(b.remaining_base) filter (where d.direction = 'i_owe'), 0))
    from public.debt_balances b
    join public.debts d on d.id = b.debt_id
   where b.household_id = p_household and d.archived_at is null
$$;

grant execute on function private.debt_totals(uuid) to authenticated;

-- Oylik hisobot: qarz jamlari umumiy yordamchidan (qolgan qismi o'zgarmadi).
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
  categories as (
    select c.id, c.name, c.parent_id, c.sort_order,
           coalesce(pl.planned, 0) as planned,
           coalesce(ac.actual, 0) as actual,
           li.amount as limit_amount
      from public.categories c
      left join planned pl on pl.category_id = c.id
      left join actual ac on ac.category_id = c.id
      left join public.category_limits li
        on li.household_id = c.household_id and li.category_id = c.id and li.deleted_at is null
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
               'limit_ratio', case when k.limit_amount > 0 then round(k.actual_total::numeric / k.limit_amount, 4) end,
               'limit_status', private.limit_status(k.actual_total, k.limit_amount)
             ) order by k.sort_order, k.name)
        from category_totals k
       where k.planned <> 0 or k.actual_total <> 0 or k.limit_amount is not null
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

-- Oylik hisobot xabari (BR-161): qolgan qarz ham ekvivalentda.
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
  totals as (
    select c.id, c.name, c.sort_order,
           coalesce(la.actual, 0) + coalesce((
             select sum(lc.actual) from lines lc join public.categories cc on cc.id = lc.category_id
              where cc.parent_id = c.id
           ), 0)::bigint as actual_total,
           li.amount as limit_amount
      from public.categories c
      left join lines la on la.category_id = c.id
      left join public.category_limits li on li.category_id = c.id and li.household_id = c.household_id and li.deleted_at is null
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

-- View'lar so'rovchi huquqi bilan ishlaydi (security_invoker): kurs
-- yordamchilari ham `authenticated` ga ochiladi. Ikkalasi ham faqat o'qiydi
-- (`exchange_rates` va `currencies` baribir hammaga ochiq).
grant execute on function
  private.fx_rate(text, text, date),
  private.rate_to_uzs(text, date),
  private.to_base_amount(bigint, text, text, numeric)
to authenticated;

-- E29-T04: amal formasi uchun kurs (sanadagi yoki undan oldingi eng yaqin).
-- `null` — o'sha sanada kurs yo'q: forma qo'lda kiritishni so'raydi (BR-193).
create or replace function public.fx_rate_for(p_household uuid, p_currency text, p_date date)
returns numeric
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_base text;
begin
  if p_household not in (select private.my_household_ids()) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  select h.base_currency into v_base from public.households h where h.id = p_household;
  return private.fx_rate(p_currency, v_base, p_date);
end;
$$;

grant execute on function public.fx_rate_for(uuid, text, date) to authenticated;
