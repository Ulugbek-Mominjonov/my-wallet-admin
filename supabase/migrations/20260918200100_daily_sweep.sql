-- E11-T02: kunlik ish — avto-ochish (BR-084) va avto to'lov (BR-075).
-- Har soat ishga tushadi; byudjet vaqt zonasida 00:05 dan o'tgan va bugun
-- hali ishlamagan byudjetlarni oladi. Set-based: bitta INSERT ... SELECT.

alter table public.households add column last_sweep_on date;

-- Kunlik ish boshlanadigan mahalliy vaqt.
create or replace function private.sweep_local_time()
returns time language sql immutable set search_path = '' as $$ select time '00:05' $$;

-- BR-075: bitta rejaga bitta avto to'lov. Foydalanuvchi uni o'chirsa ham
-- qayta yaratilmaydi (masalan bank yechmagan bo'lsa — qo'lda hal qilinadi).
create unique index transactions_auto_pay_key on public.transactions (planned_item_id)
  where source = 'auto_pay';

-- ─── Oyni ochish — yagona joy (RPC ham, kunlik ish ham) ────────────────────
create or replace function private.open_month_for(p_household uuid, p_month date, p_actor uuid)
returns table (id uuid, kind public.plan_kind, name text, planned_amount bigint, due_date date)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with inserted as (
    insert into public.planned_items (
      household_id, kind, name, category_id, account_id, planned_amount, due_date,
      budget_month, auto_pay, debt_id, recurring_rule_id, system_code, created_by
    )
    select p_household, c.kind, c.name, c.category_id, c.account_id, c.planned_amount, c.due_date,
           p_month, c.auto_pay, c.debt_id, c.recurring_rule_id, c.system_code, p_actor
      from private.month_plan_candidates(p_household, p_month) c
     order by c.sort_order, c.due_date
    on conflict do nothing
    returning planned_items.id, planned_items.kind, planned_items.name::text,
              planned_items.planned_amount, planned_items.due_date
  )
  select * from inserted;

  insert into public.months (household_id, month, opened_at)
  values (p_household, p_month, now())
  on conflict (household_id, month) do update
    set opened_at = coalesce(public.months.opened_at, excluded.opened_at);
end;
$$;

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
  select count(*) into v_total from private.month_plan_candidates(p_household, p_month);
  select coalesce(jsonb_agg(
           jsonb_build_object('id', i.id, 'kind', i.kind, 'name', i.name,
                              'planned_amount', i.planned_amount, 'due_date', i.due_date)
           order by i.due_date, i.name
         ), '[]'::jsonb)
    into v_items
    from private.open_month_for(p_household, p_month, (select auth.uid())) i;
  return jsonb_build_object(
    'month', p_month,
    'created', jsonb_array_length(v_items),
    'skipped', v_total - jsonb_array_length(v_items),
    'items', v_items
  );
end;
$$;

-- ─── Kunlik ish ────────────────────────────────────────────────────────────
create or replace function jobs.daily_sweep(p_now timestamptz default now())
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_households uuid[];
  v_opened integer;
  v_plans integer;
  v_paid integer;
begin
  select array_agg(h.id) into v_households
    from public.households h
   where (p_now at time zone h.timezone)::time >= private.sweep_local_time()
     and (h.last_sweep_on is null or h.last_sweep_on < (p_now at time zone h.timezone)::date);
  if v_households is null then
    return jsonb_build_object('households', 0);
  end if;

  -- BR-084: joriy oy hali ochilmagan bo'lsa — ochiladi (1-kuni o'tkazib
  -- yuborilgan bo'lsa ham, keyingi kun). Avval ochish — bugungi avto to'lovlar
  -- shu ishning o'zida to'lanadi.
  select count(distinct h.id), count(o.id)
    into v_opened, v_plans
    from public.households h
    cross join lateral (select date_trunc('month', p_now at time zone h.timezone)::date as month) m
    left join lateral private.open_month_for(h.id, m.month, null) o on true
   where h.id = any (v_households) and h.auto_open_month
     and not exists (
       select 1 from public.months mo
        where mo.household_id = h.id and mo.month = m.month and mo.opened_at is not null
     );

  -- BR-075: muddati kelgan, summasi aniq, to'lanmagan avto to'lov rejalari —
  -- qolgan summa bilan (asosiy valyutadagi hisobdan; qattiq qulfli yopilgan oy — yo'q).
  insert into public.transactions (
    household_id, kind, account_id, to_account_id, amount, category_id,
    occurred_on, budget_month, planned_item_id, source
  )
  select p.household_id, private.plan_transaction_kind(p.kind), p.account_id, fund.id,
         p.planned_amount - p.paid_amount, p.category_id, p.due_date, p.budget_month, p.id, 'auto_pay'
    from public.planned_items p
    join public.households h on h.id = p.household_id
    join public.accounts a on a.id = p.account_id and a.deleted_at is null and a.currency = h.base_currency
    left join public.accounts fund
      on fund.household_id = p.household_id and fund.type = 'personal_fund' and p.kind = 'allocation'
   where p.household_id = any (v_households)
     and p.auto_pay and p.kind <> 'income'
     and p.planned_amount is not null and p.settled_at is null and p.skipped_at is null and p.deleted_at is null
     and p.due_date <= (p_now at time zone h.timezone)::date
     and not (h.strict_month_lock and exists (
       select 1 from public.months mo
        where mo.household_id = p.household_id and mo.month = p.budget_month and mo.closed_at is not null
     ))
  on conflict do nothing;
  get diagnostics v_paid = row_count;

  update public.households h
     set last_sweep_on = (p_now at time zone h.timezone)::date
   where h.id = any (v_households);

  return jsonb_build_object('households', cardinality(v_households), 'months_opened', v_opened,
                            'plans_created', v_plans, 'auto_paid', v_paid);
end;
$$;
