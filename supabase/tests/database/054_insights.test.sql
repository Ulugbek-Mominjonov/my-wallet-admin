-- E32-T01: oylik tahlillar — kategoriya sakrashi, obunalar, eng katta
-- xarajatlar va hafta kunlari. Qoidalar: BR-062, BR-095, BR-210.
begin;
select plan(9);

-- ─── Tayyorgarlik ──────────────────────────────────────────────────────────
create temporary table u (name text primary key, id uuid) on commit drop;
insert into u values
  ('alice', tests.create_user('alice@test.uz')),
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
    and c.name in ('Oziq-ovqat', 'Transport', 'Kommunal');

create temporary table r (v jsonb) on commit drop;
grant all on r to authenticated;

-- Xarajat yozish yordamchisi (summa so'mda beriladi).
create function pg_temp.spend(p_category text, p_amount bigint, p_on date, p_payee text default null,
                              p_account text default 'card')
returns void language sql as $$
  insert into public.transactions (household_id, kind, account_id, amount, category_id,
                                   occurred_on, budget_month, payee)
  values ((select id from ref where name = 'h'), 'expense', (select id from ref where name = p_account),
          p_amount * 100, (select id from ref where name = p_category),
          p_on, date_trunc('month', p_on)::date, p_payee);
$$;

-- Oziq-ovqat: uch oy 300 000, oktabrda 600 000 — sakrash (+100%).
select pg_temp.spend('c_oziq-ovqat', 300000, '2026-07-10');
select pg_temp.spend('c_oziq-ovqat', 300000, '2026-08-10');
select pg_temp.spend('c_oziq-ovqat', 300000, '2026-09-10');
select pg_temp.spend('c_oziq-ovqat', 400000, '2026-10-05', 'Korzinka');
select pg_temp.spend('c_oziq-ovqat', 200000, '2026-10-06', 'Makro');
-- Transport: har oy bir xil — sakrash emas.
select pg_temp.spend('c_transport', 100000, '2026-07-11');
select pg_temp.spend('c_transport', 100000, '2026-08-11');
select pg_temp.spend('c_transport', 100000, '2026-09-11');
select pg_temp.spend('c_transport', 100000, '2026-10-11');
-- Obuna: bir xil nom va summa uch oyda; iyundagi boshqa summa — alohida guruh.
select pg_temp.spend('c_kommunal', 60000, '2026-06-03', 'Netflix');
select pg_temp.spend('c_kommunal', 50000, '2026-08-03', 'Netflix');
select pg_temp.spend('c_kommunal', 50000, '2026-09-03', 'netflix');
select pg_temp.spend('c_kommunal', 50000, '2026-10-03', 'Netflix');
-- BR-062: fond xarajati byudjetga kirmaydi.
select pg_temp.spend('c_oziq-ovqat', 900000, '2026-10-07', 'Fond', 'personal_fund');

-- ─── Faqat a'zolar (BR-210) ────────────────────────────────────────────────
select tests.authenticate_as((select id from u where name = 'dave'));
select throws_ok(
  format('select public.report_insights(%L, %L)', (select id from ref where name = 'h'), '2026-10-01'),
  'P0001', 'forbidden', 'BR-210: begona byudjet tahlilini ko''rmaydi'
);

select tests.authenticate_as((select id from u where name = 'alice'));
insert into r select public.report_insights((select id from ref where name = 'h'), '2026-10-01');

-- ─── Jami: fond xarajati kirmaydi (BR-062) ─────────────────────────────────
select is((select (v ->> 'expense')::bigint from r), 75000000::bigint,
  'BR-062: oy xarajati — 600 000 + 100 000 + 50 000 (fonddan 900 000 kirmaydi)');

-- ─── Kategoriya sakrashi (BR-095) ──────────────────────────────────────────
select results_eq(
  $$ select s ->> 'name', (s ->> 'actual')::bigint, (s ->> 'average')::bigint, (s ->> 'delta_pct')::int
       from r, jsonb_array_elements(r.v -> 'spikes') s $$,
  $$ values ('Oziq-ovqat', 60000000::bigint, 30000000::bigint, 100),
            ('Kommunal', 5000000::bigint, 3333333::bigint, 50) $$,
  'E32-T01: 3 oylik o''rtachadan 30%+ oshgan kategoriyalar (Transport — yo''q)'
);

-- ─── Obunalar ──────────────────────────────────────────────────────────────
select results_eq(
  $$ select s ->> 'payee', (s ->> 'amount')::bigint, (s ->> 'months')::int, s ->> 'last_on'
       from r, jsonb_array_elements(r.v -> 'subscriptions') s $$,
  $$ values ('Netflix', 5000000::bigint, 3, '2026-10-03') $$,
  'E32-T01: bir xil nom va summa 3 oyda — obuna (registr farqi birlashadi)'
);
select is((select (v ->> 'subscriptions_total')::bigint from r), 5000000::bigint,
  'obunalarning oylik jami');

-- ─── Eng katta xarajatlar ──────────────────────────────────────────────────
select results_eq(
  $$ select e ->> 'payee', (e ->> 'amount')::bigint
       from r, jsonb_array_elements(r.v -> 'top_expenses') e $$,
  $$ values ('Korzinka', 40000000::bigint), ('Makro', 20000000::bigint),
            (null, 10000000::bigint), ('Netflix', 5000000::bigint) $$,
  'E32-T01: oyning eng katta xarajatlari — kamayish tartibida'
);

-- ─── Hafta kunlari ─────────────────────────────────────────────────────────
select is((select count(*) from r, jsonb_array_elements(r.v -> 'weekdays') w), 7::bigint,
  'hafta kunlari — 7 qator (yozuvsiz kun ham)');
select is(
  (select sum((w ->> 'amount')::bigint)::bigint from r, jsonb_array_elements(r.v -> 'weekdays') w),
  (select (v ->> 'expense')::bigint from r),
  'hafta kunlari yig''indisi = oy xarajati'
);
select is(
  (select (w ->> 'amount')::bigint from r, jsonb_array_elements(r.v -> 'weekdays') w
    where (w ->> 'dow')::int = extract(isodow from date '2026-10-05')),
  40000000::bigint,
  '5-oktabrdagi xarajat o''sha hafta kunida'
);

select * from finish();
rollback;
