-- E07-T08, T09: hisob qoldiqlari, qarzlar va maqsadlar holati (o'qishda
-- hisoblanadi). Qoidalar: BR-021, BR-025, BR-063, BR-112..116, BR-121, BR-122, BR-210.
begin;
select plan(5);

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
  where c.household_id = (select id from ref where name = 'h') and c.name in ('Avans', 'Oziq-ovqat', 'Kredit/Qarz');

create temporary table d (name text primary key, v date) on commit drop;
grant select on d to authenticated;
insert into d values ('m0', date_trunc('month', now() at time zone 'Asia/Tashkent')::date);

select tests.authenticate_as((select id from u where name = 'alice'));

-- ─── Hisob qoldiqlari (BR-021, BR-025, BR-063) ─────────────────────────────
update public.accounts set opening_balance = 100000000 where id = (select id from ref where name = 'card');
insert into public.transactions (household_id, kind, account_id, to_account_id, amount, category_id, occurred_on, budget_month)
select (select id from ref where name = 'h'), v.kind::public.transaction_kind,
       (select id from ref where name = v.acc), (select id from ref where name = v.to_acc), v.amount,
       (select id from ref where name = v.cat), '2026-10-05', '2026-10-01'
  from (values
    ('income',   'card',          null,            50000000::bigint, 'c_avans'),
    ('expense',  'card',          null,            20000000,         'c_oziq-ovqat'),
    ('transfer', 'card',          'cash',          5000000,          null),
    ('transfer', 'cash',          'card',          10000000,         null),
    ('transfer', 'cash',          'personal_fund', 3000000,          null),
    ('expense',  'personal_fund', null,            1000000,          null),
    ('expense',  'card',          null,            7000000,          'c_oziq-ovqat')
  ) as v (kind, acc, to_acc, amount, cat);
-- Oxirgi xarajat o'chiriladi — qoldiqqa kirmasligi kerak.
update public.transactions set deleted_at = now()
 where household_id = (select id from ref where name = 'h') and amount = 7000000;

select results_eq(
  $$ select a.type::text, b.balance from public.account_balances b
       join public.accounts a on a.id = b.account_id
      where b.household_id = (select id from ref where name = 'h') order by a.sort_order $$,
  $$ values ('cash', -8000000::bigint), ('card', 135000000::bigint), ('personal_fund', 2000000::bigint) $$,
  'BR-021: boshlang''ich + daromad − xarajat ± o''tkazmalar (o''chirilgan yo''q); BR-025 manfiy naqd; BR-063 fond qoldig''i'
);

-- ─── Qarzlar (BR-112..116) ─────────────────────────────────────────────────
insert into public.debts (household_id, name, direction, currency, total, paid_before, monthly_payment)
values ((select id from ref where name = 'h'), 'A mashina', 'i_owe', 'UZS', 1000000000, 200000000, 100000000),
       ((select id from ref where name = 'h'), 'B telefon', 'i_owe', 'UZS', 50000000, 0, null),
       ((select id from ref where name = 'h'), 'C akamga', 'owed_to_me', 'UZS', 30000000, 0, null),
       ((select id from ref where name = 'h'), 'D do''stim', 'owed_to_me', 'UZS', 10000000, 0, null);
insert into ref select 'debt_' || left(d2.name, 1), d2.id from public.debts d2
  where d2.household_id = (select id from ref where name = 'h');

insert into public.transactions (household_id, kind, account_id, amount, category_id, occurred_on, budget_month, debt_id)
values ((select id from ref where name = 'h'), 'expense', (select id from ref where name = 'card'), 100000000,
        (select id from ref where name = 'c_kredit/qarz'), '2026-10-10', '2026-10-01', (select id from ref where name = 'debt_A')),
       ((select id from ref where name = 'h'), 'income', (select id from ref where name = 'card'), 10000000,
        (select id from ref where name = 'c_avans'), '2026-10-11', '2026-10-01', (select id from ref where name = 'debt_D'));
insert into public.planned_items (household_id, kind, name, category_id, planned_amount, due_date, budget_month, debt_id)
values ((select id from ref where name = 'h'), 'expense', 'Telefon to''lovi', (select id from ref where name = 'c_kredit/qarz'),
        20000000, '2026-10-20', '2026-10-01', (select id from ref where name = 'debt_B'));

select results_eq(
  $$ select d2.name::text, b.paid_in_app, b.pending_amount, b.remaining, b.months_left, b.status
       from public.debt_balances b join public.debts d2 on d2.id = b.debt_id
      where b.household_id = (select id from ref where name = 'h') order by d2.name $$,
  $$ values ('A mashina', 100000000::bigint, 0::bigint, 700000000::bigint, 7, 'paying'),
            ('B telefon', 0, 20000000, 50000000, null, 'pending'),
            ('C akamga', 0, 0, 30000000, null, 'unlinked'),
            ('D do''stim', 10000000, 0, 0, null, 'closed') $$,
  'BR-112..116: ilovadan, kutilmoqda, qolgan, qolgan oylar va holat'
);
select results_eq(
  $$ select b.progress, b.end_month from public.debt_balances b where b.debt_id = (select id from ref where name = 'debt_A') $$,
  $$ select 0.3::numeric, ((select v from d where name = 'm0') + interval '7 months')::date $$,
  'BR-112: progress = (oldin + ilovadan) ÷ jami; tugash oyi = joriy oy + qolgan oylar'
);

-- ─── Maqsadlar (BR-121, BR-122) ────────────────────────────────────────────
insert into public.goals (household_id, name, currency, target, saved_manual, monthly_contribution, deadline, account_id)
values ((select id from ref where name = 'h'), 'G1 ta''til', 'UZS', 1000000000, 300000000, 100000000,
        ((select v from d where name = 'm0') + interval '12 months')::date, null),
       ((select id from ref where name = 'h'), 'G2 noutbuk', 'UZS', 1000000000, 0, 100000000,
        ((select v from d where name = 'm0') + interval '3 months')::date, null),
       ((select id from ref where name = 'h'), 'G3 karta', 'UZS', 200000000, 0, null, null, (select id from ref where name = 'card'));

select results_eq(
  $$ select g.name::text, p.saved, p.remaining, p.progress, p.months_left, p.on_track
       from public.goal_progress p join public.goals g on g.id = p.goal_id
      where p.household_id = (select id from ref where name = 'h') order by g.name $$,
  $$ values ('G1 ta''til', 300000000::bigint, 700000000::bigint, 0.3::numeric, 7, true),
            ('G2 noutbuk', 0, 1000000000, 0, 10, false),
            ('G3 karta', 45000000, 155000000, 0.225, null, null) $$,
  'BR-121, BR-122: qo''lda yig''ilgan va hisob qoldig''i (karta: 135 mln − qarz to''lovi 100 mln + qaytim 10 mln); muddatga ulgurish'
);

-- ─── RLS (BR-210) ──────────────────────────────────────────────────────────
select tests.authenticate_as((select id from u where name = 'dave'));
select is_empty(
  $$ select 1 from public.account_balances where household_id = (select id from ref where name = 'h')
     union all select 1 from public.debt_balances where household_id = (select id from ref where name = 'h')
     union all select 1 from public.goal_progress where household_id = (select id from ref where name = 'h') $$,
  'BR-210: view''lar so''rovchi huquqi bilan — begona byudjet ko''rinmaydi'
);

select * from finish();
rollback;
