-- E27-T03 (BR-181): eski Sheets byudjetini (v1 JSON) ko'chirish.
--
-- Moslashtirish qoidalari — docs/MIGRATSIYA.md. Qisqacha: daromad va
-- xarajat oylari eski `monthKey` bo'yicha (qo'lda, BR-042), "O'zim uchun"
-- qatori — 👤 fondga o'tkazma (BR-061), fond sarflari — fond hisobidagi
-- xarajat (BR-063). Summalar so'mdan tiyinga o'tadi (BR-001).
--
-- Qayta ishga tushirish xavfsiz: har yozuvda `import_batch_id`, yangi
-- paket oldingisini o'chiradi (tombstone — sinxron uchun).

alter table public.transactions add column import_batch_id uuid;
alter table public.planned_items add column import_batch_id uuid;

comment on column public.transactions.import_batch_id is
  'E27: ko''chirish paketi — qayta import oldingisini almashtiradi.';

create index transactions_import_batch_idx on public.transactions (household_id)
  where import_batch_id is not null;
create index planned_items_import_batch_idx on public.planned_items (household_id)
  where import_batch_id is not null;

-- Nom bo'yicha kategoriya (registrsiz); yo'q bo'lsa — yaratiladi.
create or replace function private.legacy_category(
  p_household uuid,
  p_kind public.category_kind,
  p_name text,
  p_shift smallint default 0
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_name text := nullif(btrim(p_name), '');
begin
  if v_name is null then
    return null;
  end if;
  select c.id into v_id
    from public.categories c
   where c.household_id = p_household and c.kind = p_kind
     and lower(c.name) = lower(v_name) and c.deleted_at is null
   order by c.archived_at nulls first
   limit 1;

  if v_id is null then
    insert into public.categories (household_id, kind, name, month_shift, icon, color, sort_order)
    values (p_household, p_kind, v_name, case when p_kind = 'income' then p_shift else 0 end,
            'dots', '#64748B',
            coalesce((select max(c.sort_order) + 1 from public.categories c
                       where c.household_id = p_household and c.kind = p_kind), 0))
    returning id into v_id;
  elsif p_kind = 'income' then
    -- BR-031: eski qoida (oy siljishi) yangi kategoriyaga ko'chadi.
    update public.categories set month_shift = p_shift
     where id = v_id and month_shift is distinct from p_shift;
  end if;
  return v_id;
end;
$$;

/*
 * Ko'chirishning o'zi. Natija:
 * {counts{…}, months[{month, legacy{balance, saved}, current{…}, diff{…}}],
 *  warnings[{code, name}]}.
 */
create or replace function private.legacy_apply(p_household uuid, p_payload jsonb, p_batch uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_card uuid;
  v_cash uuid;
  v_fund uuid;
  v_alloc_category uuid;
  v_currency text;
  v_warnings jsonb := '[]'::jsonb;
  v_counts jsonb;
  v_row jsonb;
  v_account uuid;
  v_category uuid;
  v_debt uuid;
  v_plan uuid;
  v_month date;
  v_amount bigint;
  v_planned bigint;
  v_incomes integer := 0;
  v_expenses integer := 0;
  v_plans integer := 0;
  v_allocations integer := 0;
  v_fund_spends integer := 0;
begin
  -- 0. Oldingi paket (qayta import) — tombstone qoldiriladi.
  update public.transactions set deleted_at = now()
   where household_id = p_household and import_batch_id is not null and deleted_at is null;
  update public.planned_items set deleted_at = now()
   where household_id = p_household and import_batch_id is not null and deleted_at is null;

  -- 1. Hisoblar turi bo'yicha (nomi tilga bog'liq).
  select a.id into v_card from public.accounts a
   where a.household_id = p_household and a.type = 'card' and a.deleted_at is null limit 1;
  select a.id into v_cash from public.accounts a
   where a.household_id = p_household and a.type = 'cash' and a.deleted_at is null limit 1;
  select a.id into v_fund from public.accounts a
   where a.household_id = p_household and a.type = 'personal_fund' and a.deleted_at is null limit 1;
  if v_card is null or v_cash is null or v_fund is null then
    raise exception 'accounts_missing' using errcode = 'P0001';
  end if;
  select c.id into v_alloc_category from public.categories c
   where c.household_id = p_household and c.system_code = 'personal_allocation' limit 1;
  select h.base_currency into v_currency from public.households h where h.id = p_household;

  -- 2. Daromad qoidalari (BR-031): tur → kategoriya, oy siljishi bilan.
  for v_row in select * from jsonb_array_elements(coalesce(p_payload #> '{settings,incomeRules}', '[]'::jsonb)) loop
    perform private.legacy_category(p_household, 'income'::public.category_kind,
                                    v_row ->> 'type',
                                    coalesce((v_row ->> 'shift')::smallint, 0::smallint));
  end loop;

  -- 3. Qarzlar va maqsadlar (nom bo'yicha: takroriy importda yangilanadi).
  for v_row in select * from jsonb_array_elements(coalesce(p_payload -> 'debts', '[]'::jsonb)) loop
    insert into public.debts (household_id, name, direction, currency, total, paid_before,
                              monthly_payment, note)
    select p_household, btrim(v_row ->> 'name'),
           (case when v_row ->> 'direction' = 'owedToMe' then 'owed_to_me' else 'i_owe' end)::public.debt_direction,
           v_currency,
           ((v_row ->> 'total')::bigint) * 100,
           ((v_row ->> 'paidBefore')::bigint) * 100,
           nullif((v_row ->> 'monthly')::bigint, 0) * 100,
           nullif(btrim(coalesce(v_row ->> 'note', '')), '')
     where not exists (
       select 1 from public.debts d
        where d.household_id = p_household and lower(d.name) = lower(btrim(v_row ->> 'name'))
          and d.deleted_at is null);
  end loop;

  for v_row in select * from jsonb_array_elements(coalesce(p_payload -> 'goals', '[]'::jsonb)) loop
    insert into public.goals (household_id, name, currency, target, saved_manual,
                              monthly_contribution, deadline)
    select p_household, btrim(v_row ->> 'name'), v_currency,
           ((v_row ->> 'target')::bigint) * 100,
           ((v_row ->> 'saved')::bigint) * 100,
           nullif((v_row ->> 'monthly')::bigint, 0) * 100,
           nullif(v_row ->> 'deadline', '')::date
     where not exists (
       select 1 from public.goals g
        where g.household_id = p_household and lower(g.name) = lower(btrim(v_row ->> 'name'))
          and g.deleted_at is null);
  end loop;

  -- 3b. Sozlamalar: doimiy rejalar, limitlar, tez tugmalar, fond qoidasi,
  -- eslatmalar (nom bo'yicha — takroriy importda ikkilanmaydi).
  for v_row in select * from jsonb_array_elements(coalesce(p_payload #> '{settings,recurring}', '[]'::jsonb)) loop
    insert into public.recurring_rules (household_id, kind, name, category_id, account_id,
                                        amount, day_of_month, auto_pay)
    select p_household, 'expense', btrim(v_row ->> 'name'),
           private.legacy_category(p_household, 'expense'::public.category_kind, v_row ->> 'category'),
           case when v_row ->> 'method' = 'card' then v_card else v_cash end,
           nullif((v_row ->> 'amount')::bigint, 0) * 100,
           least(greatest(coalesce((v_row ->> 'day')::smallint, 1), 1), 31),
           coalesce((v_row ->> 'autoPay')::boolean, false)
     where not exists (
       select 1 from public.recurring_rules rr
        where rr.household_id = p_household and lower(rr.name) = lower(btrim(v_row ->> 'name'))
          and rr.deleted_at is null);
  end loop;

  for v_row in select * from jsonb_array_elements(coalesce(p_payload #> '{settings,limits}', '[]'::jsonb)) loop
    v_category := private.legacy_category(p_household, 'expense'::public.category_kind,
                                          v_row ->> 'category');
    if v_category is not null then
      insert into public.category_limits (household_id, category_id, amount)
      values (p_household, v_category, ((v_row ->> 'monthlyLimit')::bigint) * 100)
      on conflict do nothing;
    end if;
  end loop;

  for v_row in select * from jsonb_array_elements(coalesce(p_payload #> '{settings,quickAdd}', '[]'::jsonb)) loop
    insert into public.quick_actions (household_id, name, amount, category_id, account_id)
    select p_household, btrim(v_row ->> 'name'), nullif((v_row ->> 'amount')::bigint, 0) * 100,
           private.legacy_category(p_household, 'expense'::public.category_kind, v_row ->> 'category'),
           case when v_row ->> 'method' = 'card' then v_card else v_cash end
     where not exists (
       select 1 from public.quick_actions qa
        where qa.household_id = p_household and lower(qa.name) = lower(btrim(v_row ->> 'name'))
          and qa.deleted_at is null);
  end loop;

  v_row := p_payload #> '{settings,personalFund}';
  if v_row is not null then
    update public.households h
       set personal_fund_mode = (case when v_row ->> 'mode' = 'fixed' then 'fixed' else 'percent' end)::public.personal_fund_mode,
           personal_fund_percent = case when v_row ->> 'mode' = 'fixed'
                                        then h.personal_fund_percent
                                        else least(greatest((v_row ->> 'value')::numeric, 0), 100) end,
           personal_fund_fixed_amount = case when v_row ->> 'mode' = 'fixed'
                                             then ((v_row ->> 'value')::bigint) * 100
                                             else h.personal_fund_fixed_amount end,
           personal_fund_day = least(greatest(coalesce((v_row ->> 'day')::smallint, 5::smallint), 1::smallint), 31::smallint),
           personal_fund_source_account_id = case when v_row ->> 'method' = 'card' then v_card else v_cash end
     where h.id = p_household;
  end if;

  v_row := p_payload #> '{settings,reminders}';
  if v_row is not null then
    update public.notification_prefs np
       set telegram = coalesce((v_row ->> 'telegram')::boolean, np.telegram),
           reminder_hour = least(greatest(coalesce((v_row ->> 'soat')::smallint, np.reminder_hour), 0::smallint), 23::smallint),
           days_ahead = least(greatest(coalesce((v_row ->> 'kun')::smallint, np.days_ahead), 0::smallint), 14::smallint),
           monthly_report = coalesce((v_row ->> 'oylik')::boolean, np.monthly_report),
           report_day = least(greatest(coalesce((v_row ->> 'hisobotKuni')::smallint, np.report_day), 1::smallint), 28::smallint)
     where np.household_id = p_household and np.user_id = (select auth.uid());
  end if;

  -- 4. Daromadlar: oy eski taqsimotda qoladi (qo'lda).
  for v_row in select * from jsonb_array_elements(coalesce(p_payload -> 'incomes', '[]'::jsonb)) loop
    v_month := (v_row ->> 'monthKey' || '-01')::date;
    v_category := private.legacy_category(p_household, 'income'::public.category_kind,
                                          v_row ->> 'type');
    v_account := case when v_row ->> 'method' = 'card' then v_card else v_cash end;
    select d.id into v_debt from public.debts d
     where d.household_id = p_household and d.deleted_at is null
       and lower(d.name) = lower(btrim(coalesce(v_row ->> 'debtName', ''))) limit 1;

    insert into public.transactions (household_id, kind, account_id, amount, category_id, payee,
                                     occurred_on, budget_month, budget_month_source, debt_id,
                                     note, source, import_batch_id)
    values (p_household, 'income', v_account, ((v_row ->> 'amount')::bigint) * 100, v_category,
            nullif(btrim(v_row ->> 'type'), ''),
            coalesce(nullif(v_row ->> 'paidAt', '')::date, v_month), v_month, 'manual', v_debt,
            nullif(btrim(coalesce(v_row ->> 'note', '')), ''), 'import', p_batch);
    v_incomes := v_incomes + 1;
  end loop;

  -- 5. Xarajatlar: reja, to'lov va ajratma.
  for v_row in select * from jsonb_array_elements(coalesce(p_payload -> 'expenses', '[]'::jsonb)) loop
    v_month := (v_row ->> 'monthKey' || '-01')::date;
    v_account := case when v_row ->> 'method' = 'card' then v_card else v_cash end;
    v_planned := nullif(v_row ->> 'planned', '')::bigint * 100;
    v_amount := nullif(v_row ->> 'actual', '')::bigint * 100;
    v_plan := null;
    v_debt := null;
    if nullif(btrim(coalesce(v_row ->> 'debtName', '')), '') is not null then
      select d.id into v_debt from public.debts d
       where d.household_id = p_household and d.deleted_at is null
         and lower(d.name) = lower(btrim(v_row ->> 'debtName')) limit 1;
      if v_debt is null then
        v_warnings := v_warnings || jsonb_build_object('code', 'debt_not_found',
                                                       'name', v_row ->> 'debtName');
      end if;
    end if;

    if lower(btrim(coalesce(v_row ->> 'category', ''))) = lower((
         select c.name from public.categories c where c.id = v_alloc_category)) then
      -- BR-061: "O'zim uchun" — ajratma rejasi va fondga o'tkazma.
      if v_planned is not null then
        insert into public.planned_items (household_id, kind, name, account_id, planned_amount,
                                          due_date, budget_month, import_batch_id)
        values (p_household, 'allocation', btrim(v_row ->> 'name'), v_account, v_planned,
                coalesce(nullif(v_row ->> 'dueDate', '')::date, v_month), v_month, p_batch)
        returning id into v_plan;
        v_plans := v_plans + 1;
      end if;
      if v_amount is not null and v_amount > 0 then
        insert into public.transactions (household_id, kind, account_id, to_account_id, amount,
                                         occurred_on, budget_month, budget_month_source,
                                         planned_item_id, source, import_batch_id)
        values (p_household, 'transfer', v_account, v_fund, v_amount,
                coalesce(nullif(v_row ->> 'dueDate', '')::date, v_month), v_month, 'manual',
                v_plan, 'import', p_batch);
        v_allocations := v_allocations + 1;
      end if;
      continue;
    end if;

    v_category := private.legacy_category(p_household, 'expense'::public.category_kind,
                                          v_row ->> 'category');
    if v_planned is not null or v_amount is null then
      -- Reja bor (summasi noma'lum reja ham) — byudjet bandi.
      insert into public.planned_items (household_id, kind, name, category_id, account_id,
                                        planned_amount, due_date, budget_month, auto_pay,
                                        debt_id, note, import_batch_id)
      values (p_household, 'expense', btrim(v_row ->> 'name'), v_category, v_account,
              v_planned, coalesce(nullif(v_row ->> 'dueDate', '')::date, v_month), v_month,
              coalesce((v_row ->> 'autoPay')::boolean, false), v_debt,
              nullif(btrim(coalesce(v_row ->> 'note', '')), ''), p_batch)
      returning id into v_plan;
      v_plans := v_plans + 1;
    end if;

    if v_amount is not null and v_amount > 0 then
      insert into public.transactions (household_id, kind, account_id, amount, category_id, payee,
                                       occurred_on, budget_month, budget_month_source,
                                       planned_item_id, debt_id, note, source, import_batch_id)
      values (p_household, 'expense', v_account, v_amount, v_category, btrim(v_row ->> 'name'),
              coalesce(nullif(v_row ->> 'dueDate', '')::date, v_month), v_month, 'manual',
              v_plan, v_debt, nullif(btrim(coalesce(v_row ->> 'note', '')), ''), 'import', p_batch);
      v_expenses := v_expenses + 1;
    end if;
  end loop;

  -- 6. 👤 fond sarflari (BR-063): fond hisobidagi xarajat.
  for v_row in select * from jsonb_array_elements(coalesce(p_payload -> 'personalSpends', '[]'::jsonb)) loop
    v_month := (v_row ->> 'monthKey' || '-01')::date;
    insert into public.transactions (household_id, kind, account_id, amount, payee, occurred_on,
                                     budget_month, budget_month_source, note, source, import_batch_id)
    values (p_household, 'expense', v_fund, ((v_row ->> 'amount')::bigint) * 100,
            nullif(btrim(coalesce(v_row ->> 'purpose', '')), ''),
            coalesce(nullif(v_row ->> 'spentAt', '')::date, v_month), v_month, 'manual',
            nullif(btrim(coalesce(v_row ->> 'note', '')), ''), 'import', p_batch);
    v_fund_spends := v_fund_spends + 1;
  end loop;

  v_counts := jsonb_build_object(
    'incomes', v_incomes, 'expenses', v_expenses, 'plans', v_plans,
    'allocations', v_allocations, 'fund_spends', v_fund_spends);

  return jsonb_build_object(
    'batch', p_batch,
    'counts', v_counts,
    'warnings', v_warnings,
    'months', private.legacy_month_diff(p_household, p_payload));
end;
$$;

-- Sheets yakunlari ↔ yangi tizim (BR-181): har oy uchun farq.
create or replace function private.legacy_month_diff(p_household uuid, p_payload jsonb)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with expected as (
    select (e ->> 'monthKey' || '-01')::date as month,
           ((e ->> 'balance')::bigint) * 100 as balance,
           ((e ->> 'saved')::bigint) * 100 as saved
      from jsonb_array_elements(coalesce(p_payload -> 'expectedMonths', '[]'::jsonb)) e
  ),
  facts as (
    select f.month, f.income - f.expense as balance,
           f.income - f.expense + f.allocated - f.fund_spent as saved
      from private.month_facts(p_household,
                               (select min(month) from expected),
                               (select max(month) from expected)) f
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'month', x.month,
           'legacy', jsonb_build_object('balance', x.balance, 'saved', x.saved),
           'current', jsonb_build_object('balance', coalesce(f.balance, 0),
                                         'saved', coalesce(f.saved, 0)),
           'diff', jsonb_build_object('balance', coalesce(f.balance, 0) - x.balance,
                                      'saved', coalesce(f.saved, 0) - x.saved))
         order by x.month), '[]'::jsonb)
    from expected x
    left join facts f on f.month = x.month
$$;

/*
 * Ko'chirish RPC'si. `p_dry_run` (standart) — hamma narsa yoziladi,
 * natija hisoblanadi va tranzaksiya bekor qilinadi: foydalanuvchi
 * haqiqiy natijani (farqlar bilan) yozuvsiz ko'radi.
 *
 * `security definer`: import server maydonlarini ham yozadi
 * (`import_batch_id`, tombstone) — klientga bunday huquq berilmaydi.
 * Byudjet huquqi shu yerda tekshiriladi, yordamchilar esa
 * `authenticated` ga berilmagan (faqat shu funksiya ichidan).
 */
create or replace function public.import_legacy_v1(
  p_household uuid,
  p_payload jsonb,
  p_dry_run boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch uuid := private.uuid_v7();
  v_result jsonb;
  v_detail text;
begin
  if p_household not in (select private.my_admin_household_ids()) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  if coalesce(p_payload ->> 'version', '') <> '1' then
    raise exception 'unsupported_version' using errcode = 'P0001';
  end if;

  begin
    v_result := private.legacy_apply(p_household, p_payload, v_batch);
    if p_dry_run then
      -- Blok ichidagi yozuvlar shu xato bilan bekor bo'ladi; natija
      -- `detail` orqali qaytadi (tashqarida ushlanadi).
      raise exception 'dry_run' using errcode = 'P0001', detail = v_result::text;
    end if;
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'dry_run' then
      raise;
    end if;
    get stacked diagnostics v_detail = pg_exception_detail;
    return v_detail::jsonb || jsonb_build_object('dry_run', true);
  end;

  return v_result || jsonb_build_object('dry_run', false);
end;
$$;

-- Yordamchilar klientga berilmaydi: ular byudjet huquqini tekshirmaydi.
grant execute on function public.import_legacy_v1(uuid, jsonb, boolean) to authenticated;
