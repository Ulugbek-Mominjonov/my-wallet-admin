-- E05-T07: byudjet, a'zolar, rollar, takliflar, RLS (BR-010..015, BR-210).
begin;
select plan(33);

-- ─── Tayyorgarlik: 4 foydalanuvchi ─────────────────────────────────────────
create temporary table u (name text primary key, id uuid) on commit drop;
insert into u values
  ('alice', tests.create_user('alice@test.uz')),
  ('bob',   tests.create_user('bob@test.uz')),
  ('carol', tests.create_user('carol@test.uz')),
  ('dave',  tests.create_user('dave@test.uz'));
grant select on u to authenticated;

create temporary table h (name text primary key, id uuid) on commit drop;
insert into h select 'alice', m.household_id from public.household_members m
  where m.user_id = (select id from u where name = 'alice');
grant select on h to authenticated;

-- ─── BR-010: ro'yxatdan o'tish ─────────────────────────────────────────────
select is(
  (select display_name from public.profiles where user_id = (select id from u where name = 'alice')),
  'alice', 'BR-010: profil yaratiladi, ism email prefiksidan'
);
select is(
  (select h2.name from public.households h2 where h2.id = (select id from h)),
  'Shaxsiy byudjet', 'BR-010: shaxsiy byudjet avtomatik yaratiladi'
);
select is(
  (select role::text from public.household_members
    where household_id = (select id from h) and user_id = (select id from u where name = 'alice')),
  'owner', 'BR-010: yaratuvchi — owner'
);
select is(
  (select last_household_id from public.profiles where user_id = (select id from u where name = 'alice')),
  (select id from h), 'profilda oxirgi byudjet eslab qolinadi'
);

-- ─── BR-012: takliflar ─────────────────────────────────────────────────────
select tests.authenticate_as((select id from u where name = 'alice'));
create temporary table inv (role text primary key, code text) on commit drop;
grant all on inv to authenticated;
insert into inv select 'member', code from public.create_invite((select id from h), 'member');
insert into inv select 'viewer', code from public.create_invite((select id from h), 'viewer');
select matches((select code from inv where role = 'member'), '^[A-HJ-NP-Z2-9]{8}$',
  'BR-012: kod 8 belgi, adashtiradigan belgilarsiz');
select throws_ok(
  $$ select * from public.create_invite((select id from h), 'owner') $$,
  'P0001', 'invalid_role', 'owner rolida taklif yaratib bo''lmaydi'
);

select tests.authenticate_as((select id from u where name = 'bob'));
select is(public.accept_invite((select lower(code) from inv where role = 'member')), (select id from h),
  'BR-012: taklif qabul qilinadi (kod katta-kichik harfga sezgir emas)');
select throws_ok(
  $$ select public.accept_invite((select code from inv where role = 'member')) $$,
  'P0001', 'invite_used', 'BR-012: taklif bir martalik'
);
select throws_ok(
  $$ select public.accept_invite('ZZZZZZZZ') $$,
  'P0001', 'invite_not_found', 'noma''lum kod'
);
select tests.clear_authentication();

update public.household_invites set expires_at = now() - interval '1 second'
 where code = (select code from inv where role = 'viewer');
select tests.authenticate_as((select id from u where name = 'carol'));
select throws_ok(
  $$ select public.accept_invite((select code from inv where role = 'viewer')) $$,
  'P0001', 'invite_expired', 'BR-012: muddati o''tgan taklif ishlamaydi'
);
select tests.clear_authentication();
update public.household_invites set expires_at = now() + interval '1 day'
 where code = (select code from inv where role = 'viewer');
select tests.authenticate_as((select id from u where name = 'carol'));
select lives_ok(
  $$ select public.accept_invite((select code from inv where role = 'viewer')) $$,
  'viewer taklifi qabul qilinadi'
);

-- ─── RLS: o'qish (BR-210) ──────────────────────────────────────────────────
select tests.authenticate_as((select id from u where name = 'dave'));
select is_empty(
  $$ select 1 from public.households where id = (select id from h) $$,
  'BR-210: begona foydalanuvchi byudjetni ko''rmaydi'
);
select is_empty(
  $$ select 1 from public.household_members where household_id = (select id from h) $$,
  'BR-210: begona foydalanuvchi a''zolarni ko''rmaydi'
);
select is_empty(
  $$ select 1 from public.profiles where user_id = (select id from u where name = 'alice') $$,
  'begona foydalanuvchi profilni ko''rmaydi'
);
select throws_ok(
  $$ select * from public.create_invite((select id from h), 'member') $$,
  'P0001', 'forbidden', 'begona taklif yarata olmaydi'
);

select tests.authenticate_as((select id from u where name = 'bob'));
select isnt_empty(
  $$ select 1 from public.households where id = (select id from h) $$,
  'member byudjetni ko''radi'
);
select is(
  (select display_name from public.profiles where user_id = (select id from u where name = 'alice')),
  'alice', 'hamkor ismi ko''rinadi (bir byudjet)'
);
select is(
  (select jsonb_array_length(public.app_bootstrap() -> 'households')), 2,
  'app_bootstrap: shaxsiy + taklif qilingan byudjet'
);

-- ─── RLS: yozish (BR-011) ──────────────────────────────────────────────────
update public.households set name = 'Bobniki' where id = (select id from h);
select tests.clear_authentication();
select is((select name from public.households where id = (select id from h)), 'Shaxsiy byudjet',
  'BR-011: member byudjet sozlamasini o''zgartira olmaydi');

select tests.authenticate_as((select id from u where name = 'alice'));
update public.households set name = 'Oila byudjeti' where id = (select id from h);
select tests.clear_authentication();
select is((select name from public.households where id = (select id from h)), 'Oila byudjeti',
  'BR-011: owner byudjet sozlamasini o''zgartiradi');

select tests.authenticate_as((select id from u where name = 'alice'));
select throws_ok(
  $$ update public.households set created_by = null where id = (select id from h) $$,
  '42501', null, 'tizim maydonlari (created_by) klientdan o''zgartirilmaydi'
);
select throws_ok(
  $$ insert into public.household_members (household_id, user_id, role)
     values ((select id from h), (select id from u where name = 'dave'), 'member') $$,
  '42501', null, 'a''zolik faqat RPC orqali (to''g''ridan-to''g''ri yozish taqiq)'
);
select isnt_empty(
  $$ select 1 from public.audit_log where household_id = (select id from h) $$,
  'owner audit jurnalini ko''radi'
);
select tests.authenticate_as((select id from u where name = 'bob'));
select is_empty(
  $$ select 1 from public.audit_log where household_id = (select id from h) $$,
  'member audit jurnalini ko''rmaydi'
);

-- ─── Rollar va oxirgi owner (BR-011, BR-014) ───────────────────────────────
select throws_ok(
  $$ select public.remove_member((select id from h), (select id from u where name = 'carol')) $$,
  'P0001', 'forbidden', 'member boshqa a''zoni chiqara olmaydi'
);
select tests.authenticate_as((select id from u where name = 'alice'));
select throws_ok(
  $$ select public.leave_household((select id from h)) $$,
  'P0001', 'last_owner', 'BR-014: oxirgi owner chiqib keta olmaydi'
);
select throws_ok(
  $$ select public.set_member_role((select id from h), (select id from u where name = 'bob'), 'owner') $$,
  'P0001', 'use_transfer_ownership', 'owner roli faqat egalikni o''tkazish orqali'
);
select lives_ok(
  $$ select public.set_member_role((select id from h), (select id from u where name = 'bob'), 'admin') $$,
  'owner a''zoni admin qiladi'
);

select tests.authenticate_as((select id from u where name = 'bob'));
select throws_ok(
  $$ select public.set_member_role((select id from h), (select id from u where name = 'alice'), 'viewer') $$,
  'P0001', 'forbidden', 'admin owner rolini o''zgartira olmaydi'
);
select lives_ok(
  $$ select public.remove_member((select id from h), (select id from u where name = 'carol')) $$,
  'admin a''zoni chiqaradi'
);

select tests.authenticate_as((select id from u where name = 'alice'));
select lives_ok(
  $$ select public.transfer_ownership((select id from h), (select id from u where name = 'bob')) $$,
  'BR-014: egalik o''tkaziladi'
);
select lives_ok(
  $$ select public.leave_household((select id from h)) $$,
  'BR-014: sobiq owner (endi admin) chiqib keta oladi'
);
select tests.clear_authentication();
select results_eq(
  $$ select u2.name, m.role::text from public.household_members m
       join u u2 on u2.id = m.user_id
      where m.household_id = (select id from h) order by u2.name $$,
  $$ values ('bob', 'owner') $$,
  'yakuniy holat: bob — yagona owner'
);

select * from finish();
rollback;
