-- E25-T03 (BR-182): bank ko'chirmasidan CSV import. Klient ustunlarni
-- moslashtirib qatorlarni yuboradi; server har qatorni tekshiradi, dublikatni
-- topadi (sana + summa + joy) va faqat toza qatorlarni yozadi.
--
-- `p_dry_run` (standart) — hech narsa yozilmaydi, faqat natija qaytadi:
-- foydalanuvchi avval nima bo'lishini ko'radi.

-- Nom bo'yicha topish — byudjet ichida registrsiz (BR-003).
create or replace function private.find_by_name(
  p_table text,
  p_household uuid,
  p_name text,
  p_kind text default null
)
returns uuid
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_table = 'accounts' then
    select a.id into v_id from public.accounts a
     where a.household_id = p_household and a.deleted_at is null
       and lower(a.name) = lower(btrim(p_name))
     order by a.archived_at nulls first limit 1;
  else
    select c.id into v_id from public.categories c
     where c.household_id = p_household and c.deleted_at is null
       and lower(c.name) = lower(btrim(p_name))
       and (p_kind is null or c.kind::text = p_kind)
     order by c.archived_at nulls first limit 1;
  end if;
  return v_id;
end;
$$;

/*
 * Qatorlar: [{occurred_on, amount, payee, account, category, note, kind}].
 * `amount` — eng kichik birlikda; manfiy bo'lsa xarajat, musbat bo'lsa
 * daromad (`kind` berilgan bo'lsa — o'sha). Natija:
 * {total, ready, imported, duplicates: [{index, transaction_id}],
 *  errors: [{index, code}]}.
 */
create or replace function public.import_transactions(
  p_household uuid,
  p_rows jsonb,
  p_dry_run boolean default true
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row jsonb;
  v_index integer := 0;
  v_kind public.transaction_kind;
  v_amount bigint;
  v_date date;
  v_payee text;
  v_account uuid;
  v_category uuid;
  v_existing uuid;
  v_errors jsonb := '[]'::jsonb;
  v_duplicates jsonb := '[]'::jsonb;
  v_ready integer := 0;
  v_imported integer := 0;
begin
  if p_household not in (select private.my_writable_household_ids()) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 1000 then
    raise exception 'invalid_batch' using errcode = 'P0001';
  end if;

  for v_row in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    v_index := v_index + 1;
    begin
      v_date := (v_row ->> 'occurred_on')::date;
      v_amount := (v_row ->> 'amount')::bigint;
    exception when others then
      v_errors := v_errors || jsonb_build_object('index', v_index, 'code', 'invalid_row');
      continue;
    end;

    if v_date is null or v_amount is null or v_amount = 0 then
      v_errors := v_errors || jsonb_build_object('index', v_index, 'code', 'invalid_row');
      continue;
    end if;

    v_kind := coalesce(
      nullif(v_row ->> 'kind', '')::public.transaction_kind,
      (case when v_amount < 0 then 'expense' else 'income' end)::public.transaction_kind);
    v_amount := abs(v_amount);
    v_payee := nullif(btrim(coalesce(v_row ->> 'payee', '')), '');

    v_account := private.find_by_name('accounts', p_household, coalesce(v_row ->> 'account', ''));
    if v_account is null then
      v_errors := v_errors || jsonb_build_object('index', v_index, 'code', 'account_not_found');
      continue;
    end if;
    v_category := private.find_by_name(
      'categories', p_household, coalesce(v_row ->> 'category', ''), v_kind::text);
    if v_category is null then
      v_errors := v_errors || jsonb_build_object('index', v_index, 'code', 'category_not_found');
      continue;
    end if;

    -- BR-182: dublikat — sana + summa + joy nomi bir xil.
    select t.id into v_existing
      from public.transactions t
     where t.household_id = p_household and t.deleted_at is null
       and t.occurred_on = v_date and t.amount = v_amount
       and lower(coalesce(t.payee, '')) = lower(coalesce(v_payee, ''))
     limit 1;
    if v_existing is not null then
      v_duplicates := v_duplicates
        || jsonb_build_object('index', v_index, 'transaction_id', v_existing);
      continue;
    end if;

    v_ready := v_ready + 1;
    if not p_dry_run then
      begin
        insert into public.transactions (household_id, kind, account_id, amount, category_id,
                                         payee, note, occurred_on, budget_month, source)
        values (p_household, v_kind, v_account, v_amount, v_category, v_payee,
                nullif(btrim(coalesce(v_row ->> 'note', '')), ''), v_date,
                date_trunc('month', v_date::timestamp)::date, 'import');
        v_imported := v_imported + 1;
      exception when others then
        -- Yopilgan oy (qattiq qulf) va boshqa qoidalar — qator o'tkaziladi.
        v_ready := v_ready - 1;
        v_errors := v_errors || jsonb_build_object(
          'index', v_index,
          'code', case when sqlstate = 'P0001' then sqlerrm else sqlstate end);
      end;
    end if;
  end loop;

  return jsonb_build_object(
    'total', v_index,
    'ready', v_ready,
    'imported', v_imported,
    'duplicates', v_duplicates,
    'errors', v_errors);
end;
$$;

grant execute on function
  private.find_by_name(text, uuid, text, text),
  public.import_transactions(uuid, jsonb, boolean)
to authenticated;
