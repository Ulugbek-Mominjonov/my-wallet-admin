-- E10-T01..T03: sinxron protokoli — pull (kursor) va push (paket, idempotent,
-- versiya tekshiruvi). ARXITEKTURA 6; qoidalar: BR-006, BR-007; ADR-07, ADR-09.
--
-- O'chirish — hamma sinxron jadvalda soft delete (`deleted_at`): pull
-- tombstone'larni ham beradi. RLS faqat a'zolikni tekshiradi; o'chirilganlarni
-- ekranda ko'rsatmaslik — klient vazifasi (`deleted_at=is.null`), chunki
-- sinxron va "bekor qilish" (BR-009) ularni ko'rishi kerak.

-- Tombstone tozalangan eng katta versiya: bundan eski kursor — to'liq qayta yuklash.
alter table public.households add column purged_version bigint not null default 0;

-- ─── Sinxron jadvallar ─────────────────────────────────────────────────────
-- household_id + row_version bo'lgan jadvallar (byudjetning o'zi — alohida).
create or replace function private.sync_tables()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'accounts', 'categories', 'recurring_rules', 'category_limits', 'quick_actions', 'tags',
    'debts', 'goals', 'months', 'planned_items', 'transactions', 'transaction_tags', 'attachments'
  ]
$$;

-- Pull paketining eng katta hajmi va push paketidagi mutatsiyalar chegarasi.
create or replace function private.sync_pull_max()
returns integer
language sql
immutable
set search_path = ''
as $$ select 500 $$;

create or replace function private.sync_push_max()
returns integer
language sql
immutable
set search_path = ''
as $$ select 100 $$;

grant execute on function private.sync_tables(), private.sync_pull_max(), private.sync_push_max()
  to authenticated;

-- ─── Idempotentlik jurnali ─────────────────────────────────────────────────
-- Qo'llangan mutatsiya natijasi: qayta yuborilsa aynan shu javob qaytadi.
-- 30 kun saqlanadi (jobs.purge). Klient yoza olmaydi — faqat sync_push.
create table public.sync_mutations (
  mutation_id  uuid primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  user_id      uuid references auth.users (id) on delete set null,
  device_id    text not null check (char_length(device_id) between 1 and 100),
  table_name   text not null,
  record_id    uuid not null,
  status       text not null check (status in ('ok', 'conflict', 'rejected')),
  result       jsonb not null,
  applied_at   timestamptz not null default now()
);

comment on table public.sync_mutations is 'ARXITEKTURA 6: sync_push idempotentligi va to''qnashuv/rad etish jurnali (30 kun).';

-- Admin "Qurilmalar va sinxron" sahifasi (E25-T07) va tozalash.
create index sync_mutations_household_idx on public.sync_mutations (household_id, applied_at desc);

alter table public.sync_mutations enable row level security;
create policy sync_mutations_select on public.sync_mutations for select to authenticated
  using (household_id in (select private.my_admin_household_ids()));
revoke all on public.sync_mutations from authenticated;
grant select on public.sync_mutations to authenticated;

create or replace function private.sync_mutation_get(p_mutation uuid, p_household uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select m.result from public.sync_mutations m
   where m.mutation_id = p_mutation and m.household_id = p_household
$$;

create or replace function private.sync_mutation_put(
  p_mutation uuid,
  p_household uuid,
  p_device text,
  p_table text,
  p_record uuid,
  p_result jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.sync_mutations (mutation_id, household_id, user_id, device_id, table_name, record_id, status, result)
  values (p_mutation, p_household, (select auth.uid()), p_device, p_table, p_record, p_result ->> 'status', p_result)
  on conflict (mutation_id) do nothing
$$;

grant execute on function
  private.sync_mutation_get(uuid, uuid),
  private.sync_mutation_put(uuid, uuid, text, text, uuid, jsonb)
to authenticated;

-- ─── Pull (ARXITEKTURA 6) ──────────────────────────────────────────────────
-- Har jadval `(household_id, row_version)` indeksi bo'yicha LIMIT bilan,
-- keyin umumiy tartib. Birinchi yuklashda (kursor 0) tombstone'lar kerak emas.
create or replace function public.sync_pull(p_household uuid, p_cursor bigint, p_limit integer default 500)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, private.sync_pull_max()), 1), private.sync_pull_max());
  v_cursor bigint := greatest(coalesce(p_cursor, 0), 0);
  v_initial boolean := coalesce(p_cursor, 0) <= 0;
  v_changes jsonb;
  v_count integer;
  v_next bigint;
begin
  if p_household not in (select private.my_household_ids()) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  if not v_initial and v_cursor < (select h.purged_version from public.households h where h.id = p_household) then
    return jsonb_build_object('changes', '[]'::jsonb, 'next_cursor', 0, 'has_more', false, 'resync_required', true);
  end if;

  with batch as (
    select c.t, c.v, c.r
      from (
        (select 'households' as t, x.row_version as v, to_jsonb(x) as r from public.households x
          where x.id = p_household and x.row_version > v_cursor)
        union all
        (select 'accounts', x.row_version, to_jsonb(x) from public.accounts x
          where x.household_id = p_household and x.row_version > v_cursor and (not v_initial or x.deleted_at is null)
          order by x.row_version limit v_limit)
        union all
        (select 'categories', x.row_version, to_jsonb(x) from public.categories x
          where x.household_id = p_household and x.row_version > v_cursor and (not v_initial or x.deleted_at is null)
          order by x.row_version limit v_limit)
        union all
        (select 'recurring_rules', x.row_version, to_jsonb(x) from public.recurring_rules x
          where x.household_id = p_household and x.row_version > v_cursor and (not v_initial or x.deleted_at is null)
          order by x.row_version limit v_limit)
        union all
        (select 'category_limits', x.row_version, to_jsonb(x) from public.category_limits x
          where x.household_id = p_household and x.row_version > v_cursor and (not v_initial or x.deleted_at is null)
          order by x.row_version limit v_limit)
        union all
        (select 'quick_actions', x.row_version, to_jsonb(x) from public.quick_actions x
          where x.household_id = p_household and x.row_version > v_cursor and (not v_initial or x.deleted_at is null)
          order by x.row_version limit v_limit)
        union all
        (select 'tags', x.row_version, to_jsonb(x) from public.tags x
          where x.household_id = p_household and x.row_version > v_cursor and (not v_initial or x.deleted_at is null)
          order by x.row_version limit v_limit)
        union all
        (select 'debts', x.row_version, to_jsonb(x) from public.debts x
          where x.household_id = p_household and x.row_version > v_cursor and (not v_initial or x.deleted_at is null)
          order by x.row_version limit v_limit)
        union all
        (select 'goals', x.row_version, to_jsonb(x) from public.goals x
          where x.household_id = p_household and x.row_version > v_cursor and (not v_initial or x.deleted_at is null)
          order by x.row_version limit v_limit)
        union all
        (select 'months', x.row_version, to_jsonb(x) from public.months x
          where x.household_id = p_household and x.row_version > v_cursor
          order by x.row_version limit v_limit)
        union all
        (select 'planned_items', x.row_version, to_jsonb(x) from public.planned_items x
          where x.household_id = p_household and x.row_version > v_cursor and (not v_initial or x.deleted_at is null)
          order by x.row_version limit v_limit)
        union all
        (select 'transactions', x.row_version, to_jsonb(x) from public.transactions x
          where x.household_id = p_household and x.row_version > v_cursor and (not v_initial or x.deleted_at is null)
          order by x.row_version limit v_limit)
        union all
        (select 'transaction_tags', x.row_version, to_jsonb(x) from public.transaction_tags x
          where x.household_id = p_household and x.row_version > v_cursor and (not v_initial or x.deleted_at is null)
          order by x.row_version limit v_limit)
        union all
        (select 'attachments', x.row_version, to_jsonb(x) from public.attachments x
          where x.household_id = p_household and x.row_version > v_cursor and (not v_initial or x.deleted_at is null)
          order by x.row_version limit v_limit)
      ) c
     order by c.v
     limit v_limit
  )
  select coalesce(jsonb_agg(jsonb_build_object('t', b.t, 'row', b.r) order by b.v), '[]'::jsonb),
         count(*), max(b.v)
    into v_changes, v_count, v_next
    from batch b;

  return jsonb_build_object(
    'changes', v_changes,
    'next_cursor', coalesce(v_next, v_cursor),
    'has_more', v_count = v_limit,
    'resync_required', false
  );
end;
$$;

-- ─── Push (ARXITEKTURA 6, BR-006) ──────────────────────────────────────────
-- Har mutatsiya o'z savepoint'ida (BEGIN … EXCEPTION):
--   1) mutation_id oldin qo'llangan → saqlangan natija (idempotent);
--   2) base_version ≠ serverdagi → conflict + server qatori;
--   3) yoziladi (RLS, ustun huquqlari, triggerlar) → ok + kanonik qator;
--   4) cheklov/huquq xatosi → rejected + kod va matn.
-- Yoziladigan maydonlar — foydalanuvchining ustun huquqlari (grant'lar) bilan
-- aynan bir xil: alohida oq ro'yxat yuritilmaydi, boshqa kalitlar e'tiborsiz.
create or replace function public.sync_push(p_household uuid, p_device text, p_mutations jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_mutation jsonb;
  v_results jsonb := '[]'::jsonb;
  v_result jsonb;
  v_id uuid;
  v_mutation_id uuid;
  v_table text;
  v_op text;
  v_base bigint;
  v_data jsonb;
  v_rel regclass;
  v_current bigint;
  v_exists boolean;
  v_columns text[];
  v_row jsonb;
begin
  if p_household not in (select private.my_household_ids()) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_mutations) <> 'array' or jsonb_array_length(p_mutations) > private.sync_push_max() then
    raise exception 'invalid_batch' using errcode = 'P0001';
  end if;
  if char_length(coalesce(p_device, '')) not between 1 and 100 then
    raise exception 'invalid_device' using errcode = 'P0001';
  end if;

  for v_mutation in select * from jsonb_array_elements(p_mutations) loop
    v_mutation_id := (v_mutation ->> 'mutation_id')::uuid;
    v_table := v_mutation ->> 'table';
    v_op := v_mutation ->> 'op';
    v_id := (v_mutation ->> 'id')::uuid;
    v_base := (v_mutation ->> 'base_version')::bigint;
    v_data := coalesce(v_mutation -> 'data', '{}'::jsonb);

    v_result := private.sync_mutation_get(v_mutation_id, p_household);
    if v_result is not null then
      v_results := v_results || v_result;
      continue;
    end if;

    if v_table is null or not (v_table = any (private.sync_tables())) or v_table = 'months'
       or v_op not in ('upsert', 'delete') or v_id is null then
      v_result := jsonb_build_object('mutation_id', v_mutation_id, 'status', 'rejected',
                                     'code', 'invalid_mutation', 'message', 'table/op/id');
    elsif v_data ? 'household_id' and (v_data ->> 'household_id')::uuid is distinct from p_household then
      v_result := jsonb_build_object('mutation_id', v_mutation_id, 'status', 'rejected',
                                     'code', 'household_mismatch', 'message', 'household_id');
    else
      v_rel := format('public.%I', v_table)::regclass;
      begin
        execute format('select row_version from %s where id = $1 and household_id = $2', v_rel)
          into v_current using v_id, p_household;
        v_exists := v_current is not null;

        if v_exists and ((v_base is null and v_op = 'upsert') or (v_base is not null and v_base <> v_current)) then
          execute format('select to_jsonb(x) from %s x where x.id = $1', v_rel) into v_row using v_id;
          v_result := jsonb_build_object('mutation_id', v_mutation_id, 'status', 'conflict', 'row', v_row);
        elsif not v_exists and v_base is not null then
          v_result := jsonb_build_object('mutation_id', v_mutation_id, 'status', 'rejected',
                                         'code', 'not_found', 'message', 'row');
        elsif v_op = 'delete' then
          if v_exists then
            execute format('update %s set deleted_at = coalesce(deleted_at, now()) where id = $1', v_rel) using v_id;
          end if;
          execute format('select to_jsonb(x) from %s x where x.id = $1', v_rel) into v_row using v_id;
          v_result := jsonb_build_object('mutation_id', v_mutation_id, 'status', 'ok', 'row', v_row);
        else
          -- Yoziladigan ustunlar: data kalitlari ∩ foydalanuvchining ustun huquqi.
          select array_agg(a.attname::text order by a.attnum) into v_columns
            from pg_catalog.pg_attribute a
           where a.attrelid = v_rel and a.attnum > 0 and not a.attisdropped
             and a.attname not in ('id', 'household_id')
             and v_data ? a.attname
             and has_column_privilege(v_rel, a.attnum, case when v_exists then 'UPDATE' else 'INSERT' end);

          if not v_exists then
            execute format(
              'insert into %s (id, household_id%s) select $1, $2%s from jsonb_populate_record(null::%s, $3) r',
              v_rel,
              coalesce(', ' || (select string_agg(format('%I', c), ', ') from unnest(v_columns) c), ''),
              coalesce(', ' || (select string_agg(format('r.%I', c), ', ') from unnest(v_columns) c), ''),
              v_rel
            ) using v_id, p_household, v_data;
          elsif v_columns is not null then
            execute format(
              'update %s t set (%s) = (select %s from jsonb_populate_record(null::%s, $1) r) where t.id = $2',
              v_rel,
              (select string_agg(format('%I', c), ', ') from unnest(v_columns) c),
              (select string_agg(format('r.%I', c), ', ') from unnest(v_columns) c),
              v_rel
            ) using v_data, v_id;
          end if;
          execute format('select to_jsonb(x) from %s x where x.id = $1', v_rel) into v_row using v_id;
          v_result := jsonb_build_object('mutation_id', v_mutation_id, 'status', 'ok', 'row', v_row);
        end if;
      exception when others then
        v_result := jsonb_build_object(
          'mutation_id', v_mutation_id, 'status', 'rejected',
          'code', case when sqlstate = 'P0001' then sqlerrm else sqlstate end,
          'message', sqlerrm
        );
      end;
    end if;

    perform private.sync_mutation_put(v_mutation_id, p_household, p_device, coalesce(v_table, '?'),
                                      coalesce(v_id, '00000000-0000-0000-0000-000000000000'::uuid), v_result);
    v_results := v_results || v_result;
  end loop;

  return jsonb_build_object('results', v_results);
end;
$$;

grant execute on function
  public.sync_pull(uuid, bigint, integer),
  public.sync_push(uuid, text, jsonb)
to authenticated;
