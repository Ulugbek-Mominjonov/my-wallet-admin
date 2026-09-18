-- E11-T02: kunlik ish — vaqt zonasi chegarasi (lokal 00:05), takroriy ishga
-- tushirish, avto-ochish (BR-084) va avto to'lov (BR-075).
begin;
select plan(11);

-- ─── Tayyorgarlik ──────────────────────────────────────────────────────────
create temporary table u (name text primary key, id uuid) on commit drop;
insert into u values
  ('alice', tests.create_user('alice@test.uz')),
  ('bob',   tests.create_user('bob@test.uz')),
  ('carol', tests.create_user('carol@test.uz'));
grant select on u to authenticated;

create temporary table ref (name text primary key, id uuid) on commit drop;
grant all on ref to authenticated;
insert into ref select 'h_' || u.name, p.last_household_id from public.profiles p join u on u.id = p.user_id;
insert into ref select a.type::text, a.id from public.accounts a
  where a.household_id = (select id from ref where name = 'h_alice') and a.type = 'card';
insert into ref select 'c_' || lower(c.name), c.id from public.categories c
  where c.household_id = (select id from ref where name = 'h_alice') and c.name in ('Ijara', 'Kommunal');
insert into public.accounts (household_id, name, type, currency, opening_date)
  values ((select id from ref where name = 'h_alice'), 'Dollar', 'card', 'USD', '2026-10-01');
insert into ref select 'usd', a.id from public.accounts a
  where a.household_id = (select id from ref where name = 'h_alice') and a.name = 'Dollar';

-- bob — London (UTC+0), carol — avto-ochish o'chiq.
update public.households set timezone = 'Europe/London' where id = (select id from ref where name = 'h_bob');
update public.households set auto_open_month = false where id = (select id from ref where name = 'h_carol');

-- Doimiy rejalar: avto to'lov (1-kun), qo'lda (5-kun), avto (3-kun), avto — USD hisobdan.
insert into public.recurring_rules (household_id, kind, name, category_id, account_id, amount, day_of_month, auto_pay, sort_order)
select (select id from ref where name = 'h_alice'), 'expense', v.name, (select id from ref where name = v.cat),
       (select id from ref where name = v.acc), v.amount, v.day, v.auto_pay, v.sort
  from (values
    ('Internet', 'c_kommunal', 'card', 15000000::bigint, 1::smallint, true,  1),
    ('Ijara',    'c_ijara',    'card', 300000000,        5,           false, 2),
    ('Gaz',      'c_kommunal', 'card', 10000000,         3,           true,  3),
    ('Domofon',  'c_kommunal', 'usd',  100,              1,           true,  4)
  ) as v (name, cat, acc, amount, day, auto_pay, sort);
insert into public.recurring_rules (household_id, kind, name, category_id, amount, day_of_month)
select (select id from ref where name = 'h_carol'), 'expense', 'Suv', c.id, 5000000, 1
  from public.categories c where c.household_id = (select id from ref where name = 'h_carol') and c.name = 'Kommunal';

-- Oktabr: yopilgan (qattiq qulf) oydagi to'lanmagan avto to'lov.
insert into public.planned_items (household_id, kind, name, category_id, account_id, planned_amount, due_date, budget_month, auto_pay)
values ((select id from ref where name = 'h_alice'), 'expense', 'Kurs', (select id from ref where name = 'c_kommunal'),
        (select id from ref where name = 'card'), 5000000, '2026-10-20', '2026-10-01', true);
insert into public.months (household_id, month, opened_at, closed_at)
values ((select id from ref where name = 'h_alice'), '2026-10-01', now(), now());
update public.households set strict_month_lock = true where id = (select id from ref where name = 'h_alice');

create temporary view auto_paid as
select p.name::text as name, t.amount, t.occurred_on, t.budget_month::date as budget_month, t.deleted_at is not null as deleted
  from public.transactions t join public.planned_items p on p.id = t.planned_item_id
 where t.household_id = (select id from ref where name = 'h_alice') and t.source = 'auto_pay';

-- ─── Ruxsat ────────────────────────────────────────────────────────────────
select tests.authenticate_as((select id from u where name = 'alice'));
select throws_ok($$ select jobs.daily_sweep() $$, '42501', null, 'kunlik ish klientga ochiq emas');
select tests.clear_authentication();

-- ─── 1. Toshkentda 00:04 — hali emas; Londonda 19:04 — ishlaydi ─────────────
select jobs.daily_sweep('2026-10-31 19:04:00+00');
select results_eq(
  $$ select u.name, h.last_sweep_on from public.households h join ref on ref.id = h.id join u on 'h_' || u.name = ref.name
      order by u.name $$,
  $$ values ('alice', null::date), ('bob', '2026-10-31'::date), ('carol', null::date) $$,
  'vaqt zonasi chegarasi: har byudjet o''z lokal 00:05 idan keyin'
);

-- ─── 2. Toshkentda 00:05 — noyabr ochiladi, bugungi avto to'lov ─────────────
select jobs.daily_sweep('2026-10-31 19:05:00+00');
select ok(
  (select opened_at is not null from public.months
    where household_id = (select id from ref where name = 'h_alice') and month = '2026-11-01'),
  'BR-084: 1-kuni oy avtomatik ochildi'
);
select is(
  (select array_agg(name::text order by name) from public.planned_items
    where household_id = (select id from ref where name = 'h_alice') and budget_month = '2026-11-01'
      and recurring_rule_id is not null),
  array['Domofon', 'Gaz', 'Ijara', 'Internet'],
  'doimiy rejalardan oy rejalari yaratildi'
);
select results_eq(
  $$ select name, amount, occurred_on, budget_month, deleted from auto_paid $$,
  $$ values ('Internet', 15000000::bigint, '2026-11-01'::date, '2026-11-01'::date, false) $$,
  'BR-075: muddati kelgan avto to''lov yozildi; USD hisobdan va qattiq yopilgan oydan — yo''q'
);
select ok(
  (select settled_at is not null from public.planned_items
    where household_id = (select id from ref where name = 'h_alice') and name = 'Internet' and budget_month = '2026-11-01'),
  'reja to''landi deb belgilandi'
);
select results_eq(
  $$ select (select count(*)::int from public.months where household_id = (select id from ref where name = 'h_carol')),
            (select last_sweep_on from public.households where id = (select id from ref where name = 'h_carol')) $$,
  $$ values (0, '2026-11-01'::date) $$,
  'avto-ochish o''chiq byudjet ochilmaydi (lekin kun belgilanadi)'
);

-- ─── 3. Shu kuni qayta ishga tushirish — hech narsa o'zgarmaydi ─────────────
select jobs.daily_sweep('2026-10-31 20:00:00+00');
select is((select count(*)::int from auto_paid), 1, 'takroriy ishga tushirish — takroriy to''lov yo''q');

-- ─── 4. Qisman to'langan reja, o'chirilgan avto to'lov, qulf ochildi ───────
select tests.authenticate_as((select id from u where name = 'alice'));
select public.pay_planned(
  (select id from public.planned_items where household_id = (select id from ref where name = 'h_alice')
      and name = 'Gaz' and budget_month = '2026-11-01'),
  p_amount => 4000000, p_date => '2026-11-02');
select tests.clear_authentication();
update public.transactions set deleted_at = now()
 where household_id = (select id from ref where name = 'h_alice') and source = 'auto_pay';
update public.households set strict_month_lock = false where id = (select id from ref where name = 'h_alice');

select jobs.daily_sweep('2026-11-02 19:10:00+00');
select results_eq(
  $$ select name, amount, deleted from auto_paid order by name $$,
  $$ values ('Gaz', 6000000::bigint, false), ('Internet', 15000000::bigint, true), ('Kurs', 5000000::bigint, false) $$,
  'qisman to''langan — qolgani; o''chirilgan avto to''lov qayta yaratilmaydi; qulfsiz yopilgan oy — to''lanadi'
);
select is(
  (select paid_amount from public.planned_items
    where household_id = (select id from ref where name = 'h_alice') and name = 'Gaz' and budget_month = '2026-11-01'),
  10000000::bigint, 'reja to''liq to''landi (qo''lda + avto)'
);
select ok(
  (select opened_at is not null from public.months
    where household_id = (select id from ref where name = 'h_bob') and month = '2026-11-01'),
  'London byudjeti o''z 1-noyabridan keyin ochildi'
);

select * from finish();
rollback;
