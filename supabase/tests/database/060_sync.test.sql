-- E10-T01..T03: sinxron — pull (kursor, sahifalash, tombstone, resync) va
-- push (idempotent, versiya to'qnashuvi, rad etish, oq ro'yxat = grant'lar).
-- Qoidalar: BR-006, BR-007, BR-011, BR-063, BR-210; ARXITEKTURA 6.
begin;
select plan(21);

-- ─── Tayyorgarlik ──────────────────────────────────────────────────────────
create temporary table u (name text primary key, id uuid) on commit drop;
insert into u values
  ('alice', tests.create_user('alice@test.uz')),
  ('bob',   tests.create_user('bob@test.uz')),
  ('carol', tests.create_user('carol@test.uz')),
  ('dave',  tests.create_user('dave@test.uz'));
grant select on u to authenticated;

create temporary table ref (name text primary key, id uuid) on commit drop;
grant all on ref to authenticated;
insert into ref select 'h', p.last_household_id from public.profiles p
  where p.user_id = (select id from u where name = 'alice');
insert into ref select 'h_dave', p.last_household_id from public.profiles p
  where p.user_id = (select id from u where name = 'dave');
insert into ref select a.type::text, a.id from public.accounts a
  where a.household_id = (select id from ref where name = 'h');
insert into ref select 'c_' || lower(c.name), c.id from public.categories c
  where c.household_id = (select id from ref where name = 'h') and c.name in ('Avans', 'Oziq-ovqat');
insert into ref values ('tx', '01990000-0000-7000-8000-00000000a001'), ('m1', '01990000-0000-7000-8000-00000000b001'),
                       ('m2', '01990000-0000-7000-8000-00000000b002'), ('m3', '01990000-0000-7000-8000-00000000b003');

-- Kursorlar va javoblar.
create temporary table r (name text primary key, v jsonb) on commit drop;
grant all on r to authenticated;

select tests.authenticate_as((select id from u where name = 'alice'));
create temporary table inv (role text primary key, code text) on commit drop;
grant all on inv to authenticated;
insert into inv select 'member', code from public.create_invite((select id from ref where name = 'h'), 'member');
insert into inv select 'viewer', code from public.create_invite((select id from ref where name = 'h'), 'viewer');
select tests.authenticate_as((select id from u where name = 'bob'));
select public.accept_invite((select code from inv where role = 'member'));
select tests.authenticate_as((select id from u where name = 'carol'));
select public.accept_invite((select code from inv where role = 'viewer'));

-- ─── Pull ──────────────────────────────────────────────────────────────────
select tests.authenticate_as((select id from u where name = 'dave'));
select throws_ok(
  $$ select public.sync_pull((select id from ref where name = 'h'), 0) $$,
  'P0001', 'forbidden', 'BR-210: begona byudjetni sinxronlab bo''lmaydi'
);

select tests.authenticate_as((select id from u where name = 'bob'));
insert into r select 'full', public.sync_pull((select id from ref where name = 'h'), 0);
select results_eq(
  $$ select jsonb_array_length(v -> 'changes'),
            (select count(*)::int from jsonb_array_elements(v -> 'changes') c where c ->> 't' = 'households'),
            (select count(*)::int from jsonb_array_elements(v -> 'changes') c where c ->> 't' = 'accounts'),
            (select count(*)::int from jsonb_array_elements(v -> 'changes') c where c ->> 't' = 'categories'),
            (v ->> 'has_more')::boolean, (v ->> 'resync_required')::boolean
       from r where name = 'full' $$,
  $$ values (22, 1, 3, 18, false, false) $$,
  'birinchi yuklash: byudjet + standart hisoblar va kategoriyalar'
);
insert into r select 'p1', public.sync_pull((select id from ref where name = 'h'), 0, 5);
insert into r select 'p2', public.sync_pull((select id from ref where name = 'h'), (select (v ->> 'next_cursor')::bigint from r where name = 'p1'), 5);
select results_eq(
  $$ select jsonb_array_length(a.v -> 'changes'), (a.v ->> 'has_more')::boolean,
            (b.v #>> '{changes,0,row,row_version}')::bigint > (a.v ->> 'next_cursor')::bigint,
            (a.v ->> 'next_cursor')::bigint = (a.v #>> '{changes,4,row,row_version}')::bigint
       from r a, r b where a.name = 'p1' and b.name = 'p2' $$,
  $$ values (5, true, true, true) $$,
  'sahifalash: limit, has_more, keyingi sahifa kursordan davom etadi (takrorsiz)'
);

select tests.authenticate_as((select id from u where name = 'alice'));
insert into public.transactions (id, household_id, kind, account_id, amount, category_id, occurred_on, budget_month)
  values ((select id from ref where name = 'tx'), (select id from ref where name = 'h'), 'expense',
          (select id from ref where name = 'card'), 1500000, (select id from ref where name = 'c_oziq-ovqat'),
          '2026-10-05', '2026-10-01');
select tests.authenticate_as((select id from u where name = 'bob'));
insert into r select 'inc', public.sync_pull((select id from ref where name = 'h'), (select (v ->> 'next_cursor')::bigint from r where name = 'full'));
select results_eq(
  $$ select jsonb_array_length(v -> 'changes'), v #>> '{changes,0,t}', v #>> '{changes,0,row,id}' from r where name = 'inc' $$,
  $$ values (1, 'transactions', '01990000-0000-7000-8000-00000000a001') $$,
  'BR-007: kursordan keyin faqat o''zgargan qator'
);

select tests.authenticate_as((select id from u where name = 'alice'));
update public.transactions set deleted_at = now() where id = (select id from ref where name = 'tx');
select tests.authenticate_as((select id from u where name = 'bob'));
insert into r select 'tomb', public.sync_pull((select id from ref where name = 'h'), (select (v ->> 'next_cursor')::bigint from r where name = 'inc'));
select ok(
  (select (v #>> '{changes,0,row,deleted_at}') is not null from r where name = 'tomb'),
  'o''chirish tombstone sifatida keladi'
);
select is(
  (select count(*)::int from jsonb_array_elements((public.sync_pull((select id from ref where name = 'h'), 0)) -> 'changes') c
    where c ->> 't' = 'transactions'),
  0, 'birinchi yuklashda tombstone''lar yuborilmaydi'
);

-- ─── Push ──────────────────────────────────────────────────────────────────
insert into r select 'push1', public.sync_push((select id from ref where name = 'h'), 'bob-phone', jsonb_build_array(
  jsonb_build_object('mutation_id', (select id from ref where name = 'm1'), 'table', 'transactions', 'op', 'upsert',
    'id', '01990000-0000-7000-8000-00000000a002', 'base_version', null, 'data', jsonb_build_object(
      'kind', 'income', 'account_id', (select id from ref where name = 'card'), 'amount', 50000000,
      'category_id', (select id from ref where name = 'c_avans'), 'occurred_on', '2026-10-16',
      'budget_month', '2026-01-01', 'amount_base', 1))));
select results_eq(
  $$ select v #>> '{results,0,status}', (v #>> '{results,0,row,amount_base}')::bigint, v #>> '{results,0,row,budget_month}',
            (v #>> '{results,0,row,created_by}')::uuid = (select id from u where name = 'bob')
       from r where name = 'push1' $$,
  $$ values ('ok', 50000000::bigint, '2026-10-01', true) $$,
  'push: yangi amal — kanonik qator (server oyi va asosiy summa, yozilmaydigan maydon e''tiborsiz)'
);
insert into r select 'push1b', public.sync_push((select id from ref where name = 'h'), 'bob-phone', jsonb_build_array(
  jsonb_build_object('mutation_id', (select id from ref where name = 'm1'), 'table', 'transactions', 'op', 'upsert',
    'id', '01990000-0000-7000-8000-00000000a002', 'data', jsonb_build_object('amount', 1))));
select is(
  (select v -> 'results' -> 0 from r where name = 'push1b'), (select v -> 'results' -> 0 from r where name = 'push1'),
  'idempotent: qayta yuborilgan mutatsiya — aynan oldingi natija'
);
select is(
  (select amount from public.transactions where id = '01990000-0000-7000-8000-00000000a002'), 50000000::bigint,
  'idempotent: qayta yuborish qatorni o''zgartirmadi'
);

insert into r select 'stale', public.sync_push((select id from ref where name = 'h'), 'bob-phone', jsonb_build_array(
  jsonb_build_object('mutation_id', gen_random_uuid(), 'table', 'transactions', 'op', 'upsert',
    'id', '01990000-0000-7000-8000-00000000a002', 'base_version', 1, 'data', jsonb_build_object('amount', 60000000))));
select results_eq(
  $$ select v #>> '{results,0,status}', (v #>> '{results,0,row,amount}')::bigint from r where name = 'stale' $$,
  $$ values ('conflict', 50000000::bigint) $$,
  'BR-006: eskirgan base_version — conflict va server qatori (jimgina ustiga yozilmaydi)'
);
insert into r select 'fresh', public.sync_push((select id from ref where name = 'h'), 'bob-phone', jsonb_build_array(
  jsonb_build_object('mutation_id', gen_random_uuid(), 'table', 'transactions', 'op', 'upsert',
    'id', '01990000-0000-7000-8000-00000000a002',
    'base_version', (select row_version from public.transactions where id = '01990000-0000-7000-8000-00000000a002'),
    'data', jsonb_build_object('amount', 60000000))));
select results_eq(
  $$ select v #>> '{results,0,status}', (v #>> '{results,0,row,amount}')::bigint,
            (v #>> '{results,0,row,row_version}')::bigint > (select (x.v #>> '{results,0,row,row_version}')::bigint from r x where x.name = 'push1')
       from r where name = 'fresh' $$,
  $$ values ('ok', 60000000::bigint, true) $$,
  'to''g''ri base_version — yangilanadi, versiya oshadi'
);

insert into r select 'rej', public.sync_push((select id from ref where name = 'h'), 'bob-phone', jsonb_build_array(
  jsonb_build_object('mutation_id', gen_random_uuid(), 'table', 'accounts', 'op', 'upsert',
    'id', gen_random_uuid(), 'data', jsonb_build_object('name', 'Bobniki', 'type', 'card', 'currency', 'UZS', 'opening_date', '2026-10-01')),
  jsonb_build_object('mutation_id', gen_random_uuid(), 'table', 'transactions', 'op', 'upsert',
    'id', gen_random_uuid(), 'data', jsonb_build_object('kind', 'income', 'account_id', (select id from ref where name = 'personal_fund'),
      'amount', 100, 'category_id', (select id from ref where name = 'c_avans'), 'occurred_on', '2026-10-01', 'budget_month', '2026-10-01')),
  jsonb_build_object('mutation_id', gen_random_uuid(), 'table', 'transactions', 'op', 'upsert',
    'id', gen_random_uuid(), 'data', jsonb_build_object('household_id', (select id from ref where name = 'h_dave'))),
  jsonb_build_object('mutation_id', gen_random_uuid(), 'table', 'months', 'op', 'upsert', 'id', gen_random_uuid()),
  jsonb_build_object('mutation_id', gen_random_uuid(), 'table', 'transactions', 'op', 'upsert',
    'id', gen_random_uuid(), 'base_version', 5, 'data', jsonb_build_object('amount', 1))
));
select results_eq(
  $$ select x ->> 'status', x ->> 'code' from r, jsonb_array_elements(v -> 'results') with ordinality as t (x, n)
      where name = 'rej' order by n $$,
  $$ values ('rejected', '42501'), ('rejected', 'invalid_account'), ('rejected', 'household_mismatch'),
            ('rejected', 'invalid_mutation'), ('rejected', 'not_found') $$,
  'rad etish: huquq (member hisob yoza olmaydi), biznes qoida (BR-063), boshqa byudjet, jadval, yo''q qator'
);
select is(
  (select count(*)::int from public.accounts where household_id = (select id from ref where name = 'h') and name = 'Bobniki'),
  0, 'rad etilgan mutatsiya hech narsa yozmaydi (savepoint)'
);

insert into r select 'del', public.sync_push((select id from ref where name = 'h'), 'bob-phone', jsonb_build_array(
  jsonb_build_object('mutation_id', (select id from ref where name = 'm2'), 'table', 'transactions', 'op', 'delete',
    'id', '01990000-0000-7000-8000-00000000a002')));
select ok(
  (select (v #>> '{results,0,row,deleted_at}') is not null and v #>> '{results,0,status}' = 'ok' from r where name = 'del'),
  'delete — soft delete (tombstone)'
);

select throws_ok(
  $$ select public.sync_push((select id from ref where name = 'h'), 'bob-phone',
       (select jsonb_agg(jsonb_build_object('mutation_id', gen_random_uuid())) from generate_series(1, 101))) $$,
  'P0001', 'invalid_batch', 'paketda 100 dan ortiq mutatsiya — rad'
);

select tests.authenticate_as((select id from u where name = 'carol'));
insert into r select 'viewer', public.sync_push((select id from ref where name = 'h'), 'carol-phone', jsonb_build_array(
  jsonb_build_object('mutation_id', (select id from ref where name = 'm3'), 'table', 'transactions', 'op', 'upsert',
    'id', gen_random_uuid(), 'data', jsonb_build_object('kind', 'expense', 'account_id', (select id from ref where name = 'card'),
      'amount', 100, 'category_id', (select id from ref where name = 'c_oziq-ovqat'), 'occurred_on', '2026-10-01',
      'budget_month', '2026-10-01'))));
select results_eq(
  $$ select v #>> '{results,0,status}', v #>> '{results,0,code}' from r where name = 'viewer' $$,
  $$ values ('rejected', '42501') $$,
  'BR-011: viewer push — rad (RLS)'
);

-- ─── Jurnal ────────────────────────────────────────────────────────────────
select tests.authenticate_as((select id from u where name = 'alice'));
select results_eq(
  $$ select status, device_id from public.sync_mutations
      where mutation_id in ((select id from ref where name = 'm1'), (select id from ref where name = 'm3'))
      order by device_id $$,
  $$ values ('ok', 'bob-phone'), ('rejected', 'carol-phone') $$,
  'jurnal: owner mutatsiyalar natijasini ko''radi (qurilma bilan)'
);
select tests.authenticate_as((select id from u where name = 'bob'));
select is_empty(
  $$ select 1 from public.sync_mutations $$,
  'jurnal faqat owner/admin uchun'
);
select throws_ok(
  $$ insert into public.sync_mutations (mutation_id, household_id, device_id, table_name, record_id, status, result)
     values (gen_random_uuid(), (select id from ref where name = 'h'), 'x', 'transactions', gen_random_uuid(), 'ok', '{}') $$,
  '42501', null, 'jurnalga klient to''g''ridan-to''g''ri yoza olmaydi'
);

-- ─── Resync ────────────────────────────────────────────────────────────────
select tests.clear_authentication();
update public.households set purged_version = (select (v ->> 'next_cursor')::bigint from r where name = 'full') + 1
 where id = (select id from ref where name = 'h');
select tests.authenticate_as((select id from u where name = 'bob'));
select results_eq(
  $$ select (x ->> 'resync_required')::boolean, jsonb_array_length(x -> 'changes')
       from (select public.sync_pull((select id from ref where name = 'h'),
                                     (select (v ->> 'next_cursor')::bigint from r where name = 'full')) as x) s $$,
  $$ values (true, 0) $$,
  'tozalangan tombstone''lardan eski kursor — to''liq qayta yuklash (resync_required)'
);
select results_eq(
  $$ select (x ->> 'resync_required')::boolean from (select public.sync_pull((select id from ref where name = 'h'), 0) as x) s $$,
  $$ values (false) $$,
  'qayta yuklash (kursor 0) ishlaydi'
);

select * from finish();
rollback;
