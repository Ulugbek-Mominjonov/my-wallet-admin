-- E07-T02, T05, T06: oy rejalari, to'lov holati va 👤 fond ajratmasi.
-- Qoidalar: BR-002, BR-011, BR-060, BR-061, BR-070..075, BR-081.
begin;
select plan(25);

-- ─── Tayyorgarlik ──────────────────────────────────────────────────────────
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
insert into ref select a.type::text, a.id from public.accounts a
  where a.household_id = (select id from ref where name = 'h');
insert into ref select 'c_' || lower(c.name), c.id from public.categories c
  where c.household_id = (select id from ref where name = 'h') and c.name in ('Avans', 'Kommunal', 'Internet/Aloqa');

-- m0 — byudjet vaqt zonasidagi joriy oy (fond sozlamasi joriy oydan ta'sir qiladi).
create temporary table d (name text primary key, v date) on commit drop;
grant select on d to authenticated;
insert into d values ('m0', date_trunc('month', now() at time zone 'Asia/Tashkent')::date);

create temporary table tx (name text primary key, id uuid) on commit drop;
grant all on tx to authenticated;

select tests.authenticate_as((select id from u where name = 'alice'));
create temporary table inv (role text primary key, code text) on commit drop;
grant all on inv to authenticated;
insert into inv select 'member', code from public.create_invite((select id from ref where name = 'h'), 'member');
insert into inv select 'viewer', code from public.create_invite((select id from ref where name = 'h'), 'viewer');
select tests.authenticate_as((select id from u where name = 'bob'));
select public.accept_invite((select code from inv where role = 'member'));
select tests.authenticate_as((select id from u where name = 'carol'));
select public.accept_invite((select code from inv where role = 'viewer'));

-- ─── BR-071: holat bugungi sanadan (saqlanmaydi) ───────────────────────────
select tests.clear_authentication();
select results_eq(
  $$ select s.label, private.planned_status(jsonb_populate_record(null::public.planned_items, s.item), date '2026-10-10')
       from (values
         (1, 'pending', '{"due_date": "2026-10-15", "paid_amount": 0}'::jsonb),
         (2, 'overdue', '{"due_date": "2026-10-05", "paid_amount": 0}'),
         (3, 'partial', '{"due_date": "2026-10-15", "paid_amount": 50}'),
         (4, 'partial, kechikkan', '{"due_date": "2026-10-05", "paid_amount": 50}'),
         (5, 'paid', '{"due_date": "2026-10-05", "paid_amount": 100, "settled_at": "2026-10-04T10:00:00Z"}'),
         (6, 'skipped', '{"due_date": "2026-10-05", "paid_amount": 0, "skipped_at": "2026-10-01T10:00:00Z"}'),
         (7, 'bugun', '{"due_date": "2026-10-10", "paid_amount": 0}')
       ) as s (n, label, item)
      order by s.n $$,
  $$ values ('pending', 'pending'), ('overdue', 'overdue'), ('partial', 'partial'),
            ('partial, kechikkan', 'overdue'), ('paid', 'paid'), ('skipped', 'skipped'), ('bugun', 'pending') $$,
  'BR-071, BR-002: holatlar; bugungi to''lov kuni kechikkan emas'
);

-- ─── Reja cheklovlari (BR-070, BR-075, BR-081) ─────────────────────────────
select tests.authenticate_as((select id from u where name = 'bob'));
select lives_ok(
  $$ insert into public.planned_items (household_id, kind, name, category_id, planned_amount, due_date, budget_month)
     values ((select id from ref where name = 'h'), 'expense', 'Kommunal', (select id from ref where name = 'c_kommunal'),
             40000000, '2026-10-10', '2026-10-01') $$,
  'BR-011: member oy rejasini qo''shadi'
);
insert into ref select 'plan_k', p.id from public.planned_items p
  where p.household_id = (select id from ref where name = 'h') and p.name = 'Kommunal';
select tests.authenticate_as((select id from u where name = 'carol'));
select throws_ok(
  $$ insert into public.planned_items (household_id, kind, name, category_id, due_date, budget_month)
     values ((select id from ref where name = 'h'), 'expense', 'Viewer', (select id from ref where name = 'c_kommunal'), '2026-10-10', '2026-10-01') $$,
  '42501', null, 'BR-011: viewer reja qo''sha olmaydi'
);
select tests.authenticate_as((select id from u where name = 'alice'));
select throws_ok(
  $$ insert into public.planned_items (household_id, kind, name, category_id, account_id, due_date, budget_month)
     values ((select id from ref where name = 'h'), 'expense', 'Fonddan', (select id from ref where name = 'c_kommunal'),
             (select id from ref where name = 'personal_fund'), '2026-10-10', '2026-10-01') $$,
  'P0001', 'invalid_account', 'BR-062: fond hisobi byudjet rejasida qatnashmaydi'
);
select throws_ok(
  $$ insert into public.planned_items (household_id, kind, name, category_id, due_date, budget_month)
     values ((select id from ref where name = 'h'), 'allocation', 'Fond', (select id from ref where name = 'c_kommunal'), '2026-10-05', '2026-10-01') $$,
  '23514', null, 'BR-061: ajratma rejasida kategoriya bo''lmaydi'
);
select throws_ok(
  $$ insert into public.planned_items (household_id, kind, name, category_id, account_id, due_date, budget_month, auto_pay)
     values ((select id from ref where name = 'h'), 'expense', 'Suv', (select id from ref where name = 'c_kommunal'),
             (select id from ref where name = 'card'), '2026-10-10', '2026-10-01', true) $$,
  '23514', null, 'BR-075: avto to''lov noma''lum summa bilan bo''lmaydi'
);
insert into public.recurring_rules (household_id, kind, name, category_id, amount, day_of_month)
  values ((select id from ref where name = 'h'), 'expense', 'Internet', (select id from ref where name = 'c_internet/aloqa'), 15000000, 3);
insert into ref select 'rule_net', r.id from public.recurring_rules r
  where r.household_id = (select id from ref where name = 'h') and r.name = 'Internet';
insert into public.planned_items (household_id, kind, name, category_id, planned_amount, due_date, budget_month, recurring_rule_id)
  values ((select id from ref where name = 'h'), 'expense', 'Internet', (select id from ref where name = 'c_internet/aloqa'),
          15000000, '2026-10-03', '2026-10-01', (select id from ref where name = 'rule_net'));
select throws_ok(
  $$ insert into public.planned_items (household_id, kind, name, category_id, planned_amount, due_date, budget_month, recurring_rule_id)
     values ((select id from ref where name = 'h'), 'expense', 'Internet', (select id from ref where name = 'c_internet/aloqa'),
             15000000, '2026-10-03', '2026-10-01', (select id from ref where name = 'rule_net')) $$,
  '23505', null, 'BR-081: bir oyda bir shablondan bitta reja'
);

-- ─── To'lov holati (BR-071, BR-073) ────────────────────────────────────────
with ins as (
  insert into public.transactions (household_id, kind, account_id, amount, category_id, occurred_on, budget_month, planned_item_id)
  values ((select id from ref where name = 'h'), 'expense', (select id from ref where name = 'card'), 25000000,
          (select id from ref where name = 'c_kommunal'), '2026-10-08', '2026-10-01', (select id from ref where name = 'plan_k'))
  returning id
)
insert into tx select 'k1', id from ins;
select results_eq(
  $$ select paid_amount, settled_at is not null from public.planned_items where id = (select id from ref where name = 'plan_k') $$,
  $$ values (25000000::bigint, false) $$,
  'BR-073: qisman to''lov — to''langan summa yig''iladi, reja ochiq'
);
with ins as (
  insert into public.transactions (household_id, kind, account_id, amount, category_id, occurred_on, budget_month, planned_item_id)
  values ((select id from ref where name = 'h'), 'expense', (select id from ref where name = 'cash'), 15000000,
          (select id from ref where name = 'c_kommunal'), '2026-10-09', '2026-10-01', (select id from ref where name = 'plan_k'))
  returning id
)
insert into tx select 'k2', id from ins;
select results_eq(
  $$ select paid_amount, settled_at is not null from public.planned_items where id = (select id from ref where name = 'plan_k') $$,
  $$ values (40000000::bigint, true) $$,
  'BR-071: to''langan ≥ reja → to''landi (ikkinchi to''lov boshqa hisobdan)'
);
update public.transactions set deleted_at = now() where id = (select id from tx where name = 'k2');
select results_eq(
  $$ select paid_amount, settled_at is not null from public.planned_items where id = (select id from ref where name = 'plan_k') $$,
  $$ values (25000000::bigint, false) $$,
  'BR-073: to''lov o''chirilsa reja holati qaytadi'
);
update public.planned_items set closed_at = now() where id = (select id from ref where name = 'plan_k');
select ok(
  (select settled_at is not null from public.planned_items where id = (select id from ref where name = 'plan_k')),
  'BR-073: qisman to''langan reja qo''lda yopiladi'
);
update public.planned_items set closed_at = null where id = (select id from ref where name = 'plan_k');
select ok(
  (select settled_at is null from public.planned_items where id = (select id from ref where name = 'plan_k')),
  'qo''lda yopish bekor qilinsa — yana ochiq'
);
select throws_ok(
  $$ update public.planned_items set deleted_at = now() where id = (select id from ref where name = 'plan_k') $$,
  'P0001', 'planned_in_use', 'to''lovi bor reja o''chirilmaydi — o''tkazib yuboriladi'
);

insert into public.planned_items (household_id, kind, name, category_id, due_date, budget_month)
  values ((select id from ref where name = 'h'), 'expense', 'Suv', (select id from ref where name = 'c_kommunal'), '2026-10-12', '2026-10-01');
insert into ref select 'plan_suv', p.id from public.planned_items p
  where p.household_id = (select id from ref where name = 'h') and p.name = 'Suv';
insert into public.transactions (household_id, kind, account_id, amount, category_id, occurred_on, budget_month, planned_item_id)
  values ((select id from ref where name = 'h'), 'expense', (select id from ref where name = 'card'), 3700000,
          (select id from ref where name = 'c_kommunal'), '2026-10-12', '2026-10-01', (select id from ref where name = 'plan_suv'));
select ok(
  (select settled_at is not null from public.planned_items where id = (select id from ref where name = 'plan_suv')),
  'BR-071: summasi noma''lum rejaga birinchi to''lov — to''landi'
);

-- Bitta so'rovda bir nechta to'lov (bulk) — har reja bir marta hisoblanadi.
insert into public.planned_items (household_id, kind, name, category_id, planned_amount, due_date, budget_month)
  values ((select id from ref where name = 'h'), 'expense', 'Gaz', (select id from ref where name = 'c_kommunal'), 10000000, '2026-10-15', '2026-10-01'),
         ((select id from ref where name = 'h'), 'expense', 'Svet', (select id from ref where name = 'c_kommunal'), 20000000, '2026-10-15', '2026-10-01');
insert into ref select 'plan_' || lower(p.name), p.id from public.planned_items p
  where p.household_id = (select id from ref where name = 'h') and p.name in ('Gaz', 'Svet');
with ins as (
  insert into public.transactions (household_id, kind, account_id, amount, category_id, occurred_on, budget_month, planned_item_id)
  select (select id from ref where name = 'h'), 'expense', (select id from ref where name = 'card'), v.amount,
         (select id from ref where name = 'c_kommunal'), '2026-10-15', '2026-10-01', (select id from ref where name = v.plan)
    from (values ('plan_gaz', 4000000::bigint), ('plan_gaz', 6000000), ('plan_svet', 5000000)) as v (plan, amount)
  returning id, amount
)
insert into tx select 'bulk_' || amount, id from ins;
select results_eq(
  $$ select p.name::text, p.paid_amount, p.settled_at is not null from public.planned_items p
      where p.id in (select id from ref where name in ('plan_gaz', 'plan_svet')) order by p.name $$,
  $$ values ('Gaz', 10000000::bigint, true), ('Svet', 5000000::bigint, false) $$,
  'BR-074: bitta so''rovdagi bir nechta to''lov — rejalar to''g''ri yangilanadi'
);
update public.transactions set planned_item_id = (select id from ref where name = 'plan_svet')
 where id = (select id from tx where name = 'bulk_6000000');
select results_eq(
  $$ select p.name::text, p.paid_amount from public.planned_items p
      where p.id in (select id from ref where name in ('plan_gaz', 'plan_svet')) order by p.name $$,
  $$ values ('Gaz', 4000000::bigint), ('Svet', 11000000::bigint) $$,
  'to''lov boshqa rejaga ko''chsa — ikkala reja qayta hisoblanadi'
);

-- ─── 👤 Fond ajratmasi (BR-060, BR-061) ────────────────────────────────────
select tests.clear_authentication();
insert into public.planned_items (household_id, kind, name, account_id, due_date, budget_month, system_code)
  values ((select id from ref where name = 'h'), 'allocation', 'O''zim uchun', (select id from ref where name = 'cash'),
          (select v + 4 from d where name = 'm0'), (select v from d where name = 'm0'), 'personal_allocation');
insert into ref select 'plan_fund', p.id from public.planned_items p
  where p.household_id = (select id from ref where name = 'h') and p.system_code = 'personal_allocation';
select tests.authenticate_as((select id from u where name = 'alice'));

with ins as (
  insert into public.transactions (household_id, kind, account_id, amount, category_id, occurred_on, budget_month)
  values ((select id from ref where name = 'h'), 'income', (select id from ref where name = 'card'), 149960000,
          (select id from ref where name = 'c_avans'), (select v + 1 from d where name = 'm0'), (select v from d where name = 'm0'))
  returning id
)
insert into tx select 'inc1', id from ins;
select is(
  (select planned_amount from public.planned_items where id = (select id from ref where name = 'plan_fund')), 15000000::bigint,
  'BR-060: 1 499 600 × 10% → 150 000 so''m (bir marta, 1000 so''mgacha yaxlitlanadi)'
);
with ins as (
  insert into public.transactions (household_id, kind, account_id, amount, category_id, occurred_on, budget_month)
  values ((select id from ref where name = 'h'), 'income', (select id from ref where name = 'card'), 50040000,
          (select id from ref where name = 'c_avans'), (select v + 2 from d where name = 'm0'), (select v from d where name = 'm0'))
  returning id
)
insert into tx select 'inc2', id from ins;
select is(
  (select planned_amount from public.planned_items where id = (select id from ref where name = 'plan_fund')), 20000000::bigint,
  'BR-060: daromad kelgani sari ajratma rejasi oshadi (2 000 000 → 200 000)'
);
update public.transactions set deleted_at = now() where id in (select id from tx where name in ('inc1', 'inc2'));
select is(
  (select planned_amount from public.planned_items where id = (select id from ref where name = 'plan_fund')), null::bigint,
  'daromad yo''q — ajratma summasi noma''lum'
);
update public.transactions set deleted_at = null where id = (select id from tx where name = 'inc1');

with ins as (
  insert into public.transactions (household_id, kind, account_id, to_account_id, amount, occurred_on, budget_month, planned_item_id)
  values ((select id from ref where name = 'h'), 'transfer', (select id from ref where name = 'cash'), (select id from ref where name = 'personal_fund'),
          15000000, (select v + 5 from d where name = 'm0'), (select v from d where name = 'm0'), (select id from ref where name = 'plan_fund'))
  returning id
)
insert into tx select 'alloc', id from ins;
select results_eq(
  $$ select p.settled_at is not null, t.budget_month = (select v from d where name = 'm0')
       from public.planned_items p, public.transactions t
      where p.id = (select id from ref where name = 'plan_fund') and t.id = (select id from tx where name = 'alloc') $$,
  $$ values (true, true) $$,
  'BR-061: ajratma = fondga o''tkazma — reja to''landi, oyi reja oyi'
);
insert into public.transactions (household_id, kind, account_id, amount, category_id, occurred_on, budget_month)
  values ((select id from ref where name = 'h'), 'income', (select id from ref where name = 'card'), 100000000,
          (select id from ref where name = 'c_avans'), (select v + 3 from d where name = 'm0'), (select v from d where name = 'm0'));
select results_eq(
  $$ select planned_amount, paid_amount, settled_at is not null from public.planned_items where id = (select id from ref where name = 'plan_fund') $$,
  $$ values (25000000::bigint, 15000000::bigint, false) $$,
  'BR-060: to''langan ajratmadan keyin daromad oshsa — farq qisman to''lov bo''lib ko''rinadi'
);
select throws_ok(
  $$ insert into public.transactions (household_id, kind, account_id, to_account_id, amount, occurred_on, budget_month, planned_item_id)
     values ((select id from ref where name = 'h'), 'transfer', (select id from ref where name = 'personal_fund'), (select id from ref where name = 'cash'),
             100, (select v + 5 from d where name = 'm0'), (select v from d where name = 'm0'), (select id from ref where name = 'plan_fund')) $$,
  'P0001', 'planned_kind_mismatch', 'BR-061: fonddan chiquvchi o''tkazma ajratma to''lovi emas'
);

-- ─── Fond sozlamasi o'zgarganda (BR-060) ───────────────────────────────────
select tests.clear_authentication();
insert into public.planned_items (household_id, kind, name, account_id, planned_amount, due_date, budget_month, system_code)
  values ((select id from ref where name = 'h'), 'allocation', 'O''zim uchun', (select id from ref where name = 'cash'), 5000000,
          (select (v - interval '1 month')::date + 4 from d where name = 'm0'), (select (v - interval '1 month')::date from d where name = 'm0'),
          'personal_allocation');
select tests.authenticate_as((select id from u where name = 'alice'));
update public.households set personal_fund_mode = 'fixed', personal_fund_fixed_amount = 30000000
 where id = (select id from ref where name = 'h');
select is(
  (select planned_amount from public.planned_items where id = (select id from ref where name = 'plan_fund')), 30000000::bigint,
  'BR-060: qat''iy rejimga o''tilsa joriy oy rejasi — sozlamadagi summa'
);
insert into public.transactions (household_id, kind, account_id, amount, category_id, occurred_on, budget_month)
  values ((select id from ref where name = 'h'), 'income', (select id from ref where name = 'card'), 100000000,
          (select id from ref where name = 'c_avans'), (select v + 6 from d where name = 'm0'), (select v from d where name = 'm0'));
select is(
  (select planned_amount from public.planned_items where id = (select id from ref where name = 'plan_fund')), 30000000::bigint,
  'BR-060: qat''iy rejimda daromad ajratmani o''zgartirmaydi'
);
select is(
  (select planned_amount from public.planned_items
    where household_id = (select id from ref where name = 'h') and system_code = 'personal_allocation'
      and budget_month = (select (v - interval '1 month')::date from d where name = 'm0')),
  5000000::bigint,
  'sozlama o''tgan oy rejasini o''zgartirmaydi (tarix saqlanadi)'
);

select * from finish();
rollback;
