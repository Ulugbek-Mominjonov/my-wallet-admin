-- E23-T01/T03: admin amallar jadvali. Filtr bitta joyda (`private.
-- transaction_filter_sql`) — ro'yxat (keyset) va jami bir xil qatorlarni
-- ko'radi. Ommaviy amallar — bitta so'rovda, har qator natijasi alohida.
--
-- Nega security definer (sahifa va jami): RLS ostida trgm operatorlari
-- (leakproof emas) indeks sharti bo'la olmaydi — qidiruv byudjetning barcha
-- amallarini aylanardi (25 000 qatorda ~35 ms). A'zolik aniq tekshiriladi,
-- har so'rovda `household_id = $1` — natija RLS bilan bir xil.
--
-- Nega dinamik SQL: "(filtr yo'q yoki shart)" ko'rinishidagi statik so'rovda
-- rejalovchi indeksni tanlay olmaydi (umumiy reja) — har sahifa byudjetning
-- barcha amallarini aylanadi, qidiruv trgm indeksini ishlatmaydi. Faqat
-- faol filtr shartlari qo'shilsa, har chaqiruv o'z rejasini oladi: keyset —
-- `transactions_list_idx`, qidiruv — trgm GIN. Shartlar — o'zgarmas matn
-- bo'laklari, qiymatlar faqat `using` parametrlari ($1 — byudjet, $2 — filtr).

-- Qidiruv matni — joy va izoh birga: har qatorda ikki shart (to'rt emas),
-- bitta GIN indeks. Ifoda so'rovdagi bilan aynan bir xil bo'lishi shart.
create index transactions_search_trgm_idx on public.transactions
  using gin ((coalesce(payee, '') || ' ' || coalesce(note, '')) extensions.gin_trgm_ops)
  where deleted_at is null;

-- LIKE maxsus belgilarini ekranlash — foydalanuvchi matni naqsh bo'lmasin.
create or replace function private.like_pattern(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select '%' || replace(replace(replace(p_text, '\', '\\'), '%', '\%'), '_', '\_') || '%'
$$;

-- Filtr (hammasi ixtiyoriy): month (oy boshi), from/to (sana), kinds[],
-- accounts[] (manba yoki manzil), categories[] (subkategoriyalari bilan),
-- members[] (created_by), tags[], min/max (asosiy valyutada), q (joy/izoh:
-- qism-matn yoki 3+ belgida xatoli yozuv ham — BR-202).
create or replace function private.transaction_filter_sql(p_filters jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select concat_ws(e'\n',
    case when p_filters ? 'month' then
      'and t.budget_month = ($2 ->> ''month'')::date' end,
    case when p_filters ? 'from' then
      'and t.occurred_on >= ($2 ->> ''from'')::date' end,
    case when p_filters ? 'to' then
      'and t.occurred_on <= ($2 ->> ''to'')::date' end,
    case when p_filters ? 'kinds' then
      'and t.kind = any (array(select jsonb_array_elements_text($2 -> ''kinds''))::public.transaction_kind[])' end,
    case when p_filters ? 'accounts' then
      'and (t.account_id = any (array(select jsonb_array_elements_text($2 -> ''accounts''))::uuid[])
            or t.to_account_id = any (array(select jsonb_array_elements_text($2 -> ''accounts''))::uuid[]))' end,
    case when p_filters ? 'categories' then
      'and t.category_id = any (array(
             select c.id from public.categories c
              where c.household_id = $1
                and (c.id = any (array(select jsonb_array_elements_text($2 -> ''categories''))::uuid[])
                     or c.parent_id = any (array(select jsonb_array_elements_text($2 -> ''categories''))::uuid[]))))' end,
    case when p_filters ? 'members' then
      'and t.created_by = any (array(select jsonb_array_elements_text($2 -> ''members''))::uuid[])' end,
    case when p_filters ? 'tags' then
      'and exists (select 1 from public.transaction_tags x
                    where x.transaction_id = t.id and x.deleted_at is null
                      and x.tag_id = any (array(select jsonb_array_elements_text($2 -> ''tags''))::uuid[]))' end,
    case when p_filters ? 'min' then
      'and t.amount_base >= ($2 ->> ''min'')::bigint' end,
    case when p_filters ? 'max' then
      'and t.amount_base <= ($2 ->> ''max'')::bigint' end,
    case when p_filters ? 'q' and char_length(p_filters ->> 'q') >= 3 then
      'and ((coalesce(t.payee, '''') || '' '' || coalesce(t.note, '''')) ilike private.like_pattern($2 ->> ''q'')
            or ($2 ->> ''q'') operator(extensions.<%) (coalesce(t.payee, '''') || '' '' || coalesce(t.note, '''')))'
    when p_filters ? 'q' then
      'and (coalesce(t.payee, '''') || '' '' || coalesce(t.note, '''')) ilike private.like_pattern($2 ->> ''q'')' end
  )
$$;

-- Keyset sahifa: (occurred_on, id) bo'yicha kamayish (transactions_list_idx);
-- birinchi sahifa — cheksiz kursor, shart doim qator taqqoslash (indeks).
create or replace function private.transactions_page(
  p_household uuid,
  p_filters jsonb,
  p_after_date date,
  p_after_id uuid,
  p_limit integer
)
returns setof public.transactions
language plpgsql
stable
security definer
set search_path = ''
-- Bitta harf xatosi (8 harfli so'zda ~0.55) ham topilsin; standart 0.6.
set pg_trgm.word_similarity_threshold = 0.5
as $$
begin
  if p_household not in (select private.my_household_ids()) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  return query execute format($q$
    select t.*
      from public.transactions t
     where t.household_id = $1 and t.deleted_at is null
       and (t.occurred_on, t.id) < ($3, $4)
       %s
     order by t.occurred_on desc, t.id desc
     limit $5
  $q$, private.transaction_filter_sql(p_filters))
  using p_household, p_filters, p_after_date, p_after_id, p_limit;
end;
$$;

-- Keyingi sahifa — oxirgi qatorning (sana, id) si. Teglar va chek belgisi
-- faqat shu sahifa qatorlari uchun (indekslardan).
create or replace function public.transactions_list(
  p_household uuid,
  p_filters jsonb default '{}',
  p_after_date date default null,
  p_after_id uuid default null,
  p_limit integer default 50
)
returns table (
  id uuid,
  kind public.transaction_kind,
  account_id uuid,
  to_account_id uuid,
  amount bigint,
  to_amount bigint,
  amount_base bigint,
  category_id uuid,
  payee text,
  occurred_on date,
  budget_month date,
  budget_month_source public.budget_month_source,
  planned_item_id uuid,
  debt_id uuid,
  note text,
  source public.transaction_source,
  created_by uuid,
  tag_ids uuid[],
  has_receipt boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select t.id, t.kind, t.account_id, t.to_account_id, t.amount, t.to_amount, t.amount_base,
         t.category_id, t.payee, t.occurred_on, t.budget_month, t.budget_month_source,
         t.planned_item_id, t.debt_id, t.note, t.source, t.created_by,
         coalesce((select array_agg(x.tag_id order by x.tag_id)
                     from public.transaction_tags x
                    where x.transaction_id = t.id and x.deleted_at is null), '{}'),
         exists (select 1 from public.attachments a
                  where a.transaction_id = t.id and a.deleted_at is null)
    from private.transactions_page(
           p_household,
           coalesce(p_filters, '{}'),
           coalesce(p_after_date, 'infinity'::date),
           coalesce(p_after_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid),
           least(greatest(coalesce(p_limit, 50), 1), 200)) t
   order by t.occurred_on desc, t.id desc
$$;

-- Filtr bo'yicha jami (asosiy valyutada): son, daromad, xarajat, o'tkazmalar.
create or replace function public.transactions_summary(p_household uuid, p_filters jsonb default '{}')
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set pg_trgm.word_similarity_threshold = 0.5
as $$
declare
  v_summary jsonb;
begin
  if p_household not in (select private.my_household_ids()) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  execute format($q$
    select jsonb_build_object(
             'count', count(*),
             'income', coalesce(sum(t.amount_base) filter (where t.kind = 'income'), 0),
             'expense', coalesce(sum(t.amount_base) filter (where t.kind = 'expense'), 0),
             'transfer', coalesce(sum(t.amount_base) filter (where t.kind = 'transfer'), 0)
           )
      from public.transactions t
     where t.household_id = $1 and t.deleted_at is null
       %s
  $q$, private.transaction_filter_sql(coalesce(p_filters, '{}')))
  into v_summary
  using p_household, coalesce(p_filters, '{}');
  return v_summary;
end;
$$;

-- Ommaviy amallar (BR-183): kategoriyani almashtirish, teg qo'shish yoki
-- o'chirish — bitta so'rov, bitta tranzaksiya. Har qator o'z savepoint'ida — biri rad etilsa
-- (yopilgan oy, tur mos emas) qolganlari bajariladi; natija — nima bo'ldi.
create or replace function public.bulk_transactions(
  p_household uuid,
  p_ids uuid[],
  p_action text,
  p_value uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_done uuid[] := '{}'::uuid[];
  v_skipped jsonb := '[]'::jsonb;
  v_count integer;
begin
  if p_household not in (select private.my_writable_household_ids()) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  if p_action not in ('set_category', 'add_tag', 'delete') then
    raise exception 'invalid_action' using errcode = 'P0001';
  end if;
  if p_action in ('set_category', 'add_tag') and p_value is null then
    raise exception 'invalid_action' using errcode = 'P0001';
  end if;
  if coalesce(cardinality(p_ids), 0) > 500 then
    raise exception 'invalid_batch' using errcode = 'P0001';
  end if;

  foreach v_id in array coalesce(p_ids, '{}') loop
    begin
      if p_action = 'set_category' then
        update public.transactions t set category_id = p_value
         where t.household_id = p_household and t.id = v_id and t.deleted_at is null;
        get diagnostics v_count = row_count;
      elsif p_action = 'delete' then
        update public.transactions t set deleted_at = now()
         where t.household_id = p_household and t.id = v_id and t.deleted_at is null;
        get diagnostics v_count = row_count;
      else
        select count(*) into v_count from public.transactions t
         where t.household_id = p_household and t.id = v_id and t.deleted_at is null;
        -- Teg allaqachon bo'lsa — o'zgarishsiz muvaffaqiyat (idempotent).
        if v_count > 0 then
          insert into public.transaction_tags (household_id, transaction_id, tag_id)
          values (p_household, v_id, p_value)
          on conflict (transaction_id, tag_id) where deleted_at is null do nothing;
        end if;
      end if;
      if v_count = 0 then
        v_skipped := v_skipped || jsonb_build_object('id', v_id, 'reason', 'not_found');
      else
        v_done := v_done || v_id;
      end if;
    exception when others then
      -- Biznes xatolar (P0001) — kod; boshqalari (FK, cheklov) — SQLSTATE.
      v_skipped := v_skipped || jsonb_build_object(
        'id', v_id,
        'reason', case when sqlstate = 'P0001' then sqlerrm else sqlstate end
      );
    end;
  end loop;

  return jsonb_build_object('done', to_jsonb(v_done), 'skipped', v_skipped);
end;
$$;

-- Filtr yordamchilari faqat security definer ichida — grant kerak emas.
grant execute on function private.transactions_page(uuid, jsonb, date, uuid, integer) to authenticated;

grant execute on function
  public.transactions_list(uuid, jsonb, date, uuid, integer),
  public.transactions_summary(uuid, jsonb),
  public.bulk_transactions(uuid, uuid[], text, uuid)
to authenticated;
