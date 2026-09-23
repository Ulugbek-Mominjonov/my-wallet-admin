-- E25-T02 (BR-180): to'liq JSON zaxira — owner/admin, tirik qatorlar,
-- boshqa byudjet ma'lumoti aralashmaydi.
begin;
select plan(7);

create temporary table u (name text primary key, id uuid) on commit drop;
insert into u values
  ('alice', tests.create_user('alice@test.uz')),
  ('bob',   tests.create_user('bob@test.uz')),
  ('carol', tests.create_user('carol@test.uz'));
grant select on u to authenticated;

create temporary table ref (name text primary key, id uuid) on commit drop;
grant all on ref to authenticated;
insert into ref select 'h', p.last_household_id from public.profiles p
  where p.user_id = (select id from u where name = 'alice');
insert into ref select 'other', p.last_household_id from public.profiles p
  where p.user_id = (select id from u where name = 'carol');
insert into ref select a.type::text, a.id from public.accounts a
  where a.household_id = (select id from ref where name = 'h');
insert into ref select 'cat', c.id from public.categories c
  where c.household_id = (select id from ref where name = 'h') and c.name = 'Oziq-ovqat';

select tests.authenticate_as((select id from u where name = 'alice'));
create temporary table inv (code text) on commit drop;
grant all on inv to authenticated;
insert into inv select code from public.create_invite((select id from ref where name = 'h'), 'member');
insert into public.tags (household_id, name) values ((select id from ref where name = 'h'), 'Ta''til');
insert into public.transactions (household_id, kind, account_id, amount, category_id, payee, occurred_on, budget_month)
values ((select id from ref where name = 'h'), 'expense', (select id from ref where name = 'cash'), 5000000,
        (select id from ref where name = 'cat'), 'Korzinka', '2026-09-03', '2026-09-01');
-- O'chirilgan yozuv zaxiraga tushmasligi kerak.
insert into public.tags (household_id, name) values ((select id from ref where name = 'h'), 'Eski');
update public.tags set deleted_at = now()
 where household_id = (select id from ref where name = 'h') and name = 'Eski';

select tests.authenticate_as((select id from u where name = 'bob'));
select public.accept_invite((select code from inv));

-- ─── Owner: to'liq zaxira ──────────────────────────────────────────────────
select tests.authenticate_as((select id from u where name = 'alice'));
create temporary table dump as
  select public.export_household((select id from ref where name = 'h')) as j;
grant select on dump to authenticated;

select is(
  (select jsonb_array_length(j -> 'transactions') from dump), 1,
  'amallar zaxirada'
);
select is(
  (select j -> 'transactions' -> 0 ->> 'payee' from dump), 'Korzinka',
  'qator ustunlari to''liq (jadvaldan)'
);
select is(
  (select jsonb_array_length(j -> 'tags') from dump), 1,
  'o''chirilgan yozuv zaxiraga kirmaydi'
);
select is(
  (select jsonb_array_length(j -> 'members') from dump), 2,
  'a''zolar (owner va member)'
);
select is(
  (select (j -> 'household' ->> 'id')::uuid from dump), (select id from ref where name = 'h'),
  'byudjet sozlamalari'
);
select ok(
  (select (j ->> 'version')::int >= 1 and (j ->> 'exported_at') is not null from dump),
  'versiya va vaqt belgilangan'
);

-- ─── Faqat owner/admin ─────────────────────────────────────────────────────
select tests.authenticate_as((select id from u where name = 'bob'));
select throws_ok(
  $$ select public.export_household((select id from ref where name = 'h')) $$,
  'P0001', 'forbidden', 'member to''liq zaxira ololmaydi'
);

select * from finish();
rollback;
