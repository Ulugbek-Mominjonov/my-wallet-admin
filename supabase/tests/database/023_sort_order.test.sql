-- E22-T01: set_sort_order — spravochnik tartibi bitta so'rovda (BR-011).
begin;
select plan(8);

create temporary table u (name text primary key, id uuid) on commit drop;
insert into u values
  ('alice', tests.create_user('alice@test.uz')),
  ('bob',   tests.create_user('bob@test.uz')),
  ('eve',   tests.create_user('eve@test.uz'));
grant select on u to authenticated;

create temporary table ref (name text primary key, id uuid) on commit drop;
grant all on ref to authenticated;
insert into ref select 'h', p.last_household_id from public.profiles p
  where p.user_id = (select id from u where name = 'alice');

-- bob — shu byudjetda member (spravochnikni boshqarolmaydi).
select tests.authenticate_as((select id from u where name = 'alice'));
create temporary table inv (code text) on commit drop;
grant all on inv to authenticated;
insert into inv select code from public.create_invite((select id from ref where name = 'h'), 'member');
select tests.authenticate_as((select id from u where name = 'bob'));
select public.accept_invite((select code from inv));

-- Standart hisoblar: Naqd, Karta, Shaxsiy fond — teskari tartibga.
select tests.authenticate_as((select id from u where name = 'alice'));
create temporary table ids (v uuid[]) on commit drop;
grant all on ids to authenticated;
insert into ids select array_agg(id order by sort_order desc)
  from public.accounts where household_id = (select id from ref where name = 'h');

select is(
  public.set_sort_order((select id from ref where name = 'h'), 'accounts', (select v from ids)),
  3,
  'owner: uchala hisob yangi tartibda'
);
select results_eq(
  $$ select id from public.accounts
      where household_id = (select id from ref where name = 'h') order by sort_order $$,
  $$ select unnest((select v from ids)) $$,
  'tartib — berilgan ID lar ketma-ketligi'
);
select is(
  public.set_sort_order((select id from ref where name = 'h'), 'accounts', (select v from ids)),
  0,
  'o''zgarmagan qatorlar yozilmaydi (row_version oshmaydi)'
);
select throws_ok(
  $$ select public.set_sort_order((select id from ref where name = 'h'), 'transactions', '{}') $$,
  'P0001', 'invalid_table', 'faqat tartibli spravochniklar (oq ro''yxat)'
);
select throws_ok(
  $$ select public.set_sort_order(
       (select id from ref where name = 'h'), 'accounts',
       array(select gen_random_uuid() from generate_series(1, 1001))) $$,
  'P0001', 'invalid_batch', 'ro''yxat 1000 tadan oshmaydi'
);

-- member: hisoblar — yo'q (owner/admin), maqsadlar — bor.
select tests.authenticate_as((select id from u where name = 'bob'));
select throws_ok(
  $$ select public.set_sort_order((select id from ref where name = 'h'), 'accounts', (select v from ids)) $$,
  'P0001', 'forbidden', 'member hisoblar tartibini o''zgartirolmaydi'
);
select is(
  public.set_sort_order((select id from ref where name = 'h'), 'goals', '{}'),
  0,
  'member maqsadlar tartibini o''zgartira oladi'
);

-- Begona byudjet a'zosi emas.
select tests.authenticate_as((select id from u where name = 'eve'));
select throws_ok(
  $$ select public.set_sort_order((select id from ref where name = 'h'), 'accounts', (select v from ids)) $$,
  'P0001', 'forbidden', 'a''zo emas — rad etiladi'
);

select * from finish();
rollback;
