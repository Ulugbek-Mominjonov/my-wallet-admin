-- E07-T01: qarzlar, maqsadlar, oylar (BR-011, BR-110, BR-111, BR-120,
-- BR-122, BR-150, BR-194, BR-210).
begin;
select plan(17);

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
insert into ref select 'c_kredit', c.id from public.categories c
  where c.household_id = (select id from ref where name = 'h') and c.name = 'Kredit/Qarz';
insert into ref select 'c_oylik', c.id from public.categories c
  where c.household_id = (select id from ref where name = 'h') and c.name = 'Oylik';

select tests.authenticate_as((select id from u where name = 'alice'));
create temporary table inv (role text primary key, code text) on commit drop;
grant all on inv to authenticated;
insert into inv select 'member', code from public.create_invite((select id from ref where name = 'h'), 'member');
insert into inv select 'viewer', code from public.create_invite((select id from ref where name = 'h'), 'viewer');
insert into public.accounts (household_id, name, type, currency, opening_date)
  values ((select id from ref where name = 'h'), 'Dollar', 'deposit', 'USD', '2026-09-01');
insert into ref select 'usd', a.id from public.accounts a
  where a.household_id = (select id from ref where name = 'h') and a.name = 'Dollar';
select tests.authenticate_as((select id from u where name = 'bob'));
select public.accept_invite((select code from inv where role = 'member'));
select tests.authenticate_as((select id from u where name = 'carol'));
select public.accept_invite((select code from inv where role = 'viewer'));

-- ─── Qarzlar (BR-110, BR-111) ──────────────────────────────────────────────
select tests.authenticate_as((select id from u where name = 'bob'));
select lives_ok(
  $$ insert into public.debts (household_id, name, direction, currency, total, paid_before, monthly_payment)
     values ((select id from ref where name = 'h'), 'Mashina krediti', 'i_owe', 'UZS', 1000000000, 200000000, 100000000) $$,
  'BR-011: member qarz qo''shadi'
);
insert into ref select 'debt', d.id from public.debts d
  where d.household_id = (select id from ref where name = 'h') and d.name = 'Mashina krediti';
select throws_ok(
  $$ insert into public.debts (household_id, name, direction, currency, total)
     values ((select id from ref where name = 'h'), 'mashina krediti', 'i_owe', 'UZS', 100) $$,
  '23505', null, 'BR-003: qarz nomi registrsiz yagona'
);
select throws_ok(
  $$ insert into public.debts (household_id, name, direction, currency, total, paid_before)
     values ((select id from ref where name = 'h'), 'Ortiqcha', 'i_owe', 'UZS', 100, 200) $$,
  '23514', null, 'BR-110: oldin to''langan jamidan oshmaydi'
);
select throws_ok(
  $$ insert into public.debts (household_id, name, direction, currency, total)
     values ((select id from ref where name = 'h'), 'Nol', 'owed_to_me', 'UZS', 0) $$,
  '23514', null, 'BR-110: qarz summasi musbat'
);
select throws_ok(
  $$ update public.debts set direction = 'owed_to_me' where id = (select id from ref where name = 'debt') $$,
  '42501', null, 'BR-111: qarz yo''nalishi o''zgarmaydi (bog''langan amallar turiga tayanadi)'
);
select throws_ok(
  $$ update public.debts set currency = 'USD' where id = (select id from ref where name = 'debt') $$,
  '42501', null, 'BR-194: qarz valyutasi o''zgarmaydi'
);

select tests.authenticate_as((select id from u where name = 'carol'));
select throws_ok(
  $$ insert into public.debts (household_id, name, direction, currency, total)
     values ((select id from ref where name = 'h'), 'Viewerniki', 'i_owe', 'UZS', 100) $$,
  '42501', null, 'BR-011: viewer qarz qo''sha olmaydi'
);

select tests.authenticate_as((select id from u where name = 'dave'));
select is_empty(
  $$ select 1 from public.debts where household_id = (select id from ref where name = 'h') $$,
  'BR-210: begona byudjet qarzlari ko''rinmaydi'
);

-- ─── Doimiy reja → qarz (BR-111) ───────────────────────────────────────────
select tests.authenticate_as((select id from u where name = 'alice'));
select lives_ok(
  $$ insert into public.recurring_rules (household_id, kind, name, category_id, amount, day_of_month, debt_id)
     values ((select id from ref where name = 'h'), 'expense', 'Kredit to''lovi', (select id from ref where name = 'c_kredit'),
             100000000, 10, (select id from ref where name = 'debt')) $$,
  'BR-111: doimiy xarajat qarzga bog''lanadi'
);
select throws_ok(
  $$ insert into public.recurring_rules (household_id, kind, name, category_id, day_of_month, debt_id)
     values ((select id from ref where name = 'h'), 'income', 'Qaytim', (select id from ref where name = 'c_oylik'),
             10, (select id from ref where name = 'debt')) $$,
  'P0001', 'debt_kind_mismatch', 'BR-111: men qarzdor bo''lgan qarzga faqat xarajat bog''lanadi'
);

-- ─── Maqsadlar (BR-120, BR-122) ────────────────────────────────────────────
select throws_ok(
  $$ insert into public.goals (household_id, name, currency, target, account_id)
     values ((select id from ref where name = 'h'), 'Uy', 'UZS', 100000000, (select id from ref where name = 'usd')) $$,
  'P0001', 'currency_mismatch', 'BR-122: bog''langan hisob valyutasi maqsadniki bilan bir xil'
);
select lives_ok(
  $$ insert into public.goals (household_id, name, currency, target, account_id)
     values ((select id from ref where name = 'h'), 'Uy', 'USD', 5000000, (select id from ref where name = 'usd')) $$,
  'BR-122: maqsad hisobga bog''lanadi'
);
select throws_ok(
  $$ insert into public.goals (household_id, name, currency, target) values ((select id from ref where name = 'h'), 'Bo''sh', 'UZS', 0) $$,
  '23514', null, 'BR-120: maqsad summasi musbat'
);
select throws_ok(
  $$ insert into public.goals (household_id, name, currency, target, deadline)
     values ((select id from ref where name = 'h'), 'Mashina', 'UZS', 100, '2027-06-15') $$,
  '23514', null, 'BR-121: muddat — oy (oyning 1-kuni)'
);

-- ─── Oylar (BR-150) ────────────────────────────────────────────────────────
select throws_ok(
  $$ insert into public.months (household_id, month) values ((select id from ref where name = 'h'), '2026-09-01') $$,
  '42501', null, 'BR-150: oy holati faqat RPC orqali o''zgaradi'
);
select tests.clear_authentication();
insert into public.months (household_id, month, closed_at) values ((select id from ref where name = 'h'), '2026-08-01', now());

select tests.authenticate_as((select id from u where name = 'bob'));
select isnt_empty(
  $$ select 1 from public.months where household_id = (select id from ref where name = 'h') $$,
  'BR-151: a''zolar yopilgan oyni ko''radi'
);
select tests.authenticate_as((select id from u where name = 'dave'));
select is_empty(
  $$ select 1 from public.months where household_id = (select id from ref where name = 'h') $$,
  'BR-210: begona byudjet oylari ko''rinmaydi'
);

select * from finish();
rollback;
