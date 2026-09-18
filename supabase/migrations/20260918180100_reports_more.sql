-- E09-T03: yillik, jamg'arma, shaxsiy fond, qarzlar, maqsadlar va kategoriya
-- trendi hisobotlari. Qoidalar: BR-063, BR-064, BR-092, BR-095, BR-100..102,
-- BR-112..114, BR-121. Hammasi private.month_facts / budget_lines ustida.

-- BR-092: barcha oylar kesimi — jamg'arma va maqsad prognozi uchun umumiy.
-- Oylar birinchi yozuvdan joriy oygacha; o'rtacha — yozuvi bor oylar bo'yicha.
create or replace function private.overall_facts(p_household uuid)
returns table (
  months_count integer,
  total_income bigint,
  total_expense bigint,
  total_saved bigint,
  avg_monthly_saved bigint,
  avg_monthly_expense bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with f as (
    select m.*
      from private.month_facts(
             p_household,
             coalesce(private.first_record_month(p_household),
                      date_trunc('month', private.household_today(p_household)::timestamp)::date),
             date_trunc('month', private.household_today(p_household)::timestamp)::date
           ) m
  )
  select count(*) filter (where f.has_records)::integer,
         coalesce(sum(f.income), 0)::bigint,
         coalesce(sum(f.expense), 0)::bigint,
         coalesce(sum(f.income - f.expense + f.allocated - f.fund_spent), 0)::bigint,
         case when count(*) filter (where f.has_records) > 0
              then round(sum(f.income - f.expense + f.allocated - f.fund_spent)::numeric
                         / count(*) filter (where f.has_records))::bigint
              else 0 end,
         case when count(*) filter (where f.has_records) > 0
              then round(sum(f.expense)::numeric / count(*) filter (where f.has_records))::bigint
              else 0 end
    from f
$$;

grant execute on function private.overall_facts(uuid) to authenticated;

-- ─── Yillik ko'rinish (BR-092) ─────────────────────────────────────────────
create or replace function public.report_year(p_household uuid, p_year integer)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if p_household not in (select private.my_household_ids()) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  select jsonb_build_object(
           'year', p_year,
           'months', jsonb_agg(
             jsonb_build_object(
               'month', f.month, 'income', f.income, 'expense', f.expense,
               'allocated', f.allocated, 'fund_spent', f.fund_spent,
               'closed', mo.closed_at is not null, 'has_records', f.has_records
             ) || private.month_derived(f.income, f.expense, f.unpaid, f.allocated, f.fund_spent, f.planned)
             order by f.month
           ),
           'totals', jsonb_build_object(
             'income', sum(f.income), 'expense', sum(f.expense),
             'allocated', sum(f.allocated), 'fund_spent', sum(f.fund_spent)
           ) || private.month_derived(sum(f.income)::bigint, sum(f.expense)::bigint, sum(f.unpaid)::bigint,
                                      sum(f.allocated)::bigint, sum(f.fund_spent)::bigint, sum(f.planned)::bigint)
         )
    into v_result
    from private.month_facts(p_household, make_date(p_year, 1, 1), make_date(p_year, 12, 1)) f
    left join public.months mo on mo.household_id = p_household and mo.month = f.month;
  return v_result;
end;
$$;

-- ─── 🏦 Jamg'arma (BR-100..102, BR-092) ────────────────────────────────────
-- to'plangan[i] = to'plangan[i−1] + qoldiq[i]; joriy oy — ⏳ (is_current).
create or replace function public.report_savings(p_household uuid)
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
           'months', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'month', x.month, 'income', x.income, 'expense', x.expense,
                      'balance', x.balance, 'accumulated', x.accumulated,
                      'is_current', x.month = v_current
                    ) order by x.month)
               from (
                 select f.month, f.income, f.expense, f.income - f.expense as balance,
                        sum(f.income - f.expense) over (order by f.month) as accumulated
                   from private.month_facts(p_household, coalesce(private.first_record_month(p_household), v_current), v_current) f
               ) x
           ), '[]'::jsonb),
           'summary', (
             select jsonb_build_object(
                      'months_count', o.months_count,
                      'total_income', o.total_income,
                      'total_expense', o.total_expense,
                      'total_balance', o.total_income - o.total_expense,
                      'total_saved', o.total_saved,
                      'avg_monthly_saved', o.avg_monthly_saved,
                      'avg_monthly_expense', o.avg_monthly_expense
                    )
               from private.overall_facts(p_household) o
           )
         )
    into v_result;
  return v_result;
end;
$$;

-- ─── 👤 Shaxsiy fond (BR-063, BR-064) ──────────────────────────────────────
create or replace function public.report_personal_fund(p_household uuid, p_from public.month_start, p_to public.month_start)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_fund uuid;
  v_result jsonb;
begin
  if p_household not in (select private.my_household_ids()) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  select a.id into v_fund from public.accounts a where a.household_id = p_household and a.type = 'personal_fund';

  select jsonb_build_object(
           'balance', (select b.balance from public.account_balances b where b.account_id = v_fund),
           'total_allocated', (select coalesce(sum(l.amount), 0) from private.budget_lines(p_household, '0001-01-01', '9999-12-01') l
                                where l.line = 'allocation'),
           'total_spent', (select coalesce(sum(l.amount), 0) from private.budget_lines(p_household, '0001-01-01', '9999-12-01') l
                            where l.line = 'fund_spent'),
           'months', coalesce((
             select jsonb_agg(jsonb_build_object('month', f.month, 'allocated', f.allocated, 'spent', f.fund_spent)
                              order by f.month)
               from private.month_facts(p_household, p_from, p_to) f
           ), '[]'::jsonb),
           'spends', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'id', t.id, 'occurred_on', t.occurred_on, 'amount', t.amount_base,
                      'category_id', t.category_id, 'payee', t.payee, 'note', t.note
                    ) order by t.occurred_on desc, t.id desc)
               from public.transactions t
              where t.household_id = p_household and t.account_id = v_fund and t.kind = 'expense'
                and t.deleted_at is null and t.budget_month between p_from and p_to
           ), '[]'::jsonb)
         )
    into v_result;
  return v_result;
end;
$$;

-- ─── 💳 Qarzlar (BR-112..114) ──────────────────────────────────────────────
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
             'paid_in_app', b.paid_in_app, 'pending_amount', b.pending_amount, 'pending_count', b.pending_count,
             'remaining', b.remaining, 'progress', round(b.progress, 4), 'months_left', b.months_left,
             'end_month', b.end_month, 'status', b.status
           ) order by d.archived_at nulls first, d.name), '[]'::jsonb),
           -- BR-114: jamlar faqat asosiy valyutadagi, arxivlanmagan qarzlar bo'yicha.
           'totals', jsonb_build_object(
             'i_owe', coalesce(sum(b.remaining) filter (where d.direction = 'i_owe' and d.archived_at is null and d.currency = h.base_currency), 0),
             'owed_to_me', coalesce(sum(b.remaining) filter (where d.direction = 'owed_to_me' and d.archived_at is null and d.currency = h.base_currency), 0),
             'monthly_obligation', coalesce(sum(d.monthly_payment) filter (
               where d.direction = 'i_owe' and b.remaining > 0 and d.archived_at is null and d.currency = h.base_currency), 0),
             'net', coalesce(sum(b.remaining) filter (where d.direction = 'owed_to_me' and d.archived_at is null and d.currency = h.base_currency), 0)
                    - coalesce(sum(b.remaining) filter (where d.direction = 'i_owe' and d.archived_at is null and d.currency = h.base_currency), 0),
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
    join public.households h on h.id = d.household_id
   where b.household_id = p_household;
  return v_result;
end;
$$;

-- ─── 🎯 Maqsadlar (BR-121) ─────────────────────────────────────────────────
-- oyiga = maqsadning oylik ajratmasi ?? oyiga o'rtacha orttirish (BR-092).
create or replace function public.report_goals(p_household uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_current date;
  v_avg bigint;
  v_result jsonb;
begin
  if p_household not in (select private.my_household_ids()) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  v_current := date_trunc('month', private.household_today(p_household)::timestamp)::date;
  select o.avg_monthly_saved into v_avg from private.overall_facts(p_household) o;

  select jsonb_build_object(
           'avg_monthly_saved', v_avg,
           'goals', coalesce(jsonb_agg(jsonb_build_object(
             'goal_id', g.id, 'name', g.name, 'currency', g.currency, 'target', g.target,
             'saved', p.saved, 'remaining', p.remaining, 'progress', round(p.progress, 4),
             'monthly', s.monthly, 'monthly_source', s.source,
             'months_left', s.months_left,
             'end_month', (v_current + make_interval(months => s.months_left))::date,
             'deadline', g.deadline,
             'on_track', (v_current + make_interval(months => s.months_left))::date <= g.deadline,
             'account_id', g.account_id, 'achieved_at', g.achieved_at
           ) order by g.sort_order, g.name), '[]'::jsonb)
         )
    into v_result
    from public.goal_progress p
    join public.goals g on g.id = p.goal_id
    cross join lateral (
      select coalesce(g.monthly_contribution, nullif(greatest(v_avg, 0), 0)) as monthly,
             case when g.monthly_contribution is not null then 'goal'
                  when v_avg > 0 then 'average' end as source
    ) m
    cross join lateral (
      select m.monthly, m.source,
             case when p.remaining > 0 and m.monthly > 0 then ceil(p.remaining::numeric / m.monthly)::integer end as months_left
    ) s
   where p.household_id = p_household;
  return v_result;
end;
$$;

-- ─── Kategoriya trendi (BR-095) ────────────────────────────────────────────
-- Oylar × kategoriya fakti; oxirgi oy o'tgan oy va 3 oylik o'rtacha bilan.
create or replace function public.report_category_trend(
  p_household uuid,
  p_from public.month_start,
  p_to public.month_start,
  p_category uuid default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if p_household not in (select private.my_household_ids()) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;

  with lines as materialized (
    select l.month, l.category_id, sum(l.amount)::bigint as actual
      from private.budget_lines(p_household, (p_from - interval '3 months')::date, p_to) l
     where l.line in ('expense', 'allocation')
       and (p_category is null or l.category_id = p_category)
     group by l.month, l.category_id
  ),
  compare as (
    select c.category_id,
           coalesce(sum(c.actual) filter (where c.month = p_to), 0)::bigint as actual,
           coalesce(sum(c.actual) filter (where c.month = (p_to - interval '1 month')::date), 0)::bigint as prev,
           round(coalesce(sum(c.actual) filter (where c.month >= (p_to - interval '3 months')::date
                                                  and c.month < p_to), 0)::numeric / 3)::bigint as avg3
      from lines c
     group by c.category_id
  )
  select jsonb_build_object(
           'series', coalesce((
             select jsonb_agg(jsonb_build_object('month', l.month, 'category_id', l.category_id, 'actual', l.actual)
                              order by l.month, l.category_id)
               from lines l where l.month >= p_from
           ), '[]'::jsonb),
           'compare', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'category_id', c.category_id, 'actual', c.actual, 'prev', c.prev, 'avg3', c.avg3,
                      'vs_prev', case when c.prev > 0 then round((c.actual - c.prev)::numeric / c.prev, 4) end,
                      'vs_avg3', case when c.avg3 > 0 then round((c.actual - c.avg3)::numeric / c.avg3, 4) end
                    ) order by c.actual desc)
               from compare c
           ), '[]'::jsonb)
         )
    into v_result;
  return v_result;
end;
$$;

grant execute on function
  public.report_year(uuid, integer),
  public.report_savings(uuid),
  public.report_personal_fund(uuid, public.month_start, public.month_start),
  public.report_debts(uuid),
  public.report_goals(uuid),
  public.report_category_trend(uuid, public.month_start, public.month_start, uuid)
to authenticated;
