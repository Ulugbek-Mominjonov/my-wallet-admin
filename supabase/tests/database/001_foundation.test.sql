-- E01-T02 / E01-T03: asoslar — UUIDv7, sinxron triggeri, audit, huquqlar.
begin;
select plan(17);

-- ─── UUIDv7 ────────────────────────────────────────────────────────────────
select is(substring(private.uuid_v7()::text, 15, 1), '7', 'uuid_v7: versiya nibble = 7');
select ok(substring(private.uuid_v7()::text, 20, 1) in ('8', '9', 'a', 'b'), 'uuid_v7: RFC 9562 varianti (10xx)');

create temporary table uuid_probe as select private.uuid_v7() as first_id;
do $$ begin perform pg_sleep(0.005); end $$;
select ok(
  (select first_id from uuid_probe) < private.uuid_v7(),
  'uuid_v7: keyingi millisekunddagi qiymat kattaroq (vaqt bo''yicha tartiblangan)'
);

-- ─── Sinxron triggeri ──────────────────────────────────────────────────────
create table public.tmp_synced (
  id           uuid primary key default private.uuid_v7(),
  household_id uuid not null,
  name         text,
  row_version  bigint,
  updated_at   timestamptz
);
create trigger tmp_synced_touch before insert or update on public.tmp_synced
  for each row execute function private.touch_synced_row();

insert into public.tmp_synced (household_id, name) values (gen_random_uuid(), 'a');
select isnt((select row_version from public.tmp_synced), null, 'row_version INSERT da beriladi');
select isnt((select updated_at from public.tmp_synced), null, 'updated_at INSERT da beriladi');

create temporary table version_before as select row_version from public.tmp_synced;
update public.tmp_synced set name = 'b';
select ok(
  (select row_version from public.tmp_synced) > (select row_version from version_before),
  'row_version har UPDATE da o''sadi'
);

-- ─── Audit ─────────────────────────────────────────────────────────────────
create trigger tmp_synced_audit after insert or update or delete on public.tmp_synced
  for each row execute function private.audit();

insert into public.tmp_synced (household_id, name) values (gen_random_uuid(), 'audit');
select is(
  (select count(*)::int from public.audit_log where table_name = 'tmp_synced' and action = 'insert'),
  1, 'BR-008: INSERT jurnalga yoziladi'
);

update public.tmp_synced set name = 'audit-2' where name = 'audit';
select is(
  (select new_values from public.audit_log where table_name = 'tmp_synced' and action = 'update'),
  '{"name": "audit-2"}'::jsonb,
  'BR-008: UPDATE da faqat o''zgargan maydon (row_version/updated_at tashlanadi)'
);
select is(
  (select old_values from public.audit_log where table_name = 'tmp_synced' and action = 'update'),
  '{"name": "audit"}'::jsonb,
  'BR-008: UPDATE da eski qiymat saqlanadi'
);

update public.tmp_synced set name = name where name = 'audit-2';
select is(
  (select count(*)::int from public.audit_log where table_name = 'tmp_synced' and action = 'update'),
  1, 'BR-008: hech narsa o''zgarmagan UPDATE jurnalga tushmaydi'
);

delete from public.tmp_synced where name = 'audit-2';
select is(
  (select count(*)::int from public.audit_log where table_name = 'tmp_synced' and action = 'delete'),
  1, 'BR-008: DELETE jurnalga yoziladi'
);

set local app.skip_audit = 'on';
insert into public.tmp_synced (household_id, name) values (gen_random_uuid(), 'bulk');
select is(
  (select count(*)::int from public.audit_log where table_name = 'tmp_synced' and action = 'insert'),
  1, 'app.skip_audit=on — ommaviy ishlarda jurnal yozilmaydi'
);
reset app.skip_audit;

-- ─── Huquqlar (xavfsiz standartlar) ────────────────────────────────────────
create function public.tmp_rpc() returns int language sql as $$ select 1 $$;
select ok(not has_function_privilege('anon', 'public.tmp_rpc()', 'execute'),
  'public dagi yangi funksiya anon uchun avtomatik ochiq emas');
select ok(not has_function_privilege('authenticated', 'public.tmp_rpc()', 'execute'),
  'public dagi yangi funksiya authenticated uchun ham aniq grant talab qiladi');
select ok(not has_table_privilege('anon', 'public.tmp_synced', 'select'),
  'anon public jadvallarni umuman ko''rmaydi');
select ok(not has_table_privilege('authenticated', 'public.audit_log', 'insert'),
  'audit_log ga klient yoza olmaydi');
select ok(not has_schema_privilege('anon', 'private', 'usage'),
  'private sxema anon uchun yopiq');

select * from finish();
rollback;
