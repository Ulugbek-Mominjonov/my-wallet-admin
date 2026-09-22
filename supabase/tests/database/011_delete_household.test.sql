-- E22-T07: delete_household — faqat owner, nom bilan tasdiq (BR-011, BR-014).
begin;
select plan(7);

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

-- bob — shu byudjetda admin.
select tests.authenticate_as((select id from u where name = 'alice'));
create temporary table inv (code text) on commit drop;
grant all on inv to authenticated;
insert into inv select code from public.create_invite((select id from ref where name = 'h'), 'admin');
select tests.authenticate_as((select id from u where name = 'bob'));
select public.accept_invite((select code from inv));

select throws_ok(
  $$ select public.delete_household((select id from ref where name = 'h'), 'Shaxsiy byudjet') $$,
  'P0001', 'forbidden', 'admin byudjetni o''chira olmaydi (faqat owner)'
);

select tests.authenticate_as((select id from u where name = 'eve'));
select throws_ok(
  $$ select public.delete_household((select id from ref where name = 'h'), 'Shaxsiy byudjet') $$,
  'P0001', 'forbidden', 'a''zo emas — rad etiladi'
);

select tests.authenticate_as((select id from u where name = 'alice'));
select throws_ok(
  $$ select public.delete_household((select id from ref where name = 'h'), 'Boshqa nom') $$,
  'P0001', 'confirm_mismatch', 'nom mos kelmasa — o''chirilmaydi'
);
select isnt_empty(
  $$ select 1 from public.households where id = (select id from ref where name = 'h') $$,
  'xato tasdiqdan keyin byudjet joyida'
);

select lives_ok(
  $$ select public.delete_household((select id from ref where name = 'h'), '  shaxsiy BYUDJET ') $$,
  'owner: nom (registr va chetdagi bo''shliqsiz) bilan o''chiradi'
);
select tests.clear_authentication();
select is_empty(
  $$ select 1 from public.accounts where household_id = (select id from ref where name = 'h') $$,
  'byudjet ma''lumotlari kaskadda o''chdi'
);
select is(
  (select last_household_id from public.profiles where user_id = (select id from u where name = 'alice')),
  null,
  'shu byudjet oxirgi tanlangan bo''lgan profil bo''shatildi'
);

select * from finish();
rollback;
