-- Umumiy xavfsizlik invariantlari (har yangi migratsiyadan keyin ham to'g'ri
-- bo'lishi shart). Fayl oxirida ishlaydi (900_).
begin;
select plan(10);

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

-- ─── Supabase Advisor qoidalari (E28-T02) ──────────────────────────────────
-- `auth_rls_initplan`: siyosatda `auth.uid()` har qatorda emas, so'rovga bir
-- marta baholanishi kerak — `(select auth.uid())` ko'rinishida.
select is_empty(
  $$ select p.tablename || '.' || p.policyname
       from pg_policies p
      where p.schemaname = 'public'
        and (coalesce(p.qual, '') ~ 'auth\.uid\(\)'
             or coalesce(p.with_check, '') ~ 'auth\.uid\(\)')
        and not (coalesce(p.qual, '') ~ '\( SELECT auth\.uid\(\)'
                 or coalesce(p.with_check, '') ~ '\( SELECT auth\.uid\(\)') $$,
  'RLS siyosatlarida auth.uid() so''rovga bir marta baholanadi (initplan)'
);

-- `multiple_permissive_policies`: bir amal uchun bir nechta permissive siyosat
-- har qatorda ikki marta tekshiriladi.
select is_empty(
  $$ select p.tablename || ':' || p.cmd
       from pg_policies p
      where p.schemaname = 'public' and p.permissive = 'PERMISSIVE'
      group by p.tablename, p.cmd having count(*) > 1 $$,
  'bir jadval + amal uchun bitta permissive siyosat'
);

-- `duplicate_index`: bir xil ustunlar va shart bo'yicha ikkinchi indeks —
-- ortiqcha yozuv yuklamasi.
select is_empty(
  $$ select a.indrelid::regclass::text
       from pg_index a
       join pg_index b on a.indrelid = b.indrelid and a.indexrelid < b.indexrelid
       join pg_class c on c.oid = a.indrelid
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and a.indkey = b.indkey
        and pg_get_expr(a.indpred, a.indrelid) is not distinct from pg_get_expr(b.indpred, b.indrelid) $$,
  'takroriy indeks yo''q'
);

select * from finish();
rollback;
