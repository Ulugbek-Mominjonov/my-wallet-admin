-- E07-T05, T06: amallar o'zgarganda rejalar to'lovi va 👤 fond ajratmasi.
-- Qoidalar: BR-060, BR-061, BR-071, BR-073; ADR-06.
--
-- Statement darajasidagi triggerlar (transition tables): ommaviy yozuvda
-- (bulk_pay_planned, avto to'lov, import) har reja/oy bir marta qayta
-- hisoblanadi — qator bo'yicha takror yo'q.

-- BR-060: fond ajratmasi yaxlitlanadigan birlik (eng kichik birlikda):
-- so'm uchun 1000 so'm, qolganlarga standart — 1 butun birlik.
alter table public.currencies
  add column allocation_rounding bigint not null default 100 check (allocation_rounding > 0);

update public.currencies set allocation_rounding = 100000 where code = 'UZS';

-- ─── 👤 Fond ajratmasi (BR-060) ────────────────────────────────────────────
-- Foiz rejimi: round(daromad × foiz / 100 / birlik) × birlik — bir marta
-- yaxlitlanadi. 0 bo'lsa summa hali noma'lum (NULL) — daromad kelganda paydo bo'ladi.
create or replace function private.fund_allocation_amount(p_income bigint, p_percent numeric, p_unit bigint)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select nullif((round(p_income * p_percent / 100 / p_unit) * p_unit)::bigint, 0)
$$;

-- Berilgan (byudjet, oy) juftliklarining fond rejasi summasini qayta hisoblaydi.
-- p_percent_only: daromad o'zgarganda faqat foiz rejimi (qat'iy rejimda oy
-- rejasidagi qo'lda tuzatish saqlanadi — BR-083); sozlama o'zgarganda — ikkalasi.
create or replace function private.recalc_fund_plans(
  p_households uuid[],
  p_months date[],
  p_percent_only boolean
)
returns void
language sql
security definer
set search_path = ''
as $$
  with target as (
    select p.id,
           case h.personal_fund_mode
             when 'percent' then private.fund_allocation_amount(
               coalesce(i.income, 0), h.personal_fund_percent, c.allocation_rounding
             )
             else nullif(h.personal_fund_fixed_amount, 0)
           end as amount
      from unnest(p_households, p_months) as m (household_id, month)
      join public.households h on h.id = m.household_id
      join public.currencies c on c.code = h.base_currency
      join public.planned_items p
        on p.household_id = m.household_id and p.budget_month = m.month
       and p.system_code = 'personal_allocation' and p.deleted_at is null
      left join lateral (
        select sum(t.amount_base)::bigint as income
          from public.transactions t
         where t.household_id = m.household_id and t.budget_month = m.month
           and t.kind = 'income' and t.deleted_at is null
      ) i on true
     where not p_percent_only or h.personal_fund_mode = 'percent'
  )
  update public.planned_items p
     set planned_amount = target.amount
    from target
   where p.id = target.id and p.planned_amount is distinct from target.amount
$$;

-- ─── Amallardan keyin ──────────────────────────────────────────────────────
-- BR-071, BR-073: rejaning to'langan summasi — tirik bog'langan amallar
-- (asosiy valyutada); to'langanlik holatini planned_items triggeri chiqaradi.
-- BR-060: daromadi o'zgargan oylarning fond rejasi.
create or replace function private.sync_after_transactions(
  p_plans uuid[],
  p_households uuid[],
  p_months date[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_plans is not null then
    with totals as (
      select x.id, coalesce(sum(t.amount_base) filter (where t.deleted_at is null), 0)::bigint as paid
        from unnest(p_plans) as x (id)
        left join public.transactions t on t.planned_item_id = x.id
       group by x.id
    )
    update public.planned_items p
       set paid_amount = totals.paid
      from totals
     where p.id = totals.id and p.paid_amount <> totals.paid;
  end if;
  if p_households is not null then
    perform private.recalc_fund_plans(p_households, p_months, true);
  end if;
end;
$$;

-- Har amal turi uchun alohida trigger (transition table bir hodisaga bog'lanadi),
-- funksiya bitta: ta'sirlangan rejalar va daromad oylarini yig'adi.
create or replace function private.transactions_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plans uuid[];
  v_households uuid[];
  v_months date[];
begin
  if tg_op = 'INSERT' then
    select array_agg(distinct r.planned_item_id) filter (where r.planned_item_id is not null)
      into v_plans
      from new_rows r;
    select array_agg(m.household_id), array_agg(m.budget_month)
      into v_households, v_months
      from (select distinct r.household_id, r.budget_month from new_rows r where r.kind = 'income') m;
  elsif tg_op = 'UPDATE' then
    select array_agg(distinct r.planned_item_id) filter (where r.planned_item_id is not null)
      into v_plans
      from (select o.planned_item_id from old_rows o union all select n.planned_item_id from new_rows n) r;
    select array_agg(m.household_id), array_agg(m.budget_month)
      into v_households, v_months
      from (
        select distinct r.household_id, r.budget_month
          from (
            select o.household_id, o.budget_month, o.kind from old_rows o
            union all
            select n.household_id, n.budget_month, n.kind from new_rows n
          ) r
         where r.kind = 'income'
      ) m;
  else
    select array_agg(distinct r.planned_item_id) filter (where r.planned_item_id is not null)
      into v_plans
      from old_rows r;
    select array_agg(m.household_id), array_agg(m.budget_month)
      into v_households, v_months
      from (select distinct r.household_id, r.budget_month from old_rows r where r.kind = 'income') m;
  end if;

  perform private.sync_after_transactions(v_plans, v_households, v_months);
  return null;
end;
$$;

create trigger transactions_after_insert after insert on public.transactions
  referencing new table as new_rows
  for each statement execute function private.transactions_changed();
create trigger transactions_after_update after update on public.transactions
  referencing old table as old_rows new table as new_rows
  for each statement execute function private.transactions_changed();
create trigger transactions_after_delete after delete on public.transactions
  referencing old table as old_rows
  for each statement execute function private.transactions_changed();

-- ─── Fond sozlamasi o'zgarganda ────────────────────────────────────────────
-- Joriy va keyingi oylar rejasi yangi qoida bilan; o'tgan oylar tarixi o'zgarmaydi.
create or replace function private.household_fund_settings_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.recalc_fund_plans(array_agg(p.household_id), array_agg(p.budget_month), false)
     from public.planned_items p
    where p.household_id = new.id
      and p.system_code = 'personal_allocation'
      and p.deleted_at is null
      and p.budget_month >= date_trunc('month', now() at time zone new.timezone)::date;
  return null;
end;
$$;

create trigger households_fund_settings
  after update of personal_fund_mode, personal_fund_percent, personal_fund_fixed_amount on public.households
  for each row
  when ((old.personal_fund_mode, old.personal_fund_percent, old.personal_fund_fixed_amount)
        is distinct from (new.personal_fund_mode, new.personal_fund_percent, new.personal_fund_fixed_amount))
  execute function private.household_fund_settings_changed();
