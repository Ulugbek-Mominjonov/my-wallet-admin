-- E09-T07: qoldiq view'lari — hisob/qarz bo'yicha indeksli qidiruv
-- (hisob qoldig'i — private.account_balance, reports_core migratsiyasida).
--
-- Ishlash tekshiruvi (scripts/perf-check.sh) topdi: UNION ALL + GROUP BY
-- view'lari join sharti bilan chaqirilganda (tekshiruv, maqsadlar, oylik
-- hisobot) Postgres shartni ichkariga tushira olmaydi va byudjetning butun
-- amallarini (yoki butun jadvalni) yig'adi. Endi har hisob/qarz alohida,
-- account_id / debt_id indeksi bilan hisoblanadi. Ustunlar o'zgarmaydi.

create or replace view public.account_balances with (security_invoker = true) as
select a.household_id,
       a.id as account_id,
       private.account_balance(a.id) as balance
  from public.accounts a
 where a.deleted_at is null;

-- BR-112..116: har qarz uchun alohida — debt_id indeksi (amallar) va byudjet
-- indeksi (rejalar); butun jadval yig'ilmaydi.
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
       end as status
  from public.debts d
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
