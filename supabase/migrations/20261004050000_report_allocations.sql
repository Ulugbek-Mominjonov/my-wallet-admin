-- E24: hisobot ro'yxatida fondga ajratma ham ko'rinsin (BR-061). Ajratma —
-- karta/naqddan 👤 shaxsiy fondga o'tkazma: xarajat emas, lekin oyda pul
-- qayerga ketganini ko'rsatadi, shuning uchun ro'yxatda alohida belgi bilan
-- chiqadi va xarajat jamiga qo'shilmaydi (aks holda fonddan sarf bilan
-- birga bitta pul ikki marta sanalardi — BR-063).
--
-- O'tkazma qatori uchun nom — manzil hisob (pul qayerga ketdi), summa esa
-- `private.budget_lines` dagidek ishorali: fonddan qaytgan pul manfiy.
create or replace function private.month_entries(p_household uuid, p_month public.month_start)
returns table (id uuid, line text, occurred_on date, created_at timestamptz,
               amount bigint, name text, category text, account text, note text)
language sql
stable
security invoker
set search_path = ''
as $$
  select t.id,
         case
           when t.kind = 'income' then 'income'
           when t.kind = 'transfer' then 'allocation'
           when a.type = 'personal_fund' then 'fund_spent'
           else 'expense'
         end,
         t.occurred_on,
         t.created_at,
         case when t.kind = 'transfer' and a.type = 'personal_fund'
              then -t.amount_base else t.amount_base end,
         case when t.kind = 'transfer'
              then coalesce(ta.name, a.name)
              else coalesce(nullif(t.payee, ''), c.name, a.name) end,
         case when t.kind = 'transfer'
              then (select sys.name from public.categories sys
                     where sys.household_id = t.household_id
                       and sys.system_code = 'personal_allocation')
              else c.name end,
         a.name,
         nullif(t.note, '')
    from public.transactions t
    join public.accounts a on a.id = t.account_id
    left join public.accounts ta on ta.id = t.to_account_id
    left join public.categories c on c.id = t.category_id
   where t.household_id = p_household and t.budget_month = p_month and t.deleted_at is null
$$;

create or replace function public.report_month(p_household uuid, p_month public.month_start)
returns jsonb
language plpgsql
stable
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
    'accounts', coalesce((
      select jsonb_agg(jsonb_build_object('account_id', b.account_id, 'name', b.name,
                                          'type', b.type, 'currency', b.currency,
                                          'balance', b.balance) order by b.sort_order, b.name)
        from private.month_balances(p_household, p_month) b
    ), '[]'::jsonb),
    'incomes', coalesce((
      select jsonb_agg(jsonb_build_object('id', e.id, 'occurred_on', e.occurred_on,
                                          'amount', e.amount, 'name', e.name,
                                          'category', e.category, 'account', e.account,
                                          'note', e.note)
                       order by e.occurred_on, e.created_at)
        from private.month_entries(p_household, p_month) e where e.line = 'income'
    ), '[]'::jsonb),
    -- Xarajat ro'yxatiga fondga ajratma ham kiradi (BR-061): u xarajat emas,
    -- shuning uchun `line` bilan ajratiladi va jamga klient qo'shmaydi.
    'expenses', coalesce((
      select jsonb_agg(jsonb_build_object('id', e.id, 'occurred_on', e.occurred_on,
                                          'amount', e.amount, 'name', e.name,
                                          'category', e.category, 'account', e.account,
                                          'line', e.line, 'note', e.note)
                       order by e.occurred_on, e.created_at)
        from private.month_entries(p_household, p_month) e
       where e.line in ('expense', 'fund_spent', 'allocation')
    ), '[]'::jsonb),
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
