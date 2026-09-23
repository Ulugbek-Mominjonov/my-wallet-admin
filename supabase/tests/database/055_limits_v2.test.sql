-- E34-T01, T02: limitlar v2 — ota-kategoriya limiti (BR-132) va o'tgan oydan
-- o'tadigan qoldiq (BR-134, rollover).
begin;
select plan(11);

-- ─── Tayyorgarlik ──────────────────────────────────────────────────────────
create temporary table u (name text primary key, id uuid) on commit drop;
insert into u values ('alice', tests.create_user('alice@test.uz'));
grant select on u to authenticated;

create temporary table ref (name text primary key, id uuid) on commit drop;
grant all on ref to authenticated;
insert into ref select 'h', p.last_household_id from public.profiles p
  where p.user_id = (select id from u where name = 'alice');
insert into ref select a.type::text, a.id from public.accounts a
  where a.household_id = (select id from ref where name = 'h');
insert into ref select 'c_oziq', c.id from public.categories c
  where c.household_id = (select id from ref where name = 'h') and c.name = 'Oziq-ovqat';

select set_config('app.today', '2026-10-15', true);
select tests.authenticate_as((select id from u where name = 'alice'));

-- Subkategoriya (BR-132 uchun) va ota-kategoriyaga limit: 1 000 000.
insert into public.categories (household_id, kind, name, parent_id)
values ((select id from ref where name = 'h'), 'expense', 'Nonushta',
        (select id from ref where name = 'c_oziq'));
insert into ref select 'c_non', c.id from public.categories c
  where c.household_id = (select id from ref where name = 'h') and c.name = 'Nonushta';
insert into public.category_limits (household_id, category_id, amount)
values ((select id from ref where name = 'h'), (select id from ref where name = 'c_oziq'), 100000000);

create function pg_temp.spend(p_cat text, p_amount bigint, p_on date)
returns void language sql as $$
  insert into public.transactions (household_id, kind, account_id, amount, category_id,
                                   occurred_on, budget_month)
  values ((select id from ref where name = 'h'), 'expense', (select id from ref where name = 'card'),
          p_amount, (select id from ref where name = p_cat), p_on, date_trunc('month', p_on)::date);
$$;

-- Sentabr: ota 300 000 + bola 200 000 = 500 000 (limitdan 500 000 qoldi).
select pg_temp.spend('c_oziq', 30000000, '2026-09-10');
select pg_temp.spend('c_non', 20000000, '2026-09-11');
-- Oktabr: bola 100 000.
select pg_temp.spend('c_non', 10000000, '2026-10-03');

create temporary table r (name text primary key, v jsonb) on commit drop;
grant all on r to authenticated;

create function pg_temp.line(p_month date) returns jsonb language sql as $$
  select k from jsonb_array_elements(
         public.report_month((select id from ref where name = 'h'), p_month) -> 'by_category') k
   where k ->> 'category_id' = (select id::text from ref where name = 'c_oziq');
$$;

-- ─── BR-132: ota-kategoriya fakti — subkategoriyalar bilan ─────────────────
select results_eq(
  $$ select (pg_temp.line('2026-09-01') ->> 'actual')::bigint,
            (pg_temp.line('2026-09-01') ->> 'actual_total')::bigint,
            pg_temp.line('2026-09-01') ->> 'limit_status' $$,
  $$ values (30000000::bigint, 50000000::bigint, 'ok') $$,
  'BR-132: ota-kategoriya limiti subkategoriyalar yig''indisiga qo''llanadi'
);
select is(
  (pg_temp.line('2026-10-01') ->> 'actual_total')::bigint, 10000000::bigint,
  'oktabrda fakt — faqat shu oynikidan'
);

-- ─── BR-134: rollover o'chiq — qoldiq o'tmaydi ─────────────────────────────
select results_eq(
  $$ select (pg_temp.line('2026-10-01') ->> 'limit')::bigint,
            (pg_temp.line('2026-10-01') ->> 'limit_carry')::bigint $$,
  $$ values (100000000::bigint, 0::bigint) $$,
  'BR-134: rollover o''chiq bo''lsa limit o''zgarmaydi'
);
select is_empty(
  $$ select 1 from private.limit_carry((select id from ref where name = 'h'), '2026-10-01') $$,
  'rollover yoqilmagan limit qoldiq bermaydi'
);

-- ─── BR-134: rollover yoqilgan — qolgani qo'shiladi ────────────────────────
update public.category_limits set rollover = true
 where household_id = (select id from ref where name = 'h');
select results_eq(
  $$ select (pg_temp.line('2026-10-01') ->> 'limit')::bigint,
            (pg_temp.line('2026-10-01') ->> 'limit_carry')::bigint,
            pg_temp.line('2026-10-01') ->> 'limit_status' $$,
  $$ values (150000000::bigint, 50000000::bigint, 'ok') $$,
  'BR-134: sentabrdan qolgan 500 000 oktabr limitiga qo''shildi'
);

-- ─── Manfiy qoldiq: faqat `rollover_negative` bilan ────────────────────────
-- Sentabrda yana 700 000 — jami 1 200 000 (limitdan 200 000 oshdi).
select pg_temp.spend('c_oziq', 70000000, '2026-09-12');
select results_eq(
  $$ select (pg_temp.line('2026-10-01') ->> 'limit')::bigint,
            (pg_temp.line('2026-10-01') ->> 'limit_carry')::bigint $$,
  $$ values (100000000::bigint, 0::bigint) $$,
  'BR-134: oshib ketgan oy standart holatda keyingi oyga ta''sir qilmaydi'
);
update public.category_limits set rollover_negative = true
 where household_id = (select id from ref where name = 'h');
select results_eq(
  $$ select (pg_temp.line('2026-10-01') ->> 'limit')::bigint,
            (pg_temp.line('2026-10-01') ->> 'limit_carry')::bigint $$,
  $$ values (80000000::bigint, -20000000::bigint) $$,
  'BR-134: oshib ketgan 200 000 oktabr limitidan ayirildi'
);

-- Amaldagi limit manfiy bo'lmaydi (qoldiq limitdan katta bo'lsa — 0).
update public.category_limits set amount = 10000000
 where household_id = (select id from ref where name = 'h');
select results_eq(
  $$ select (pg_temp.line('2026-10-01') ->> 'limit')::bigint,
            (pg_temp.line('2026-10-01') ->> 'limit_carry')::bigint,
            pg_temp.line('2026-10-01') ->> 'limit_status' $$,
  $$ values (0::bigint, -10000000::bigint, 'over') $$,
  'amaldagi limit noldan kichik bo''lmaydi'
);

-- ─── Oylik hisobot xabari ham amaldagi limit bo'yicha (BR-131) ─────────────
select tests.clear_authentication();
insert into r select 'payload',
  private.monthly_report_payload((select id from ref where name = 'h'), '2026-10-01');
select results_eq(
  $$ select e ->> 'name', (e ->> 'limit')::bigint, (e ->> 'actual')::bigint
       from r, jsonb_array_elements(r.v -> 'limits_exceeded') e where r.name = 'payload' $$,
  $$ values ('Oziq-ovqat', 0::bigint, 10000000::bigint) $$,
  'BR-131: oylik xabarda limitdan oshganlar — amaldagi limit bilan'
);

-- ─── Ustun huquqlari: klient rollover sozlamasini yozadi ───────────────────
select tests.authenticate_as((select id from u where name = 'alice'));
select lives_ok(
  $$ update public.category_limits set rollover = false, rollover_negative = false
      where household_id = (select id from ref where name = 'h') $$,
  'rollover sozlamasi klientdan yoziladi'
);
select is(
  (select (pg_temp.line('2026-10-01') ->> 'limit')::bigint), 10000000::bigint,
  'o''chirilgach — faqat limitning o''zi'
);

select * from finish();
rollback;
