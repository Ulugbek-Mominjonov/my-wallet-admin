-- E25-T07: a'zolar qurilmalari va sinxron holati (oxirgi sinxron, versiya,
-- to'qnashuv/rad etish sonlari). Qoidalar: BR-011, ARXITEKTURA 6.
begin;
select plan(5);

create temporary table u (name text primary key, id uuid) on commit drop;
insert into u values
  ('alice', tests.create_user('alice@test.uz')),
  ('bob',   tests.create_user('bob@test.uz'));
grant select on u to authenticated;

create temporary table ref (name text primary key, id uuid) on commit drop;
grant all on ref to authenticated;
insert into ref select 'h', p.last_household_id from public.profiles p
  where p.user_id = (select id from u where name = 'alice');
insert into ref select a.type::text, a.id from public.accounts a
  where a.household_id = (select id from ref where name = 'h');
insert into ref select 'c_avans', c.id from public.categories c
  where c.household_id = (select id from ref where name = 'h') and c.name = 'Avans';

create temporary table r (name text primary key, v jsonb) on commit drop;
grant all on r to authenticated;

select tests.authenticate_as((select id from u where name = 'alice'));
create temporary table inv (code text) on commit drop;
grant all on inv to authenticated;
insert into inv select code from public.create_invite((select id from ref where name = 'h'), 'member');

-- Bob: qurilmasini ro'yxatdan o'tkazadi va bitta paket yuboradi (ok + rad etilgan).
select tests.authenticate_as((select id from u where name = 'bob'));
select public.accept_invite((select code from inv));
select public.register_device('bob-fcm-token-0123456789', 'android', '1.2.3');
select public.sync_push((select id from ref where name = 'h'), 'bob-phone', jsonb_build_array(
  jsonb_build_object('mutation_id', gen_random_uuid(), 'table', 'transactions', 'op', 'upsert',
    'id', gen_random_uuid(), 'data', jsonb_build_object(
      'kind', 'income', 'account_id', (select id from ref where name = 'card'), 'amount', 50000000,
      'category_id', (select id from ref where name = 'c_avans'), 'occurred_on', '2026-10-16',
      'budget_month', '2026-10-01')),
  jsonb_build_object('mutation_id', gen_random_uuid(), 'table', 'months', 'op', 'upsert',
    'id', gen_random_uuid())));

select throws_ok(
  $$ select public.household_devices((select id from ref where name = 'h')) $$,
  'P0001', 'forbidden', 'BR-011: qurilmalar ro''yxati — owner/admin'
);

select tests.authenticate_as((select id from u where name = 'alice'));
insert into r select 'devices', public.household_devices((select id from ref where name = 'h'));

select results_eq(
  $$ select jsonb_array_length(v -> 'devices'), v #>> '{devices,0,platform}',
            v #>> '{devices,0,app_version}',
            (v #>> '{devices,0,user_id}')::uuid = (select id from u where name = 'bob')
       from r where name = 'devices' $$,
  $$ values (1, 'android', '1.2.3', true) $$,
  'a''zoning qurilmasi ko''rinadi: platforma va ilova versiyasi'
);
select ok(
  (select not (v #> '{devices,0}') ? 'token' from r where name = 'devices'),
  'push tokeni qaytmaydi (shaxsiy)'
);
select results_eq(
  $$ select v #>> '{sync,0,device_id}', (v #>> '{sync,0,ok}')::int, (v #>> '{sync,0,rejected}')::int,
            (v #>> '{sync,0,conflicts}')::int
       from r where name = 'devices' $$,
  $$ values ('bob-phone', 1, 1, 0) $$,
  'sinxron holati: qurilma bo''yicha ok va rad etilganlar soni'
);
select ok(
  (select (v #>> '{sync,0,last_sync_at}')::timestamptz > now() - interval '1 minute'
     from r where name = 'devices'),
  'oxirgi sinxron vaqti'
);

select * from finish();
rollback;
