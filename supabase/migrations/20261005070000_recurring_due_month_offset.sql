-- BR-086: doimiy rejaning to'lov kuni keyingi oyda bo'lishi mumkin. Byudjet
-- oyi o'zgarmaydi (xarajat o'sha oyniki), faqat sana siljiydi — masalan
-- oktabr byudjetidagi "Mashina to'lovi" 3-noyabrda to'lanadi. Shusiz
-- foydalanuvchi har oy ochilgan rejaning sanasini qo'lda surib chiqardi.
alter table public.recurring_rules
  add column due_month_offset smallint not null default 0
    check (due_month_offset between 0 and 1);

comment on column public.recurring_rules.due_month_offset is
  'To''lov kuni qaysi oyda: 0 — byudjet oyining o''zida, 1 — keyingi oyda (BR-086).';

-- Ustun darajasidagi grant (20260918150100_directories.sql) yangi ustunni
-- qamrab olmaydi — alohida beriladi.
grant insert (due_month_offset), update (due_month_offset)
  on public.recurring_rules to authenticated;

-- Nomzodlar: faqat `due_date` hisobi o'zgardi (siljish qo'shildi), qolgani
-- 20260918170000_month_rpc.sql dagidek.
create or replace function private.month_plan_candidates(p_household uuid, p_month date)
returns table (
  kind public.plan_kind,
  name text,
  category_id uuid,
  account_id uuid,
  planned_amount bigint,
  due_date date,
  auto_pay boolean,
  debt_id uuid,
  recurring_rule_id uuid,
  system_code public.plan_system_code,
  sort_order integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.kind, r.name, r.category_id, r.account_id, r.amount,
         private.month_day(
           (p_month + make_interval(months => r.due_month_offset))::date,
           r.day_of_month
         ),
         r.auto_pay, r.debt_id, r.id,
         null::public.plan_system_code, r.sort_order
    from public.recurring_rules r
   where r.household_id = p_household
     and r.deleted_at is null
     and r.active
     and (r.start_month is null or r.start_month <= p_month)
     and (r.end_month is null or r.end_month >= p_month)
  union all
  select 'allocation', c.name, null, h.personal_fund_source_account_id,
         case h.personal_fund_mode
           when 'percent' then private.fund_allocation_amount(
             coalesce(i.income, 0), h.personal_fund_percent, cur.allocation_rounding
           )
           else nullif(h.personal_fund_fixed_amount, 0)
         end,
         private.month_day(p_month, h.personal_fund_day), false, null, null,
         'personal_allocation', c.sort_order
    from public.households h
    join public.currencies cur on cur.code = h.base_currency
    join public.categories c on c.household_id = h.id and c.system_code = 'personal_allocation'
    left join lateral (
      select sum(t.amount_base)::bigint as income
        from public.transactions t
       where t.household_id = h.id and t.budget_month = p_month
         and t.kind = 'income' and t.deleted_at is null
    ) i on true
   where h.id = p_household
     -- Ajratma sozlanmagan (0% yoki 0 summa) — fond rejasi yaratilmaydi.
     and ((h.personal_fund_mode = 'percent' and h.personal_fund_percent > 0)
          or (h.personal_fund_mode = 'fixed' and h.personal_fund_fixed_amount > 0))
$$;
