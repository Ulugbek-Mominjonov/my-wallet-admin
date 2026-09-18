-- E09-T01, T02: hisobotlar yadrosi va oylik hisobot.
-- Qoidalar: BR-022, BR-061..064, BR-076, BR-090..094, BR-102, BR-114, BR-130..132.
-- Hamma summalar asosiy valyutada (amount_base), eng kichik birlikda.
-- security invoker: faqat a'zo bo'lgan byudjet (RLS + aniq tekshiruv).

-- ─── Byudjet qatorlari (yagona tasnif) ─────────────────────────────────────
-- Har tirik amal bitta qatorga aylanadi:
--   income     — daromad (fondga daromad yo'q, BR-063)
--   expense    — byudjet hisobidan xarajat
--   allocation — fondga o'tkazma (+) yoki fonddan byudjetga qaytish (−), BR-061;
--                kategoriyasi — "O'zim uchun"
--   fund_spent — fond hisobidan xarajat (byudjetga ta'sir qilmaydi, BR-062)
-- Byudjet hisoblari orasidagi o'tkazma — qator emas (BR-023).
-- method — BR-022: naqd → cash, qolgan turlar → card (fond qatnashmaydi).
create or replace function private.budget_lines(p_household uuid, p_from date, p_to date)
returns table (month date, line text, method text, category_id uuid, amount bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  with sys as (
    select c.id from public.categories c
     where c.household_id = p_household and c.system_code = 'personal_allocation'
  )
  select t.budget_month,
         case
           when t.kind = 'income' then 'income'
           when t.kind = 'transfer' then 'allocation'
           when a.type = 'personal_fund' then 'fund_spent'
           else 'expense'
         end,
         case
           when t.kind = 'expense' and a.type = 'personal_fund' then null
           when (case when t.kind = 'transfer' and a.type = 'personal_fund' then ta.type else a.type end) = 'cash'
             then 'cash'
           else 'card'
         end,
         case when t.kind = 'transfer' then (select sys.id from sys) else t.category_id end,
         case when t.kind = 'transfer' and a.type = 'personal_fund' then -t.amount_base else t.amount_base end
    from public.transactions t
    join public.accounts a on a.id = t.account_id
    left join public.accounts ta on ta.id = t.to_account_id
   where t.household_id = p_household
     and t.budget_month between p_from and p_to
     and t.deleted_at is null
     and (t.kind <> 'transfer' or (a.type = 'personal_fund') <> (ta.type = 'personal_fund'))
$$;

-- ─── Oylar kesimi (BR-090) ─────────────────────────────────────────────────
-- [p_from, p_to] oralig'idagi har oy: yig'indilar + rejalar (xarajat va
-- ajratma; o'tkazib yuborilgan va daromad rejalari kirmaydi).
-- has_records — BR-092 "yozuvi bor oy".
create or replace function private.month_facts(p_household uuid, p_from date, p_to date)
returns table (
  month date,
  income bigint, income_card bigint, income_cash bigint,
  expense bigint, expense_card bigint, expense_cash bigint,
  allocated bigint, fund_spent bigint,
  planned bigint, unpaid bigint, unknown_count integer,
  has_records boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  with facts as (
    select l.month,
           sum(l.amount) filter (where l.line = 'income') as income,
           sum(l.amount) filter (where l.line = 'income' and l.method = 'card') as income_card,
           sum(l.amount) filter (where l.line = 'income' and l.method = 'cash') as income_cash,
           sum(l.amount) filter (where l.line in ('expense', 'allocation')) as expense,
           sum(l.amount) filter (where l.line in ('expense', 'allocation') and l.method = 'card') as expense_card,
           sum(l.amount) filter (where l.line in ('expense', 'allocation') and l.method = 'cash') as expense_cash,
           sum(l.amount) filter (where l.line = 'allocation') as allocated,
           sum(l.amount) filter (where l.line = 'fund_spent') as fund_spent
      from private.budget_lines(p_household, p_from, p_to) l
     group by l.month
  ),
  plans as (
    select p.budget_month as month,
           sum(coalesce(p.planned_amount, 0)) as planned,
           sum(p.planned_amount - p.paid_amount) filter (where p.settled_at is null) as unpaid,
           count(*) filter (where p.settled_at is null and p.planned_amount is null) as unknown_count
      from public.planned_items p
     where p.household_id = p_household
       and p.budget_month between p_from and p_to
       and p.deleted_at is null and p.skipped_at is null and p.kind <> 'income'
     group by p.budget_month
  )
  select m.month::date,
         coalesce(f.income, 0)::bigint, coalesce(f.income_card, 0)::bigint, coalesce(f.income_cash, 0)::bigint,
         coalesce(f.expense, 0)::bigint, coalesce(f.expense_card, 0)::bigint, coalesce(f.expense_cash, 0)::bigint,
         coalesce(f.allocated, 0)::bigint, coalesce(f.fund_spent, 0)::bigint,
         coalesce(pl.planned, 0)::bigint, coalesce(pl.unpaid, 0)::bigint, coalesce(pl.unknown_count, 0)::integer,
         f.month is not null or pl.month is not null
    from generate_series(p_from, p_to, interval '1 month') as m (month)
    left join facts f on f.month = m.month::date
    left join plans pl on pl.month = m.month::date
$$;

-- Byudjetning birinchi yozuvi oyi (hisobotlar "barcha oylar" oralig'i uchun).
create or replace function private.first_record_month(p_household uuid)
returns date
language sql
stable
security invoker
set search_path = ''
as $$
  select least(
    (select min(t.budget_month) from public.transactions t
      where t.household_id = p_household and t.deleted_at is null),
    (select min(p.budget_month) from public.planned_items p
      where p.household_id = p_household and p.deleted_at is null)
  )::date
$$;

-- BR-021: hisob qoldig'i — boshlang'ich + daromad − xarajat ± o'tkazmalar.
create or replace function private.account_balance(p_account uuid)
returns bigint
language sql
stable
security invoker
set search_path = ''
as $$
  select a.opening_balance
         + coalesce((
             select sum(case when t.kind = 'income' then t.amount else -t.amount end)
               from public.transactions t
              where t.account_id = p_account and t.deleted_at is null
           ), 0)::bigint
         + coalesce((
             select sum(t.to_amount)
               from public.transactions t
              where t.to_account_id = p_account and t.deleted_at is null
           ), 0)::bigint
    from public.accounts a
   where a.id = p_account
$$;

-- BR-091: hosila ko'rsatkichlar bitta joyda (oylik, yillik, jamg'arma).
create or replace function private.month_derived(
  p_income bigint, p_expense bigint, p_unpaid bigint, p_allocated bigint, p_fund_spent bigint, p_planned bigint
)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'balance', p_income - p_expense,
    'forecast', p_income - p_expense - p_unpaid,
    'saved', p_income - p_expense + p_allocated - p_fund_spent,
    'saved_ratio', case when p_income > 0 then round((p_income - p_expense + p_allocated - p_fund_spent)::numeric / p_income, 4) else 0 end,
    'spent_ratio', case when p_income > 0 then round(p_expense::numeric / p_income, 4) else 0 end,
    'plan_ratio', case when p_planned > 0 then round(p_expense::numeric / p_planned, 4) end
  )
$$;

-- BR-130: limit holati — < 80% ok, 80–100% near, > 100% over.
create or replace function private.limit_status(p_actual bigint, p_limit bigint)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_limit is null then null
    when p_actual > p_limit then 'over'
    when p_actual * 5 >= p_limit * 4 then 'near'
    else 'ok'
  end
$$;

grant execute on function
  private.account_balance(uuid),
  private.budget_lines(uuid, date, date),
  private.month_facts(uuid, date, date),
  private.first_record_month(uuid),
  private.month_derived(bigint, bigint, bigint, bigint, bigint, bigint),
  private.limit_status(bigint, bigint)
to authenticated;

-- ─── Oylik hisobot (BR-090..094) ───────────────────────────────────────────
-- Bitta JSON — ekran uchun bitta so'rov (ARXITEKTURA 8, 3-qoida).
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
    -- BR-114 (asosiy valyutadagi qarzlar).
    'debts', (
      select jsonb_build_object(
               'i_owe', coalesce(sum(b.remaining) filter (where d.direction = 'i_owe'), 0),
               'owed_to_me', coalesce(sum(b.remaining) filter (where d.direction = 'owed_to_me'), 0),
               'monthly_obligation', coalesce(sum(d.monthly_payment) filter (where d.direction = 'i_owe' and b.remaining > 0), 0),
               'net', coalesce(sum(b.remaining) filter (where d.direction = 'owed_to_me'), 0)
                      - coalesce(sum(b.remaining) filter (where d.direction = 'i_owe'), 0),
               'paid_this_month', (
                 select coalesce(sum(t.amount_base), 0) from public.transactions t
                  where t.household_id = p_household and t.budget_month = p_month
                    and t.debt_id is not null and t.deleted_at is null
               )
             )
        from public.debt_balances b
        join public.debts d on d.id = b.debt_id
        join public.households h on h.id = d.household_id
       where b.household_id = p_household and d.archived_at is null and d.currency = h.base_currency
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

grant execute on function public.report_month(uuid, public.month_start) to authenticated;
