-- E32-T01: oylik tahlillar — kategoriya sakrashi, obunalar, eng katta
-- xarajatlar va hafta kunlari kesimi.
--
-- Summalar asosiy valyutada (BR-191), byudjet xarajatlari bo'yicha: fond
-- hisobidan qilingan xarajat byudjetga kirmaydi (BR-062), o'tkazma ham emas
-- (BR-023). Bitta oynadan (oxirgi 6 oy) hamma kesim hisoblanadi —
-- `transactions_month_idx` bo'yicha bitta oraliq o'qish.
create or replace function public.report_insights(p_household uuid, p_month public.month_start)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  -- Kategoriya sakrashi: 3 oylik o'rtachadan 30%+ oshgani.
  c_avg_months  constant integer := 3;
  c_spike_ratio constant numeric := 1.3;
  -- Obuna: oxirgi 6 oyning kamida 3 tasida bir xil nom va bir xil summa.
  c_sub_months  constant integer := 6;
  c_sub_hits    constant integer := 3;
  c_sub_limit   constant integer := 10;
  c_top         constant integer := 5;
  v_avg_from date := (p_month - make_interval(months => c_avg_months))::date;
  v_sub_from date := (p_month - make_interval(months => c_sub_months - 1))::date;
  v_result jsonb;
begin
  if p_household not in (select private.my_household_ids()) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;

  with tx as (
    select t.id, t.budget_month, t.occurred_on, t.category_id, t.payee, t.amount_base
      from public.transactions t
      join public.accounts a on a.id = t.account_id
     where t.household_id = p_household
       and t.kind = 'expense'
       and a.type <> 'personal_fund'
       and t.deleted_at is null
       and t.budget_month between least(v_avg_from, v_sub_from) and p_month
  ),
  by_category as (
    select c.id as category_id, c.name::text,
           coalesce(sum(tx.amount_base) filter (where tx.budget_month = p_month), 0)::bigint as actual,
           (coalesce(sum(tx.amount_base)
                       filter (where tx.budget_month >= v_avg_from and tx.budget_month < p_month), 0)
              / c_avg_months)::bigint as average
      from tx
      join public.categories c on c.id = tx.category_id
     group by c.id, c.name
  ),
  spikes as (
    select category_id, name, actual, average,
           round((actual - average) * 100.0 / average)::integer as delta_pct
      from by_category
     where average > 0 and actual > average * c_spike_ratio
     order by actual - average desc
     limit c_top
  ),
  subscriptions as (
    select (array_agg(tx.payee order by tx.occurred_on desc))[1]::text as payee,
           tx.amount_base as amount,
           count(distinct tx.budget_month)::integer as months,
           max(tx.occurred_on) as last_on
      from tx
     where tx.payee is not null and tx.amount_base > 0 and tx.budget_month >= v_sub_from
     group by lower(tx.payee), tx.amount_base
    having count(distinct tx.budget_month) >= c_sub_hits
     order by tx.amount_base desc
     limit c_sub_limit
  ),
  top_expenses as (
    select tx.id, tx.occurred_on, tx.payee::text, c.name::text as category, tx.amount_base as amount
      from tx
      join public.categories c on c.id = tx.category_id
     where tx.budget_month = p_month
     order by tx.amount_base desc, tx.occurred_on desc
     limit c_top
  ),
  weekdays as (
    select d.dow::integer,
           coalesce(sum(tx.amount_base), 0)::bigint as amount,
           count(tx.id)::integer as count
      from generate_series(1, 7) as d(dow)
      left join tx on tx.budget_month = p_month
                  and extract(isodow from tx.occurred_on) = d.dow
     group by d.dow
  )
  select jsonb_build_object(
           'month', p_month,
           'expense', (select coalesce(sum(amount_base), 0)::bigint from tx where budget_month = p_month),
           'spikes', (select coalesce(jsonb_agg(to_jsonb(s) order by s.actual - s.average desc), '[]'::jsonb)
                        from spikes s),
           'subscriptions', (select coalesce(jsonb_agg(to_jsonb(x) order by x.amount desc), '[]'::jsonb)
                               from subscriptions x),
           'subscriptions_total', (select coalesce(sum(amount), 0)::bigint from subscriptions),
           'top_expenses', (select coalesce(jsonb_agg(to_jsonb(e) order by e.amount desc), '[]'::jsonb)
                              from top_expenses e),
           'weekdays', (select coalesce(jsonb_agg(to_jsonb(w) order by w.dow), '[]'::jsonb) from weekdays w))
    into v_result;
  return v_result;
end;
$$;

comment on function public.report_insights(uuid, public.month_start) is
  'E32-T01: oylik tahlillar — sakrash, obunalar, eng katta xarajatlar, hafta kunlari.';

grant execute on function public.report_insights(uuid, public.month_start) to authenticated;
