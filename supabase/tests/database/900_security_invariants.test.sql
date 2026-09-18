-- Umumiy xavfsizlik invariantlari (har yangi migratsiyadan keyin ham to'g'ri
-- bo'lishi shart). Fayl oxirida ishlaydi (900_).
begin;
select plan(7);

select is_empty(
  $$ select c.relname
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relkind in ('r', 'p')
        and not c.relrowsecurity $$,
  'public dagi barcha jadvallarda RLS yoqilgan (BR-210)'
);

select is_empty(
  $$ select p.oid::regprocedure::text
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'private', 'jobs')
        and p.prosecdef
        and not exists (
          select 1 from unnest(coalesce(p.proconfig, '{}')) as cfg
           where cfg like 'search_path=%'
        ) $$,
  'security definer funksiyalarning barchasida search_path belgilangan'
);

select is_empty(
  $$ select p.oid::regprocedure::text
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and has_function_privilege('anon', p.oid, 'execute')
        and p.proname not in ('health') $$,
  'anon faqat ruxsat etilgan RPC''larni chaqira oladi (health)'
);

-- ─── Sinxron jadvallar (row_version) ───────────────────────────────────────
-- pg_catalog + oid: nom bo'yicha regclass o'girish filtrdan oldin baholanib,
-- boshqa sxemadagi jadval nomida yiqilmasin.
create temporary view public_columns as
  select c.oid as rel, c.relname as table_name, a.attname as column_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
   where n.nspname = 'public' and c.relkind = 'r';

select is_empty(
  $$ select t.table_name from public_columns t
      where t.column_name = 'row_version'
        and not exists (
          select 1 from pg_trigger g
           where g.tgrelid = t.rel
             and g.tgfoid in ('private.touch_synced_row'::regproc, 'private.touch_household_row'::regproc)
        ) $$,
  'row_version ustunli har jadvalda touch triggeri bor (sinxron kursori)'
);

select is_empty(
  $$ select t.table_name from public_columns t
      where t.column_name = 'row_version'
        and not exists (select 1 from pg_trigger g where g.tgrelid = t.rel and g.tgfoid = 'private.audit'::regproc) $$,
  'sinxron jadvallarda audit triggeri bor (BR-008)'
);

select is_empty(
  $$ select t.table_name from public_columns t
      where t.column_name = 'row_version'
        and exists (select 1 from public_columns h where h.rel = t.rel and h.column_name = 'household_id')
        and not exists (
          select 1 from pg_index i
           where i.indrelid = t.rel
             and pg_get_indexdef(i.indexrelid) like '%(household_id, row_version)%'
        ) $$,
  'sinxron jadvallarda (household_id, row_version) indeksi bor (sync_pull)'
);

select is_empty(
  $$ select t.table_name from public_columns t
      where t.column_name = 'deleted_at'
        and has_table_privilege('authenticated', t.rel, 'delete') $$,
  'soft delete jadvallarida klient DELETE qila olmaydi (tombstone sinxronga yetadi)'
);

select * from finish();
rollback;
