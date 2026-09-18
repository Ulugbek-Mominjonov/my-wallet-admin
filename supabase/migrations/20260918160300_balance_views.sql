-- E07-T08, T09: hisob qoldiqlari, qarz va maqsad holati — o'qishda
-- hisoblanadi (ADR-03, BR-004). Qoidalar: BR-021, BR-112..116, BR-121, BR-122.
--
-- security_invoker: so'rovchi huquqi bilan — jadvallar RLS'i amal qiladi.
-- Har view bitta so'rov (GROUP BY), N+1 yo'q; `household_id` filtri
-- UNION/JOIN ichiga tushadi va household indekslaridan foydalanadi.

-- ─── Hisob qoldiqlari (BR-021) ─────────────────────────────────────────────
-- boshlang'ich + Σ daromad − Σ xarajat + Σ kiruvchi o'tkazma − Σ chiquvchi
-- o'tkazma — hisob valyutasida.
create view public.account_balances with (security_invoker = true) as
select a.household_id,
       a.id as account_id,
       (a.opening_balance + coalesce(sum(m.delta), 0))::bigint as balance
  from public.accounts a
  left join (
    select t.household_id, t.account_id,
           case when t.kind = 'income' then t.amount else -t.amount end as delta
      from public.transactions t
     where t.deleted_at is null
    union all
    select t.household_id, t.to_account_id, t.to_amount
      from public.transactions t
     where t.kind = 'transfer' and t.deleted_at is null
  ) m on m.household_id = a.household_id and m.account_id = a.id
 where a.deleted_at is null
 group by a.household_id, a.id;

comment on view public.account_balances is 'BR-021: hisob qoldig''i (hisob valyutasida).';

-- ─── Qarzlar holati (BR-112..116) ──────────────────────────────────────────
-- ilovadan  — bog'langan tirik amallar (qarz valyutasida, BR-111);
-- kutilmoqda — bog'langan to'lanmagan rejalar qoldig'i (BR-113);
-- qolgan = max(0, jami − oldin to'langan − ilovadan); qolgan oylar va tugash
-- oyi — oylik to'lov bo'yicha, byudjet vaqt zonasidagi joriy oydan.
create view public.debt_balances with (security_invoker = true) as
select d.household_id,
       d.id as debt_id,
       coalesce(t.paid, 0) as paid_in_app,
       coalesce(p.pending, 0) as pending_amount,
       coalesce(p.pending_count, 0) as pending_count,
       r.remaining,
       least(1, (d.paid_before + coalesce(t.paid, 0))::numeric / d.total) as progress,
       s.months_left,
       (date_trunc('month', now() at time zone h.timezone) + make_interval(months => s.months_left))::date
         as end_month,
       case
         when r.remaining = 0 then 'closed'
         when coalesce(t.payments, 0) > 0 then 'paying'
         when coalesce(p.pending_count, 0) > 0 then 'pending'
         else 'unlinked'
       end as status
  from public.debts d
  join public.households h on h.id = d.household_id
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

comment on view public.debt_balances is 'BR-112..116: qarz qoldig''i, kutilayotgan to''lovlar, tugash oyi, holat.';

-- ─── Maqsadlar progressi (BR-121, BR-122) ──────────────────────────────────
-- Yig'ilgan: hisobga bog'langan bo'lsa — hisob qoldig'i, aks holda qo'lda.
-- Oylar/tugash oyi — faqat maqsadning oylik ajratmasi bo'yicha; ajratma
-- berilmaganda o'rtacha orttirish bilan prognoz — report_goals (E10).
create view public.goal_progress with (security_invoker = true) as
select g.household_id,
       g.id as goal_id,
       v.saved,
       greatest(0, g.target - v.saved) as remaining,
       least(1, v.saved::numeric / g.target) as progress,
       s.months_left,
       e.end_month,
       e.end_month <= g.deadline as on_track
  from public.goals g
  join public.households h on h.id = g.household_id
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
    select (date_trunc('month', now() at time zone h.timezone) + make_interval(months => s.months_left))::date
             as end_month
  ) e
 where g.deleted_at is null;

comment on view public.goal_progress is 'BR-121, BR-122: maqsad progressi va oylik ajratma bo''yicha tugash oyi.';

-- View'lar faqat o'qiladi.
revoke all on public.account_balances, public.debt_balances, public.goal_progress from authenticated;
grant select on public.account_balances, public.debt_balances, public.goal_progress to authenticated;
