-- E08-T02, T03: pay_planned, skip_planned, bulk_pay_planned.
-- Qoidalar: BR-061, BR-071..074, BR-011, BR-191.
begin;
select plan(15);

-- ─── Tayyorgarlik ──────────────────────────────────────────────────────────
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
insert into ref select 'c_kommunal', c.id from public.categories c
  where c.household_id = (select id from ref where name = 'h') and c.name = 'Kommunal';

create temporary table r (name text primary key, v jsonb) on commit drop;
grant all on r to authenticated;

select tests.authenticate_as((select id from u where name = 'alice'));
create temporary table inv (code text) on commit drop;
grant all on inv to authenticated;
insert into inv select code from public.create_invite((select id from ref where name = 'h'), 'viewer');
insert into public.accounts (household_id, name, type, currency, opening_date)
  values ((select id from ref where name = 'h'), 'Dollar', 'card', 'USD', '2026-10-01');
insert into ref select 'usd', a.id from public.accounts a
  where a.household_id = (select id from ref where name = 'h') and a.name = 'Dollar';
update public.households set personal_fund_mode = 'fixed', personal_fund_fixed_amount = 50000000
 where id = (select id from ref where name = 'h');

-- Oy rejalari (2026-10): nomi → id.
insert into public.planned_items (household_id, kind, name, category_id, account_id, planned_amount, due_date, budget_month)
select (select id from ref where name = 'h'), 'expense', v.name, (select id from ref where name = 'c_kommunal'),
       (select id from ref where name = v.acc), v.amount, '2026-10-10', '2026-10-01'
  from (values ('Ijara', 'card', 300000000::bigint), ('Suv', null, null), ('Internet', 'card', 15000000),
               ('Gaz', 'card', 10000000), ('Svet', null, 20000000), ('Musor', 'card', 5000000),
               ('Lift', 'card', 3000000), ('Domofon', 'usd', 1000000)) as v (name, acc, amount);
insert into ref select 'p_' || lower(p.name), p.id from public.planned_items p
  where p.household_id = (select id from ref where name = 'h') and p.budget_month = '2026-10-01';
select public.open_month((select id from ref where name = 'h'), '2026-10-01');
insert into ref select 'p_fund', p.id from public.planned_items p
  where p.household_id = (select id from ref where name = 'h') and p.system_code = 'personal_allocation';

-- ─── pay_planned (BR-073) ──────────────────────────────────────────────────
insert into r select 'ijara', public.pay_planned((select id from ref where name = 'p_ijara'), p_date => '2026-10-09');
select results_eq(
  $$ select (v ->> 'paid_amount')::bigint, (v ->> 'remaining')::bigint, v ->> 'status' from r where name = 'ijara' $$,
  $$ values (300000000::bigint, 0::bigint, 'paid') $$,
  'BR-073: summa standart — qolgan reja; to''liq to''landi'
);
select throws_ok(
  $$ select public.pay_planned((select id from ref where name = 'p_ijara')) $$,
  'P0001', 'planned_already_paid', 'BR-073: to''langan rejani qayta to''lab bo''lmaydi'
);
select throws_ok(
  $$ select public.pay_planned((select id from ref where name = 'p_suv'), p_account => (select id from ref where name = 'card')) $$,
  'P0001', 'amount_required', 'BR-073: summasi belgilanmagan rejada summa majburiy'
);
select throws_ok(
  $$ select public.pay_planned((select id from ref where name = 'p_svet'), p_amount => 100) $$,
  'P0001', 'account_required', 'hisob ko''rsatilmagan rejada hisob majburiy'
);
select throws_ok(
  $$ select public.pay_planned((select id from ref where name = 'p_domofon')) $$,
  'P0001', 'amount_required', 'BR-191: boshqa valyutadagi hisobdan to''lashda summa majburiy'
);
insert into r select 'internet', public.pay_planned((select id from ref where name = 'p_internet'), 10000000, p_date => '2026-10-09');
select results_eq(
  $$ select (v ->> 'paid_amount')::bigint, (v ->> 'remaining')::bigint from r where name = 'internet' $$,
  $$ values (10000000::bigint, 5000000::bigint) $$,
  'BR-073: qolgandan kam — qisman to''lov, qolgani keyin'
);
insert into r select 'gaz', public.pay_planned((select id from ref where name = 'p_gaz'), 6000000, p_date => '2026-10-09', p_settle => true);
select is(
  (select v ->> 'status' from r where name = 'gaz'), 'paid',
  'BR-073: kam to''lov "Yopish" bilan — to''landi'
);
insert into r select 'fund', public.pay_planned((select id from ref where name = 'p_fund'), p_date => '2026-10-05');
select results_eq(
  $$ select t.kind::text, t.to_account_id = (select id from ref where name = 'personal_fund'), t.amount, r.v ->> 'status'
       from r join public.transactions t on t.id = (r.v ->> 'transaction_id')::uuid where r.name = 'fund' $$,
  $$ values ('transfer', true, 50000000::bigint, 'paid') $$,
  'BR-061: ajratma rejasini to''lash — fondga o''tkazma'
);

-- ─── skip_planned (BR-071) ─────────────────────────────────────────────────
select is(
  public.skip_planned((select id from ref where name = 'p_musor')) ->> 'status', 'skipped',
  'BR-071: reja shu oy uchun o''tkazib yuboriladi'
);
select throws_ok(
  $$ select public.pay_planned((select id from ref where name = 'p_musor')) $$,
  'P0001', 'planned_skipped', 'o''tkazib yuborilgan reja to''lanmaydi'
);
select isnt(
  public.skip_planned((select id from ref where name = 'p_musor'), false) ->> 'status', 'skipped',
  'o''tkazib yuborish bekor qilinadi'
);

-- ─── Rollar ────────────────────────────────────────────────────────────────
select tests.authenticate_as((select id from u where name = 'carol'));
select public.accept_invite((select code from inv));
select throws_ok(
  $$ select public.pay_planned((select id from ref where name = 'p_lift')) $$,
  'P0001', 'forbidden', 'BR-011: viewer to''lay olmaydi'
);

-- ─── bulk_pay_planned (BR-074) ─────────────────────────────────────────────
select tests.authenticate_as((select id from u where name = 'alice'));
insert into r select 'bulk', public.bulk_pay_planned(
  array[(select id from ref where name = 'p_lift'), (select id from ref where name = 'p_suv'),
        (select id from ref where name = 'p_ijara'), (select id from ref where name = 'p_domofon'),
        (select id from ref where name = 'p_svet'), '01990000-0000-7000-8000-000000000000'::uuid],
  p_date => '2026-10-10'
);
select results_eq(
  $$ select jsonb_array_length(v -> 'paid'),
            (select string_agg(s ->> 'reason', ', ' order by ord) from jsonb_array_elements(v -> 'skipped') with ordinality as x (s, ord))
       from r where name = 'bulk' $$,
  $$ values (1, 'amount_unknown, already_paid, currency_mismatch, account_required, not_found') $$,
  'BR-074: faqat summasi aniq rejalar to''lanadi, qolganlari sababi bilan'
);
select ok(
  (select settled_at is not null from public.planned_items where id = (select id from ref where name = 'p_lift')),
  'BR-074: ommaviy to''langan reja — to''landi'
);
insert into r select 'bulk2', public.bulk_pay_planned(array[(select id from ref where name = 'p_svet')], '2026-10-10',
                                                      (select id from ref where name = 'cash'));
select is(
  (select paid_amount from public.planned_items where id = (select id from ref where name = 'p_svet')), 20000000::bigint,
  'hisobsiz rejalar uchun umumiy hisob tanlanadi'
);

select * from finish();
rollback;
