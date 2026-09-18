-- E08-T01: oyni ochish — preview va ochish (BR-081..084).
-- Doimiy rejalardan (tartib bo'yicha, amal davri ichida) + 👤 fond ajratmasi
-- rejasi; idempotent (`on conflict do nothing` — BR-081, BR-082).

-- ─── Yordamchilar ──────────────────────────────────────────────────────────
-- Byudjet vaqt zonasidagi bugungi sana (BR-002).
create or replace function private.household_today(p_household uuid)
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone h.timezone)::date from public.households h where h.id = p_household
$$;

-- Oyning p_day-kuni; qisqa oyda oxirgi kunga qisiladi (BR-080: 31 → 28/29/30).
create or replace function private.month_day(p_month date, p_day smallint)
returns date
language sql
immutable
set search_path = ''
as $$
  select p_month + (least(p_day, extract(day from (p_month + interval '1 month' - interval '1 day'))::integer) - 1)
$$;

grant execute on function private.household_today(uuid), private.planned_status(public.planned_items, date)
  to authenticated;

-- Oy uchun yaratiladigan rejalar: aktiv doimiy rejalar + fond ajratmasi.
-- Fond rejasi nomi — tizim kategoriyasining joriy nomi (foydalanuvchi tilida,
-- o'zgartirilgan bo'lsa ham — BR-033); summa — BR-060 qoidasi.
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
         private.month_day(p_month, r.day_of_month), r.auto_pay, r.debt_id, r.id,
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

-- ─── Preview (BR-084) ──────────────────────────────────────────────────────
-- Nima yaratiladi va nima allaqachon bor — hech narsa yozilmaydi.
create or replace function public.open_month_preview(p_household uuid, p_month public.month_start)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  perform private.require_household_role(p_household, array['owner', 'admin', 'member', 'viewer']::public.member_role[]);

  select jsonb_build_object(
           'month', p_month,
           'closed', exists (
             select 1 from public.months m
              where m.household_id = p_household and m.month = p_month and m.closed_at is not null
           ),
           'new', count(*) filter (where not e.present),
           'existing', count(*) filter (where e.present),
           'items', coalesce(jsonb_agg(
             jsonb_build_object(
               'kind', c.kind,
               'name', c.name,
               'planned_amount', c.planned_amount,
               'due_date', c.due_date,
               'recurring_rule_id', c.recurring_rule_id,
               'system_code', c.system_code,
               'exists', e.present
             ) order by c.sort_order, c.due_date
           ), '[]'::jsonb)
         )
    into v_result
    from private.month_plan_candidates(p_household, p_month) c
    cross join lateral (
      select exists (
        select 1 from public.planned_items p
         where p.household_id = p_household and p.budget_month = p_month
           and (p.recurring_rule_id = c.recurring_rule_id
                or (c.system_code is not null and p.system_code = c.system_code))
      ) as present
    ) e;
  return v_result;
end;
$$;

-- ─── Oyni ochish (BR-081..084) ─────────────────────────────────────────────
-- Idempotent: shu oyda shu shablondan (yoki fond) reja bor bo'lsa — o'tkaziladi;
-- oy ichidagi qo'lda tuzatishlar qayta yozilmaydi (BR-082). months.opened_at —
-- birinchi ochilish vaqti.
create or replace function public.open_month(p_household uuid, p_month public.month_start)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_items jsonb;
  v_total integer;
begin
  perform private.require_household_role(p_household, array['owner', 'admin', 'member']::public.member_role[]);

  with candidates as materialized (
    select * from private.month_plan_candidates(p_household, p_month)
  ),
  inserted as (
    insert into public.planned_items (
      household_id, kind, name, category_id, account_id, planned_amount, due_date,
      budget_month, auto_pay, debt_id, recurring_rule_id, system_code, created_by
    )
    select p_household, c.kind, c.name, c.category_id, c.account_id, c.planned_amount, c.due_date,
           p_month, c.auto_pay, c.debt_id, c.recurring_rule_id, c.system_code, (select auth.uid())
      from candidates c
     order by c.sort_order, c.due_date
    on conflict do nothing
    returning id, kind, name, planned_amount, due_date
  )
  select coalesce(jsonb_agg(
           jsonb_build_object('id', i.id, 'kind', i.kind, 'name', i.name,
                              'planned_amount', i.planned_amount, 'due_date', i.due_date)
           order by i.due_date, i.name
         ), '[]'::jsonb),
         (select count(*) from candidates)
    into v_items, v_total
    from inserted i;

  insert into public.months (household_id, month, opened_at)
  values (p_household, p_month, now())
  on conflict (household_id, month) do update
    set opened_at = coalesce(public.months.opened_at, excluded.opened_at);

  return jsonb_build_object(
    'month', p_month,
    'created', jsonb_array_length(v_items),
    'skipped', v_total - jsonb_array_length(v_items),
    'items', v_items
  );
end;
$$;

grant execute on function
  public.open_month_preview(uuid, public.month_start),
  public.open_month(uuid, public.month_start)
to authenticated;
