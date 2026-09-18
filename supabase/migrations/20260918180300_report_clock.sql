-- E09-T05: hisobotlar uchun yagona "bugun" — golden fixture'lar aniq sana
-- bilan tekshirilishi uchun. `app.today` faqat SQL sessiyada o'rnatiladi
-- (kontrakt testlari); PostgREST klientlari uni o'zgartira olmaydi.

create or replace function private.household_today(p_household uuid)
returns date
language sql
stable
set search_path = ''
as $$
  select coalesce(nullif(current_setting('app.today', true), '')::date, (now() at time zone h.timezone)::date)
    from public.households h
   where h.id = p_household
$$;

-- View'lardagi joriy oy ham shu funksiyadan (ustunlar o'zgarmaydi).
create or replace view public.debt_balances with (security_invoker = true) as
select d.household_id,
       d.id as debt_id,
       coalesce(t.paid, 0) as paid_in_app,
       coalesce(p.pending, 0) as pending_amount,
       coalesce(p.pending_count, 0) as pending_count,
       r.remaining,
       least(1, (d.paid_before + coalesce(t.paid, 0))::numeric / d.total) as progress,
       s.months_left,
       (date_trunc('month', private.household_today(d.household_id)::timestamp)
         + make_interval(months => s.months_left))::date as end_month,
       case
         when r.remaining = 0 then 'closed'
         when coalesce(t.payments, 0) > 0 then 'paying'
         when coalesce(p.pending_count, 0) > 0 then 'pending'
         else 'unlinked'
       end as status
  from public.debts d
  left join (
    select x.household_id, x.debt_id, sum(x.amount)::bigint as paid, count(*) as payments
      from public.transactions x
     where x.debt_id is not null and x.deleted_at is null
     group by x.household_id, x.debt_id
  ) t on t.household_id = d.household_id and t.debt_id = d.id
  left join (
    select y.household_id, y.debt_id,
           sum(greatest(0, y.planned_amount - y.paid_amount))::bigint as pending,
           count(*) as pending_count
      from public.planned_items y
     where y.debt_id is not null and y.deleted_at is null
       and y.settled_at is null and y.skipped_at is null
     group by y.household_id, y.debt_id
  ) p on p.household_id = d.household_id and p.debt_id = d.id
  cross join lateral (select greatest(0, d.total - d.paid_before - coalesce(t.paid, 0)) as remaining) r
  cross join lateral (
    select case when r.remaining > 0 and d.monthly_payment > 0
                then ceil(r.remaining::numeric / d.monthly_payment)::integer end as months_left
  ) s
 where d.deleted_at is null;

create or replace view public.goal_progress with (security_invoker = true) as
select g.household_id,
       g.id as goal_id,
       v.saved,
       greatest(0, g.target - v.saved) as remaining,
       least(1, v.saved::numeric / g.target) as progress,
       s.months_left,
       e.end_month,
       e.end_month <= g.deadline as on_track
  from public.goals g
  left join public.account_balances b on b.household_id = g.household_id and b.account_id = g.account_id
  cross join lateral (
    select case when g.account_id is null then g.saved_manual
                else greatest(0, coalesce(b.balance, 0)) end as saved
  ) v
  cross join lateral (
    select case when g.target > v.saved and g.monthly_contribution > 0
                then ceil((g.target - v.saved)::numeric / g.monthly_contribution)::integer end as months_left
  ) s
  cross join lateral (
    select (date_trunc('month', private.household_today(g.household_id)::timestamp)
             + make_interval(months => s.months_left))::date as end_month
  ) e
 where g.deleted_at is null;
