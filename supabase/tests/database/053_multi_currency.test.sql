-- E29-T02, T03: ko'p valyuta — amal asosiy valyutaga kurs bilan o'tadi,
-- qoldiq va qarz jamlari ekvivalentda. Qoidalar: BR-190..194, ADR-08.
begin;
select plan(10);

create temporary table u (name text primary key, id uuid) on commit drop;
insert into u values ('alice', tests.create_user('alice@test.uz'));
grant select on u to authenticated;

create temporary table ref (name text primary key, id uuid) on commit drop;
grant all on ref to authenticated;
insert into ref select 'h', p.last_household_id from public.profiles p
  where p.user_id = (select id from u where name = 'alice');
insert into ref select 'c_avans', c.id from public.categories c
  where c.household_id = (select id from ref where name = 'h') and c.name = 'Avans';
insert into ref select 'cash', a.id from public.accounts a
  where a.household_id = (select id from ref where name = 'h') and a.type = 'cash';

-- Kurslar (platforma admini yozadi; testda to'g'ridan-to'g'ri).
insert into public.exchange_rates (currency, rate_date, rate_to_base, source) values
  ('USD', '2026-09-10', 12600, 'CBU'),
  ('USD', '2026-09-15', 12700, 'CBU');

select tests.authenticate_as((select id from u where name = 'alice'));
insert into public.accounts (household_id, name, type, currency, opening_balance, opening_date)
values ((select id from ref where name = 'h'), 'Dollar', 'bank', 'USD', 0, '2026-09-01');
insert into ref select 'usd', a.id from public.accounts a
  where a.household_id = (select id from ref where name = 'h') and a.currency = 'USD';

-- ─── Amal: sanadagi yoki undan oldingi eng yaqin kurs (BR-191) ─────────────
insert into public.transactions (household_id, kind, account_id, amount, category_id,
                                 occurred_on, budget_month)
values ((select id from ref where name = 'h'), 'income', (select id from ref where name = 'usd'),
        10000, (select id from ref where name = 'c_avans'), '2026-09-12', '2026-09-01');
select results_eq(
  $$ select fx_rate, amount_base from public.transactions
      where account_id = (select id from ref where name = 'usd') $$,
  $$ values (12600::numeric, 126000000::bigint) $$,
  'BR-191: 12.09 uchun 10.09 kursi (eng yaqin oldingi), amount_base = 100 USD × 12 600'
);

-- Qo'lda kurs ustun (BR-193).
update public.transactions set fx_rate = 13000
 where account_id = (select id from ref where name = 'usd');
select is(
  (select amount_base from public.transactions where account_id = (select id from ref where name = 'usd')),
  130000000::bigint,
  'BR-193: qo''lda kiritilgan kurs ustun'
);

-- Kursi yo'q sana — yoziladi emas.
select throws_ok(
  $$ insert into public.transactions (household_id, kind, account_id, amount, category_id,
                                      occurred_on, budget_month)
     values ((select id from ref where name = 'h'), 'income', (select id from ref where name = 'usd'),
             5000, (select id from ref where name = 'c_avans'), '2026-09-05', '2026-09-01') $$,
  'P0001', 'fx_rate_missing', 'kurs yo''q kun — amal yozilmaydi'
);

-- ─── O'tkazma: valyutalar har xil bo'lsa to_amount majburiy (BR-192) ───────
select throws_ok(
  $$ insert into public.transactions (household_id, kind, account_id, to_account_id, amount,
                                      occurred_on, budget_month)
     values ((select id from ref where name = 'h'), 'transfer', (select id from ref where name = 'usd'),
             (select id from ref where name = 'cash'), 1000, '2026-09-15', '2026-09-01') $$,
  'P0001', 'to_amount_required', 'boshqa valyutaga o''tkazmada summa ikkala tomonda'
);
insert into public.transactions (household_id, kind, account_id, to_account_id, amount, to_amount,
                                 occurred_on, budget_month)
values ((select id from ref where name = 'h'), 'transfer', (select id from ref where name = 'usd'),
        (select id from ref where name = 'cash'), 1000, 12700000, '2026-09-15', '2026-09-01');

-- ─── Qoldiq: o'z valyutasida va ekvivalentda (BR-021, BR-194) ──────────────
select results_eq(
  $$ select balance, balance_base from public.account_balances
      where account_id = (select id from ref where name = 'usd') $$,
  $$ values (9000::bigint, 114300000::bigint) $$,
  'BR-194: 90 USD — o''z valyutasida; ekvivalent joriy (oxirgi) kurs bilan'
);
select is(
  (select balance_base from public.account_balances
    where account_id = (select id from ref where name = 'cash')),
  (select balance from public.account_balances
    where account_id = (select id from ref where name = 'cash')),
  'asosiy valyutadagi hisobda ekvivalent = qoldiq'
);

-- ─── Qarz: boshqa valyutada ham jamga kiradi (E29-T03) ─────────────────────
insert into public.debts (household_id, name, direction, currency, total, paid_before, monthly_payment)
values ((select id from ref where name = 'h'), 'Aka', 'i_owe', 'USD', 20000, 0, 5000);
select results_eq(
  $$ select remaining, remaining_base from public.debt_balances b
       join public.debts d on d.id = b.debt_id where d.name = 'Aka' $$,
  $$ values (20000::bigint, 254000000::bigint) $$,
  'qarz qoldig''i o''z valyutasida va ekvivalentda'
);
select is(
  ((public.report_debts((select id from ref where name = 'h')) #>> '{totals,i_owe}')::bigint),
  254000000::bigint,
  'BR-114: jam — boshqa valyutadagi qarz ham hisobga olinadi'
);
select is(
  ((public.report_month((select id from ref where name = 'h'), '2026-09-01') #>> '{debts,i_owe}')::bigint),
  254000000::bigint,
  'oylik hisobotdagi qarz jami ham ekvivalentda'
);

-- ─── E29-T06: asosiy valyutadagi yozuvlar o'zgarmaydi ──────────────────────
-- Naqd (UZS) hisobda amal: qayta hisob `amount_base` ni o'zgartirmaydi.
insert into public.transactions (household_id, kind, account_id, amount, category_id,
                                 occurred_on, budget_month)
values ((select id from ref where name = 'h'), 'expense', (select id from ref where name = 'cash'),
        1500000, (select c.id from public.categories c
                   where c.household_id = (select id from ref where name = 'h')
                     and c.kind = 'expense' limit 1), '2026-09-16', '2026-09-01');
update public.transactions set amount = amount
 where account_id = (select id from ref where name = 'cash');
select is_empty(
  $$ select t.id from public.transactions t
       join public.accounts a on a.id = t.account_id
       join public.households h on h.id = t.household_id
      where a.currency = h.base_currency and t.amount_base <> t.amount $$,
  'E29-T06: asosiy valyutadagi hisobda amount_base = amount (qayta hisobdan keyin ham)'
);

select * from finish();
rollback;
