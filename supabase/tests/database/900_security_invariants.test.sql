-- Umumiy xavfsizlik invariantlari (har yangi migratsiyadan keyin ham to'g'ri
-- bo'lishi shart). Fayl oxirida ishlaydi (900_).
begin;
select plan(3);

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

select * from finish();
rollback;
