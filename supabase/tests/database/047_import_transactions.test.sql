-- E25-T03 (BR-182): CSV import — tekshiruv, dublikat (sana + summa + joy),
-- dry-run va haqiqiy yozuv.
begin;
select plan(11);

create temporary table u (name text primary key, id uuid) on commit drop;
insert into u values
  ('alice', tests.create_user('alice@test.uz')),
  ('carol', tests.create_user('carol@test.uz'));
grant select on u to authenticated;

create temporary table ref (name text primary key, id uuid) on commit drop;
grant all on ref to authenticated;
insert into ref select 'h', p.last_household_id from public.profiles p
  where p.user_id = (select id from u where name = 'alice');
insert into ref select a.type::text, a.id from public.accounts a
  where a.household_id = (select id from ref where name = 'h');

select tests.authenticate_as((select id from u where name = 'alice'));
create temporary table inv (code text) on commit drop;
grant all on inv to authenticated;
insert into inv select code from public.create_invite((select id from ref where name = 'h'), 'viewer');
select tests.authenticate_as((select id from u where name = 'carol'));
select public.accept_invite((select code from inv));
select tests.authenticate_as((select id from u where name = 'alice'));

-- Mavjud amal — dublikat tekshiruvi uchun.
insert into public.transactions (household_id, kind, account_id, amount, category_id, payee, occurred_on, budget_month)
select (select id from ref where name = 'h'), 'expense', (select id from ref where name = 'cash'), 5000000,
       c.id, 'Korzinka', '2026-09-03', '2026-09-01'
  from public.categories c
 where c.household_id = (select id from ref where name = 'h') and c.name = 'Oziq-ovqat';

create temporary table rows_json (j jsonb) on commit drop;
grant all on rows_json to authenticated;
insert into rows_json values ($json$[
  {"occurred_on": "2026-09-10", "amount": -2500000, "payee": "Makro", "account": "naqd", "category": "Oziq-ovqat"},
  {"occurred_on": "2026-09-03", "amount": -5000000, "payee": "KORZINKA", "account": "Naqd", "category": "Oziq-ovqat"},
  {"occurred_on": "2026-09-11", "amount": -1000000, "payee": "X", "account": "Yo'q hisob", "category": "Oziq-ovqat"},
  {"occurred_on": "2026-09-12", "amount": -1000000, "payee": "Y", "account": "Naqd", "category": "Yo'q kategoriya"},
  {"occurred_on": "shanba", "amount": -1000000, "payee": "Z", "account": "Naqd", "category": "Oziq-ovqat"},
  {"occurred_on": "2026-09-13", "amount": 9000000, "payee": "Ish", "account": "Karta", "category": "Avans"}
]$json$::jsonb);

-- ─── Dry-run: hech narsa yozilmaydi ────────────────────────────────────────
create temporary table dry as
  select public.import_transactions((select id from ref where name = 'h'), (select j from rows_json)) as r;
grant select on dry to authenticated;

select is((select (r ->> 'total')::int from dry), 6, 'hamma qator hisoblanadi');
select is((select (r ->> 'ready')::int from dry), 2, 'toza qatorlar: Makro va daromad');
select is((select (r ->> 'imported')::int from dry), 0, 'dry-run — yozilmaydi');
select is(
  (select r -> 'duplicates' -> 0 ->> 'index' from dry), '2',
  'BR-182: sana + summa + joy bo''yicha dublikat (registr farq qilmaydi)'
);
select results_eq(
  $$ select (e ->> 'code') from dry, jsonb_array_elements(r -> 'errors') e order by (e ->> 'index')::int $$,
  $$ values ('account_not_found'::text), ('category_not_found'), ('invalid_row') $$,
  'xatolar: hisob, kategoriya va buzilgan qator'
);
select is(
  (select count(*)::int from public.transactions t
    where t.household_id = (select id from ref where name = 'h')), 1,
  'dry-run''dan keyin amallar soni o''zgarmaydi'
);

-- ─── Haqiqiy import ────────────────────────────────────────────────────────
create temporary table run as
  select public.import_transactions((select id from ref where name = 'h'), (select j from rows_json), false) as r;
grant select on run to authenticated;

select is((select (r ->> 'imported')::int from run), 2, 'faqat toza qatorlar yoziladi');
select results_eq(
  $$ select t.payee::text, t.kind::text, t.amount, t.source::text from public.transactions t
      where t.household_id = (select id from ref where name = 'h') and t.source = 'import'
      order by t.occurred_on $$,
  $$ values ('Makro'::text, 'expense'::text, 2500000::bigint, 'import'::text),
            ('Ish', 'income', 9000000::bigint, 'import') $$,
  'manfiy — xarajat, musbat — daromad; summa musbat saqlanadi'
);
select is(
  (select budget_month::date from public.transactions where payee = 'Makro'), date '2026-09-01',
  'tegishli oy — sana oyi (trigger)'
);

-- ─── Huquq va chegara ──────────────────────────────────────────────────────
select tests.authenticate_as((select id from u where name = 'carol'));
select throws_ok(
  $$ select public.import_transactions((select id from ref where name = 'h'), '[]'::jsonb) $$,
  'P0001', 'forbidden', 'viewer import qila olmaydi'
);
select tests.authenticate_as((select id from u where name = 'alice'));
select throws_ok(
  $$ select public.import_transactions((select id from ref where name = 'h'),
       (select jsonb_agg(jsonb_build_object('occurred_on', '2026-09-01', 'amount', -100))
          from generate_series(1, 1001))) $$,
  'P0001', 'invalid_batch', '1000 tadan ortiq qator — rad'
);

select * from finish();
rollback;
