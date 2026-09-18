-- E08-T04, T05: tegishli oyni qayta joylash (BR-043), oyni yopish (BR-150,
-- BR-153), kategoriyalarni birlashtirish (BR-036).

-- ─── BR-040: daromadning tegishli oyi — yagona manba ───────────────────────
-- sana oyi + kategoriya siljishi (qoida topilmasa 0). Trigger ham, qayta
-- joylash ham shu funksiyani ishlatadi.
create or replace function private.income_budget_month(p_occurred_on date, p_shift smallint)
returns date
language sql
immutable
set search_path = ''
as $$
  select (date_trunc('month', p_occurred_on::timestamp) + make_interval(months => coalesce(p_shift, 0)))::date
$$;

grant execute on function private.income_budget_month(date, smallint) to authenticated;

-- Amal triggeri BR-040 ni endi yuqoridagi funksiyadan oladi (mantiq o'zgarmagan).
-- Amal: havolalar, hosila maydonlar (to_amount, budget_month, amount_base),
-- oy qulfi.
create or replace function private.validate_transaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_new boolean := tg_op = 'INSERT' or old.deleted_at is not null;
  v_account_type public.account_type;
  v_account_currency text;
  v_account_deleted timestamptz;
  v_to_type public.account_type;
  v_to_currency text;
  v_to_deleted timestamptz;
  v_plan_kind public.plan_kind;
  v_plan_month date;
  v_plan_debt uuid;
  v_plan_skipped timestamptz;
  v_plan_deleted timestamptz;
  v_base text;
  v_rate numeric;
begin
  -- O'chirish: faqat oy qulfi; tombstone boshqa tekshirilmaydi.
  if tg_op = 'UPDATE' and old.deleted_at is null and new.deleted_at is not null then
    perform private.assert_month_writable(old.household_id, old.budget_month);
    return new;
  end if;
  if new.deleted_at is not null then
    return new;
  end if;
  if not v_is_new then
    perform private.assert_month_writable(old.household_id, old.budget_month);
  end if;

  select a.type, a.currency, a.deleted_at into v_account_type, v_account_currency, v_account_deleted
    from public.accounts a
   where a.household_id = new.household_id and a.id = new.account_id;
  if not found then
    return new; -- xatoni kompozit FK beradi
  end if;
  if new.kind = 'transfer' then
    select a.type, a.currency, a.deleted_at into v_to_type, v_to_currency, v_to_deleted
      from public.accounts a
     where a.household_id = new.household_id and a.id = new.to_account_id;
  end if;
  if new.planned_item_id is not null then
    select p.kind, p.budget_month, p.debt_id, p.skipped_at, p.deleted_at
      into v_plan_kind, v_plan_month, v_plan_debt, v_plan_skipped, v_plan_deleted
      from public.planned_items p
     where p.household_id = new.household_id and p.id = new.planned_item_id;
  end if;

  -- ─ Havolalar: yangi qator yoki havola o'zgarganda ─
  if v_is_new or (new.kind, new.account_id, new.to_account_id, new.category_id, new.planned_item_id, new.debt_id)
                 is distinct from (old.kind, old.account_id, old.to_account_id, old.category_id, old.planned_item_id, old.debt_id) then
    if v_account_deleted is not null or v_to_deleted is not null then
      raise exception 'account_deleted' using errcode = 'P0001';
    end if;
    -- BR-063: fondga faqat ajratma (o'tkazma) tushadi — daromad byudjet hisoblariga.
    if new.kind = 'income' and v_account_type = 'personal_fund' then
      raise exception 'invalid_account' using errcode = 'P0001';
    end if;
    -- BR-062: fonddan sarf kategoriyasiz kiritilsa — "O'zim uchun".
    if new.kind = 'expense' and new.category_id is null and v_account_type = 'personal_fund' then
      select c.id into new.category_id
        from public.categories c
       where c.household_id = new.household_id and c.system_code = 'personal_allocation';
    end if;
    if new.kind <> 'transfer' and new.category_id is not null then
      perform private.assert_category(new.household_id, new.category_id, new.kind::text::public.category_kind);
    end if;
    if v_plan_kind is not null then
      if v_plan_deleted is not null then
        raise exception 'planned_deleted' using errcode = 'P0001';
      end if;
      if v_plan_skipped is not null then
        raise exception 'planned_skipped' using errcode = 'P0001';
      end if;
      -- Reja ↔ amal: xarajat ↔ byudjet hisobidan xarajat, daromad ↔ daromad,
      -- ajratma ↔ byudjet hisobidan fondga o'tkazma (BR-061).
      if not ((v_plan_kind = 'expense' and new.kind = 'expense' and v_account_type <> 'personal_fund')
              or (v_plan_kind = 'income' and new.kind = 'income')
              or (v_plan_kind = 'allocation' and new.kind = 'transfer'
                  and v_account_type <> 'personal_fund' and v_to_type = 'personal_fund')) then
        raise exception 'planned_kind_mismatch' using errcode = 'P0001';
      end if;
      -- BR-111: qarzga bog'langan rejaning to'lovi qarzga ham bog'lanadi.
      new.debt_id := coalesce(new.debt_id, v_plan_debt);
    end if;
    if new.debt_id is not null then
      perform private.assert_debt(new.household_id, new.debt_id, new.kind::text, v_account_currency);
    end if;
  end if;

  -- ─ O'tkazma summasi (BR-193): bir valyutada = amount ─
  if new.kind = 'transfer' and v_to_currency is not null then
    if v_to_currency = v_account_currency then
      new.to_amount := new.amount;
    elsif new.to_amount is null then
      raise exception 'to_amount_required' using errcode = 'P0001';
    end if;
  end if;

  -- ─ Tegishli oy (BR-040..046, BR-065) ─ faqat kirishlar o'zgarganda: siljish
  -- keyin o'zgarsa eski yozuvlar faqat qayta joylash RPC'si bilan ko'chadi
  -- (BR-043), masalan izoh tahriri bilan emas.
  if new.budget_month_source = 'auto'
     and (v_is_new or (new.kind, new.category_id, new.occurred_on, new.planned_item_id, new.budget_month_source, new.budget_month)
                      is distinct from (old.kind, old.category_id, old.occurred_on, old.planned_item_id, old.budget_month_source, old.budget_month)) then
    new.budget_month := case
      when v_plan_month is not null then v_plan_month
      when new.kind = 'income' then private.income_budget_month(
        new.occurred_on,
        (select c.month_shift from public.categories c
          where c.household_id = new.household_id and c.id = new.category_id)
      )
      else date_trunc('month', new.occurred_on::timestamp)::date
    end;
  end if;

  -- ─ Asosiy valyutadagi summa (ADR-08, BR-191) ─ kirishlar o'zgarganda.
  if v_is_new or (new.amount, new.fx_rate, new.account_id, new.occurred_on)
                 is distinct from (old.amount, old.fx_rate, old.account_id, old.occurred_on) then
    select h.base_currency into v_base from public.households h where h.id = new.household_id;
    if v_account_currency = v_base then
      new.fx_rate := null;
      new.amount_base := new.amount;
    else
      v_rate := coalesce(new.fx_rate, private.fx_rate(v_account_currency, v_base, new.occurred_on));
      if v_rate is null then
        raise exception 'fx_rate_missing' using errcode = 'P0001';
      end if;
      new.fx_rate := v_rate;
      new.amount_base := private.to_base_amount(new.amount, v_account_currency, v_base, v_rate);
    end if;
  end if;

  if v_is_new or new.budget_month is distinct from old.budget_month then
    perform private.assert_month_writable(new.household_id, new.budget_month);
  end if;
  return new;
end;
$$;

-- ─── Qayta joylash (BR-043) ────────────────────────────────────────────────
-- Siljishi o'zgargan kategoriyalardagi avto rejimdagi (qo'lda tanlanmagan,
-- rejaga bog'lanmagan) daromadlar: hozirgi oy ≠ qoida bo'yicha oy.
create or replace function private.income_month_drift(p_household uuid)
returns table (id uuid, from_month date, to_month date, amount_base bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select t.id, t.budget_month, private.income_budget_month(t.occurred_on, c.month_shift), t.amount_base
    from public.transactions t
    join public.categories c on c.household_id = t.household_id and c.id = t.category_id
   where t.household_id = p_household
     and t.kind = 'income'
     and t.budget_month_source = 'auto'
     and t.planned_item_id is null
     and t.deleted_at is null
     and t.budget_month <> private.income_budget_month(t.occurred_on, c.month_shift)
$$;

grant execute on function private.income_month_drift(uuid) to authenticated;

-- Preview: "N ta yozuv ko'chadi: 2026-09 → 2026-10" — oy juftliklari bo'yicha.
create or replace function public.recalc_income_months_preview(p_household uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if p_household not in (select private.my_admin_household_ids()) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  select jsonb_build_object(
           'count', coalesce(sum(g.count), 0),
           'moves', coalesce(jsonb_agg(
             jsonb_build_object('from_month', g.from_month, 'to_month', g.to_month,
                                'count', g.count, 'amount_base', g.amount_base)
             order by g.from_month, g.to_month
           ), '[]'::jsonb)
         )
    into v_result
    from (
      select d.from_month, d.to_month, count(*) as count, sum(d.amount_base)::bigint as amount_base
        from private.income_month_drift(p_household) d
       group by d.from_month, d.to_month
    ) g;
  return v_result;
end;
$$;

-- Apply: preview'dagi son bilan mos kelmasa (orada o'zgargan) — rad etiladi.
-- Bitta UPDATE; yopilgan oy (qattiq qulf) bo'lsa hammasi bekor (month_closed).
create or replace function public.recalc_income_months_apply(p_household uuid, p_expected_count integer)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_moved integer;
begin
  if p_household not in (select private.my_admin_household_ids()) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  if (select count(*) from private.income_month_drift(p_household)) <> p_expected_count then
    raise exception 'preview_outdated' using errcode = 'P0001';
  end if;
  update public.transactions t
     set budget_month = d.to_month
    from private.income_month_drift(p_household) d
   where t.id = d.id;
  get diagnostics v_moved = row_count;
  return jsonb_build_object('moved', v_moved);
end;
$$;

-- ─── Oyni yopish (BR-150, BR-153) ──────────────────────────────────────────
-- Yopishdan oldingi tekshiruv: to'lanmagan (summasi aniq) va summasi noma'lum rejalar.
create or replace function public.month_close_check(p_household uuid, p_month public.month_start)
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
           'month', p_month,
           'unpaid_count', count(*) filter (where p.planned_amount is not null),
           'unpaid_amount', coalesce(sum(p.planned_amount - p.paid_amount) filter (where p.planned_amount is not null), 0),
           'unknown_count', count(*) filter (where p.planned_amount is null)
         )
    into v_result
    from public.planned_items p
   where p.household_id = p_household and p.budget_month = p_month
     and p.settled_at is null and p.skipped_at is null and p.deleted_at is null;
  return v_result;
end;
$$;

-- Faqat tugagan oy yopiladi; qayta ochish — istalgan vaqtda (owner/admin).
create or replace function public.set_month_closed(p_household uuid, p_month public.month_start, p_closed boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_household_role(p_household, array['owner', 'admin']::public.member_role[]);
  if p_closed and p_month >= date_trunc('month', private.household_today(p_household)::timestamp)::date then
    raise exception 'month_not_finished' using errcode = 'P0001';
  end if;

  insert into public.months (household_id, month, closed_at, closed_by)
  values (p_household, p_month,
          case when p_closed then now() end,
          case when p_closed then (select auth.uid()) end)
  on conflict (household_id, month) do update
    set closed_at = case when p_closed then coalesce(public.months.closed_at, excluded.closed_at) end,
        closed_by = case when p_closed then coalesce(public.months.closed_by, excluded.closed_by) end;

  return jsonb_build_object('month', p_month, 'closed', p_closed);
end;
$$;

-- ─── Kategoriyalarni birlashtirish (BR-036) ────────────────────────────────
-- Barcha tirik havolalar (subkategoriyalar, amallar, rejalar, doimiy rejalar,
-- tez tugmalar, limit) p_to ga ko'chadi, p_from o'chiriladi — bitta
-- tranzaksiyada. Daromad turlarida oy siljishi bir xil bo'lishi shart: aks
-- holda amallar jimgina boshqa oyga ko'chardi (avval BR-043 bilan tekislanadi).
create or replace function public.merge_categories(p_from uuid, p_to uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_household uuid;
  v_kind public.category_kind;
  v_shift smallint;
  v_system public.category_system_code;
  v_to_household uuid;
  v_to_kind public.category_kind;
  v_to_shift smallint;
  v_to_parent uuid;
  v_children integer;
  v_transactions integer;
  v_plans integer;
  v_rules integer;
  v_quick_actions integer;
begin
  select c.household_id, c.kind, c.month_shift, c.system_code
    into v_household, v_kind, v_shift, v_system
    from public.categories c
   where c.id = p_from and c.deleted_at is null;
  select c.household_id, c.kind, c.month_shift, c.parent_id
    into v_to_household, v_to_kind, v_to_shift, v_to_parent
    from public.categories c
   where c.id = p_to and c.deleted_at is null;
  if v_household is null or v_to_household is distinct from v_household then
    raise exception 'category_not_found' using errcode = 'P0001';
  end if;
  if v_household not in (select private.my_admin_household_ids()) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  if p_from = p_to then
    raise exception 'invalid_target' using errcode = 'P0001';
  end if;
  if v_system is not null then
    raise exception 'system_category' using errcode = 'P0001';
  end if;
  if v_kind <> v_to_kind then
    raise exception 'category_kind_mismatch' using errcode = 'P0001';
  end if;
  if v_shift <> v_to_shift then
    raise exception 'month_shift_mismatch' using errcode = 'P0001';
  end if;
  -- Subkategoriyalar faqat yuqori darajadagi kategoriyaga o'tadi (BR-034).
  if v_to_parent is not null and exists (
    select 1 from public.categories c
     where c.household_id = v_household and c.parent_id = p_from and c.deleted_at is null
  ) then
    raise exception 'invalid_parent' using errcode = 'P0001';
  end if;

  update public.categories set parent_id = p_to
   where household_id = v_household and parent_id = p_from and deleted_at is null;
  get diagnostics v_children = row_count;

  update public.transactions set category_id = p_to
   where household_id = v_household and category_id = p_from and deleted_at is null;
  get diagnostics v_transactions = row_count;
  update public.planned_items set category_id = p_to
   where household_id = v_household and category_id = p_from and deleted_at is null;
  get diagnostics v_plans = row_count;
  update public.recurring_rules set category_id = p_to
   where household_id = v_household and category_id = p_from and deleted_at is null;
  get diagnostics v_rules = row_count;
  update public.quick_actions set category_id = p_to
   where household_id = v_household and category_id = p_from and deleted_at is null;
  get diagnostics v_quick_actions = row_count;

  -- Limit: maqsadda limit bo'lmasa — manbaniki ko'chiriladi; bo'lsa — maqsadniki qoladi.
  insert into public.category_limits (household_id, category_id, amount, alert_80, alert_100)
  select l.household_id, p_to, l.amount, l.alert_80, l.alert_100
    from public.category_limits l
   where l.household_id = v_household and l.category_id = p_from and l.deleted_at is null
     and not exists (
       select 1 from public.category_limits t
        where t.household_id = v_household and t.category_id = p_to and t.deleted_at is null
     );
  update public.category_limits set deleted_at = now()
   where household_id = v_household and category_id = p_from and deleted_at is null;

  update public.categories set deleted_at = now() where id = p_from;

  return jsonb_build_object(
    'children', v_children,
    'transactions', v_transactions,
    'plans', v_plans,
    'recurring_rules', v_rules,
    'quick_actions', v_quick_actions
  );
end;
$$;

grant execute on function
  public.recalc_income_months_preview(uuid),
  public.recalc_income_months_apply(uuid, integer),
  public.month_close_check(uuid, public.month_start),
  public.set_month_closed(uuid, public.month_start, boolean),
  public.merge_categories(uuid, uuid)
to authenticated;
