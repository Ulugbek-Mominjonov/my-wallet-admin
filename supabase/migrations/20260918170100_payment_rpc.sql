-- E08-T02, T03: rejani to'lash, o'tkazib yuborish, ommaviy to'lash.
-- Qoidalar: BR-071..074, BR-061. security invoker — yozuvlar foydalanuvchi
-- huquqi va RLS bilan; hosila maydonlarni triggerlar hisoblaydi (E07).

-- Reja turi → amal turi: ajratma — fondga o'tkazma (BR-061).
create or replace function private.plan_transaction_kind(p_kind public.plan_kind)
returns public.transaction_kind
language sql
immutable
set search_path = ''
as $$
  select case p_kind when 'allocation' then 'transfer' else p_kind::text end::public.transaction_kind
$$;

grant execute on function private.plan_transaction_kind(public.plan_kind) to authenticated;

-- ─── To'landi (BR-073) ─────────────────────────────────────────────────────
-- Summa standart — qolgan reja (asosiy valyutadagi hisobdan); summasi
-- noma'lum rejada yoki boshqa valyutadagi hisobda — majburiy. Qolgandan kam
-- to'lov qisman bo'lib qoladi yoki p_settle bilan yopiladi.
create or replace function public.pay_planned(
  p_item uuid,
  p_amount bigint default null,
  p_account uuid default null,
  p_date date default null,
  p_settle boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_household uuid;
  v_kind public.plan_kind;
  v_category uuid;
  v_plan_account uuid;
  v_planned bigint;
  v_paid bigint;
  v_settled_at timestamptz;
  v_skipped_at timestamptz;
  v_account uuid := p_account;
  v_same_currency boolean;
  v_amount bigint;
  v_date date;
  v_fund uuid;
  v_tx uuid;
  v_result jsonb;
begin
  select p.household_id, p.kind, p.category_id, p.account_id, p.planned_amount, p.paid_amount,
         p.settled_at, p.skipped_at
    into v_household, v_kind, v_category, v_plan_account, v_planned, v_paid, v_settled_at, v_skipped_at
    from public.planned_items p
   where p.id = p_item and p.deleted_at is null;
  if not found then
    raise exception 'planned_not_found' using errcode = 'P0001';
  end if;
  if v_household not in (select private.my_writable_household_ids()) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  if v_skipped_at is not null then
    raise exception 'planned_skipped' using errcode = 'P0001';
  end if;
  if v_settled_at is not null then
    raise exception 'planned_already_paid' using errcode = 'P0001';
  end if;

  v_account := coalesce(p_account, v_plan_account);
  if v_account is null then
    raise exception 'account_required' using errcode = 'P0001';
  end if;
  select a.currency = h.base_currency into v_same_currency
    from public.accounts a
    join public.households h on h.id = a.household_id
   where a.household_id = v_household and a.id = v_account;

  -- Qolgan summa asosiy valyutada — faqat shu valyutadagi hisobga standart bo'ladi.
  v_amount := coalesce(p_amount, case when v_same_currency then v_planned - v_paid end);
  if v_amount is null then
    raise exception 'amount_required' using errcode = 'P0001';
  end if;
  if v_amount <= 0 then
    raise exception 'invalid_amount' using errcode = 'P0001';
  end if;
  v_date := coalesce(p_date, private.household_today(v_household));

  if v_kind = 'allocation' then
    select a.id into v_fund
      from public.accounts a
     where a.household_id = v_household and a.type = 'personal_fund';
  end if;

  -- budget_month — reja oyi (trigger hisoblaydi, BR-044).
  insert into public.transactions (
    household_id, kind, account_id, to_account_id, amount, category_id,
    occurred_on, budget_month, planned_item_id
  )
  values (
    v_household, private.plan_transaction_kind(v_kind), v_account, v_fund, v_amount, v_category,
    v_date, date_trunc('month', v_date::timestamp)::date, p_item
  )
  returning id into v_tx;

  if p_settle then
    update public.planned_items set closed_at = now()
     where id = p_item and settled_at is null;
  end if;

  select jsonb_build_object(
           'transaction_id', v_tx,
           'paid_amount', p.paid_amount,
           'remaining', greatest(0, p.planned_amount - p.paid_amount),
           'status', private.planned_status(p, private.household_today(v_household))
         )
    into v_result
    from public.planned_items p
   where p.id = p_item;
  return v_result;
end;
$$;

-- ─── O'tkazib yuborish (BR-071) ────────────────────────────────────────────
create or replace function public.skip_planned(p_item uuid, p_skipped boolean default true)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_household uuid;
  v_result jsonb;
begin
  select p.household_id into v_household
    from public.planned_items p
   where p.id = p_item and p.deleted_at is null;
  if not found then
    raise exception 'planned_not_found' using errcode = 'P0001';
  end if;
  if v_household not in (select private.my_writable_household_ids()) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;

  update public.planned_items
     set skipped_at = case when p_skipped then coalesce(skipped_at, now()) end
   where id = p_item;

  select jsonb_build_object('id', p.id, 'status', private.planned_status(p, private.household_today(v_household)))
    into v_result
    from public.planned_items p
   where p.id = p_item;
  return v_result;
end;
$$;

-- ─── Ommaviy to'lash (BR-074) ──────────────────────────────────────────────
-- Bitta tranzaksiya, bitta INSERT (rejalar statement triggerida bir marta
-- qayta hisoblanadi). Faqat summasi aniq, to'lanmagan, o'tkazib
-- yuborilmagan, hisobi asosiy valyutada bo'lgan rejalar; qolganlari sababi
-- bilan qaytadi. p_account — rejada hisob ko'rsatilmaganlar uchun.
create or replace function public.bulk_pay_planned(
  p_items uuid[],
  p_date date default null,
  p_account uuid default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  with candidates as materialized (
    select x.id,
           x.n,
           p.household_id,
           p.kind,
           p.category_id,
           coalesce(p.account_id, p_account) as account_id,
           p.planned_amount - p.paid_amount as amount,
           coalesce(p_date, private.household_today(p.household_id)) as occurred_on,
           fund.id as fund_id,
           case
             when p.id is null then 'not_found'
             when p.household_id not in (select private.my_writable_household_ids()) then 'forbidden'
             when p.skipped_at is not null then 'skipped'
             when p.settled_at is not null then 'already_paid'
             when p.planned_amount is null then 'amount_unknown'
             when coalesce(p.account_id, p_account) is null then 'account_required'
             when a.id is null then 'account_not_found'
             when a.currency <> h.base_currency then 'currency_mismatch'
           end as reason
      from unnest(p_items) with ordinality as x (id, n)
      left join public.planned_items p on p.id = x.id and p.deleted_at is null
      left join public.households h on h.id = p.household_id
      left join public.accounts a on a.household_id = p.household_id and a.id = coalesce(p.account_id, p_account)
      left join public.accounts fund
        on fund.household_id = p.household_id and fund.type = 'personal_fund' and p.kind = 'allocation'
  ),
  -- Data-modifying CTE har doim bajariladi (natijasi ishlatilmasa ham).
  paid as (
    insert into public.transactions (
      household_id, kind, account_id, to_account_id, amount, category_id,
      occurred_on, budget_month, planned_item_id
    )
    select c.household_id, private.plan_transaction_kind(c.kind), c.account_id, c.fund_id, c.amount,
           c.category_id, c.occurred_on, date_trunc('month', c.occurred_on::timestamp)::date, c.id
      from candidates c
     where c.reason is null
    returning planned_item_id
  )
  select jsonb_build_object(
           'paid', coalesce(jsonb_agg(c.id order by c.n) filter (where c.reason is null), '[]'::jsonb),
           'skipped', coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'reason', c.reason) order by c.n)
                                 filter (where c.reason is not null), '[]'::jsonb)
         )
    from candidates c
$$;

grant execute on function
  public.pay_planned(uuid, bigint, uuid, date, boolean),
  public.skip_planned(uuid, boolean),
  public.bulk_pay_planned(uuid[], date, uuid)
to authenticated;
