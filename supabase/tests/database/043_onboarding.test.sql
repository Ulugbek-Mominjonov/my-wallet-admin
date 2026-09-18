-- E08-T06: onboarding_apply — bitta tranzaksiya, bir marta, nomlar bo'yicha.
-- Qoidalar: BR-020, BR-031, BR-040, BR-060, BR-077, BR-080, BR-011.
begin;
select plan(11);

-- ─── Tayyorgarlik ──────────────────────────────────────────────────────────
create temporary table u (name text primary key, id uuid) on commit drop;
insert into u values
  ('alice', tests.create_user('alice@test.uz')),
  ('bob',   tests.create_user('bob@test.uz'));
grant select on u to authenticated;

create temporary table ref (name text primary key, id uuid) on commit drop;
grant all on ref to authenticated;
insert into ref select 'h', p.last_household_id from public.profiles p
  where p.user_id = (select id from u where name = 'alice');

create temporary table r (name text primary key, v jsonb) on commit drop;
grant all on r to authenticated;

select tests.authenticate_as((select id from u where name = 'alice'));
create temporary table inv (code text) on commit drop;
grant all on inv to authenticated;
insert into inv select code from public.create_invite((select id from ref where name = 'h'), 'member');

-- Mobil sozlash oynasidan keladigan namuna (so'mlar tiyinda).
create temporary table payload (v jsonb) on commit drop;
grant all on payload to authenticated;
insert into payload values ('{
  "accounts": [
    {"name": "naqd", "type": "cash", "opening_balance": 150000000},
    {"name": "Humo", "type": "card", "opening_balance": 200000000},
    {"name": "Fond", "type": "personal_fund", "opening_balance": 30000000}
  ],
  "income_types": [
    {"name": "Oylik", "month_shift": -1, "expected_day": 2, "expected_amount": 800000000, "account": "Humo"},
    {"name": "Freelance", "month_shift": 0}
  ],
  "recurring": [
    {"kind": "expense", "name": "Ijara", "category": "Ijara", "account": "naqd", "amount": 300000000, "day_of_month": 5}
  ],
  "fund": {"mode": "percent", "percent": 15, "day": 7, "source_account": "Humo"}
}');

-- ─── Rollar ────────────────────────────────────────────────────────────────
select tests.authenticate_as((select id from u where name = 'bob'));
select public.accept_invite((select code from inv));
select throws_ok(
  $$ select public.onboarding_apply((select id from ref where name = 'h'), (select v from payload)) $$,
  'P0001', 'forbidden', 'BR-011: onboarding — owner/admin'
);

-- ─── Nomlar tekshiruvi (hech narsa yozilmaydi) ─────────────────────────────
select tests.authenticate_as((select id from u where name = 'alice'));
select throws_ok(
  $$ select public.onboarding_apply((select id from ref where name = 'h'),
       jsonb_set((select v from payload), '{recurring,0,account}', '"Yo''q hisob"')) $$,
  'P0001', 'account_not_found', 'noma''lum hisob nomi — xato, hech narsa yozilmaydi'
);
select throws_ok(
  $$ select public.onboarding_apply((select id from ref where name = 'h'),
       jsonb_set((select v from payload), '{recurring,0,category}', '"Yo''q kategoriya"')) $$,
  'P0001', 'category_not_found', 'noma''lum kategoriya nomi — xato'
);

-- ─── Qo'llash ──────────────────────────────────────────────────────────────
insert into r select 'first', public.onboarding_apply((select id from ref where name = 'h'), (select v from payload));
select results_eq(
  $$ select (v ->> 'applied')::boolean, (v ->> 'accounts')::int, (v ->> 'income_types')::int, (v ->> 'recurring_rules')::int
       from r where name = 'first' $$,
  $$ values (true, 3, 2, 2) $$,
  'onboarding bitta chaqiruvda qo''llandi (Ijara + kutilayotgan Oylik rejasi)'
);
select results_eq(
  $$ select a.name::text, a.type::text, a.opening_balance, a.currency from public.accounts a
      where a.household_id = (select id from ref where name = 'h') and a.deleted_at is null order by a.sort_order, a.name $$,
  $$ values ('Humo', 'card', 200000000::bigint, 'UZS'), ('Naqd', 'cash', 150000000, 'UZS'),
            ('Karta', 'card', 0, 'UZS'), ('Shaxsiy fond', 'personal_fund', 30000000, 'UZS') $$,
  'BR-020: mavjud hisoblarga joriy qoldiq (nom registrsiz, fond — turi bo''yicha), yangisi yaratildi'
);
select results_eq(
  $$ select c.name::text, c.month_shift::int from public.categories c
      where c.household_id = (select id from ref where name = 'h') and c.kind = 'income' and c.name in ('Oylik', 'Freelance')
      order by c.name $$,
  $$ values ('Freelance', 0), ('Oylik', -1) $$,
  'BR-031, BR-040: daromad turlari va oy siljishi'
);
select results_eq(
  $$ select r2.kind::text, r2.name::text, r2.amount, r2.day_of_month::int, a.name::text
       from public.recurring_rules r2 left join public.accounts a on a.id = r2.account_id
      where r2.household_id = (select id from ref where name = 'h') order by r2.sort_order $$,
  $$ values ('expense', 'Ijara', 300000000::bigint, 5, 'Naqd'), ('income', 'Oylik', 800000000, 2, 'Humo') $$,
  'BR-077, BR-080: doimiy xarajat va kutilayotgan daromad rejasi'
);
select results_eq(
  $$ select h.personal_fund_mode::text, h.personal_fund_percent::int, h.personal_fund_day::int, a.name::text
       from public.households h join public.accounts a on a.id = h.personal_fund_source_account_id
      where h.id = (select id from ref where name = 'h') $$,
  $$ values ('percent', 15, 7, 'Humo') $$,
  'BR-060: fond qoidasi sozlandi'
);
select is(
  (select (h ->> 'onboarded')::boolean from jsonb_array_elements(public.app_bootstrap() -> 'households') as h
    where (h ->> 'id')::uuid = (select id from ref where name = 'h')),
  true,
  'app_bootstrap: byudjet sozlangan deb belgilanadi'
);

-- ─── Qayta chaqirish (ustiga yozmaydi) ─────────────────────────────────────
insert into r select 'second', public.onboarding_apply((select id from ref where name = 'h'),
  jsonb_set((select v from payload), '{accounts,0,opening_balance}', '999'));
select is(
  (select (v ->> 'applied')::boolean from r where name = 'second'), false,
  'qayta chaqiruv hech narsa qilmaydi'
);
select is(
  (select opening_balance from public.accounts
    where household_id = (select id from ref where name = 'h') and name = 'Naqd'),
  150000000::bigint,
  'qayta chaqiruv qoldiqni ustiga yozmadi'
);

select * from finish();
rollback;
