-- E08-T01: oyni ochish — preview, idempotentlik, oy kuni qisilishi, fond
-- ajratmasi. Qoidalar: BR-060, BR-080..084, BR-011, BR-210.
begin;
select plan(13);

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
insert into ref select a.type::text, a.id from public.accounts a
  where a.household_id = (select id from ref where name = 'h');
insert into ref select 'c_' || lower(c.name), c.id from public.categories c
  where c.household_id = (select id from ref where name = 'h')
    and c.name in ('Ijara', 'Internet/Aloqa', 'Kommunal', 'Oylik', 'Avans');

create temporary table r (v jsonb) on commit drop;
grant all on r to authenticated;

select tests.authenticate_as((select id from u where name = 'alice'));
create temporary table inv (role text primary key, code text) on commit drop;
grant all on inv to authenticated;
insert into inv select 'member', code from public.create_invite((select id from ref where name = 'h'), 'member');
insert into inv select 'viewer', code from public.create_invite((select id from ref where name = 'h'), 'viewer');

-- Doimiy rejalar: 4 aktiv (davr ichida) + nofaol + davri tugagan + hali boshlanmagan.
insert into public.recurring_rules (household_id, kind, name, category_id, account_id, amount, day_of_month, auto_pay,
                                    active, start_month, end_month, sort_order)
select (select id from ref where name = 'h'), v.kind::public.plan_kind, v.name, (select id from ref where name = v.cat),
       (select id from ref where name = v.acc), v.amount, v.day, v.auto_pay, v.active, v.start_month, v.end_month, v.sort
  from (values
    ('expense', 'Ijara',    'c_ijara',          'card', 300000000::bigint, 5::smallint,  false, true,  null::date,    null::date,   1),
    ('expense', 'Internet', 'c_internet/aloqa', 'card', 15000000,          31,           true,  true,  null,          null,         2),
    ('expense', 'Kommunal', 'c_kommunal',       null,   null,              10,           false, true,  null,          null,         3),
    ('income',  'Oylik',    'c_oylik',          'card', 800000000,         2,            false, true,  '2027-01-01',  null,         4),
    ('expense', 'Sport zal', 'c_kommunal',      null,   20000000,          15,           false, false, null,          null,         5),
    ('expense', 'Kurs',     'c_kommunal',       null,   50000000,          20,           false, true,  null,          '2027-01-01', 6),
    ('expense', 'Mashina',  'c_kommunal',       null,   70000000,          25,           false, true,  '2027-06-01',  null,         7)
  ) as v (kind, name, cat, acc, amount, day, auto_pay, active, start_month, end_month, sort);
select tests.authenticate_as((select id from u where name = 'bob'));
select public.accept_invite((select code from inv where role = 'member'));
select tests.authenticate_as((select id from u where name = 'carol'));
select public.accept_invite((select code from inv where role = 'viewer'));

-- ─── Preview (BR-084) ──────────────────────────────────────────────────────
select tests.authenticate_as((select id from u where name = 'carol'));
insert into r select public.open_month_preview((select id from ref where name = 'h'), '2027-02-01');
select results_eq(
  $$ select (v ->> 'new')::int, (v ->> 'existing')::int,
            (select string_agg(i ->> 'name', ', ' order by ord) from jsonb_array_elements(v -> 'items') with ordinality as x (i, ord))
       from r $$,
  $$ values (5, 0, 'Ijara, Internet, Kommunal, Oylik, O''zim uchun') $$,
  'BR-084: preview — aktiv, amal davri ichidagi shablonlar tartib bo''yicha + fond ajratmasi'
);
select tests.authenticate_as((select id from u where name = 'dave'));
select throws_ok(
  $$ select public.open_month_preview((select id from ref where name = 'h'), '2027-02-01') $$,
  'P0001', 'forbidden', 'BR-210: begona byudjet oyini ko''rib bo''lmaydi'
);

-- ─── Ochish (BR-081, BR-082) ───────────────────────────────────────────────
select tests.authenticate_as((select id from u where name = 'carol'));
select throws_ok(
  $$ select public.open_month((select id from ref where name = 'h'), '2027-02-01') $$,
  'P0001', 'forbidden', 'BR-011: viewer oyni ocha olmaydi'
);
select tests.authenticate_as((select id from u where name = 'bob'));
delete from r;
insert into r select public.open_month((select id from ref where name = 'h'), '2027-02-01');
select results_eq(
  $$ select (v ->> 'created')::int, (v ->> 'skipped')::int from r $$,
  $$ values (5, 0) $$,
  'BR-081: member oyni ochadi — 5 ta reja yaratildi'
);
select results_eq(
  $$ select p.name::text, p.due_date, p.planned_amount, p.auto_pay, p.budget_month::date
       from public.planned_items p
      where p.household_id = (select id from ref where name = 'h') and p.budget_month = '2027-02-01'
      order by p.due_date, p.name $$,
  $$ values ('Oylik', date '2027-02-02', 800000000::bigint, false, date '2027-02-01'),
            ('Ijara', '2027-02-05', 300000000, false, '2027-02-01'),
            ('O''zim uchun', '2027-02-05', null, false, '2027-02-01'),
            ('Kommunal', '2027-02-10', null, false, '2027-02-01'),
            ('Internet', '2027-02-28', 15000000, true, '2027-02-01') $$,
  'BR-080: 31-kun fevralda 28 ga qisiladi; summa, avto to''lov shablondan'
);
select results_eq(
  $$ select p.system_code::text, p.account_id = (select id from ref where name = 'cash')
       from public.planned_items p
      where p.household_id = (select id from ref where name = 'h') and p.budget_month = '2027-02-01' and p.kind = 'allocation' $$,
  $$ values ('personal_allocation', true) $$,
  'BR-060: fond ajratmasi rejasi — tizim rejasi, manba naqd hisob'
);
select isnt_empty(
  $$ select 1 from public.months where household_id = (select id from ref where name = 'h') and month = '2027-02-01' and opened_at is not null $$,
  'BR-081: oy ochilgani qayd etiladi'
);

update public.planned_items set planned_amount = 310000000
 where household_id = (select id from ref where name = 'h') and budget_month = '2027-02-01' and name = 'Ijara';
delete from r;
insert into r select public.open_month((select id from ref where name = 'h'), '2027-02-01');
select results_eq(
  $$ select (v ->> 'created')::int, (v ->> 'skipped')::int from r $$,
  $$ values (0, 5) $$,
  'BR-081: qayta ochish idempotent — "0 ta qo''shildi, 5 ta bor edi"'
);
select is(
  (select planned_amount from public.planned_items
    where household_id = (select id from ref where name = 'h') and budget_month = '2027-02-01' and name = 'Ijara'),
  310000000::bigint,
  'BR-082: qayta ochish oy ichidagi qo''lda tuzatishni qayta yozmaydi'
);

-- ─── Kabisa yili, shablon o'zgarishi, fond summasi ─────────────────────────
select public.open_month((select id from ref where name = 'h'), '2028-02-01');
select is(
  (select due_date from public.planned_items
    where household_id = (select id from ref where name = 'h') and budget_month = '2028-02-01' and name = 'Internet'),
  date '2028-02-29',
  'BR-080: kabisa yilida 31-kun → 29-fevral'
);

select tests.authenticate_as((select id from u where name = 'alice'));
update public.recurring_rules set amount = 350000000
 where household_id = (select id from ref where name = 'h') and name = 'Ijara';
insert into public.transactions (household_id, kind, account_id, amount, category_id, occurred_on, budget_month)
  values ((select id from ref where name = 'h'), 'income', (select id from ref where name = 'card'), 200000000,
          (select id from ref where name = 'c_avans'), '2027-03-01', '2027-03-01');
select public.open_month((select id from ref where name = 'h'), '2027-03-01');
select results_eq(
  $$ select p.budget_month::date, p.planned_amount from public.planned_items p
      where p.household_id = (select id from ref where name = 'h') and p.name = 'Ijara'
        and p.budget_month in ('2027-02-01', '2027-03-01')
      order by p.budget_month $$,
  $$ values (date '2027-02-01', 310000000::bigint), ('2027-03-01', 350000000) $$,
  'BR-083: shablon summasi faqat keyin ochiladigan oylarga ta''sir qiladi'
);
select is(
  (select planned_amount from public.planned_items
    where household_id = (select id from ref where name = 'h') and budget_month = '2027-03-01' and system_code = 'personal_allocation'),
  20000000::bigint,
  'BR-060: ochishda fond rejasi oyning mavjud daromadidan (2 000 000 × 10%)'
);

update public.households set personal_fund_percent = 0 where id = (select id from ref where name = 'h');
select public.open_month((select id from ref where name = 'h'), '2027-04-01');
select is_empty(
  $$ select 1 from public.planned_items
      where household_id = (select id from ref where name = 'h') and budget_month = '2027-04-01' and system_code is not null $$,
  'fond ajratmasi 0% — fond rejasi yaratilmaydi'
);

select * from finish();
rollback;
