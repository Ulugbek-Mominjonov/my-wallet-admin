-- E07-T03, T04, T07: amallar — cheklovlar, tegishli oy, asosiy valyuta,
-- oy qulfi. Qoidalar: BR-011, BR-024, BR-026, BR-036, BR-040..046,
-- BR-050..055, BR-062, BR-063, BR-111, BR-191..193, BR-200, BR-210.
begin;
select plan(38);

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
    and c.name in ('Avans', 'Oylik', 'KPI', 'Qo''shimcha', 'Oziq-ovqat', 'Kredit/Qarz', 'Kiyim');

-- Yozuv yordamchisi: amal id'sini ref'ga nom bilan saqlaydi.
create temporary table tx (name text primary key, id uuid) on commit drop;
grant all on tx to authenticated;

select tests.authenticate_as((select id from u where name = 'alice'));
create temporary table inv (role text primary key, code text) on commit drop;
grant all on inv to authenticated;
insert into inv select 'member', code from public.create_invite((select id from ref where name = 'h'), 'member');
insert into inv select 'viewer', code from public.create_invite((select id from ref where name = 'h'), 'viewer');
insert into public.accounts (household_id, name, type, currency, opening_date)
  values ((select id from ref where name = 'h'), 'Dollar', 'card', 'USD', '2026-09-01');
insert into ref select 'usd', a.id from public.accounts a
  where a.household_id = (select id from ref where name = 'h') and a.name = 'Dollar';
select tests.authenticate_as((select id from u where name = 'bob'));
select public.accept_invite((select code from inv where role = 'member'));
select tests.authenticate_as((select id from u where name = 'carol'));
select public.accept_invite((select code from inv where role = 'viewer'));

-- ─── BR-040: daromadning tegishli oyi (hujjatdagi jadval) ──────────────────
select tests.authenticate_as((select id from u where name = 'alice'));
with ins as (
  insert into public.transactions (household_id, kind, account_id, amount, category_id, occurred_on, budget_month)
  values
    ((select id from ref where name = 'h'), 'income', (select id from ref where name = 'card'), 1000000, (select id from ref where name = 'c_oylik'), '2026-10-02', '2026-10-01'),
    ((select id from ref where name = 'h'), 'income', (select id from ref where name = 'card'), 1000000, (select id from ref where name = 'c_kpi'), '2026-10-06', '2026-10-01'),
    ((select id from ref where name = 'h'), 'income', (select id from ref where name = 'card'), 1000000, (select id from ref where name = 'c_avans'), '2026-10-16', '2026-10-01'),
    ((select id from ref where name = 'h'), 'income', (select id from ref where name = 'card'), 1000000, (select id from ref where name = 'c_qo''shimcha'), '2026-10-18', '2026-10-01')
  returning id, occurred_on
)
insert into tx select 'inc_' || to_char(occurred_on, 'MMDD'), id from ins;
select results_eq(
  $$ select to_char(t.occurred_on, 'DD.MM'), to_char(t.budget_month, 'YYYY-MM') from public.transactions t
      join tx on tx.id = t.id where tx.name like 'inc_%' order by t.occurred_on $$,
  $$ values ('02.10', '2026-09'), ('06.10', '2026-09'), ('16.10', '2026-10'), ('18.10', '2026-09') $$,
  'BR-040: 02.10 Oylik → 09, 06.10 KPI → 09, 16.10 Avans → 10, 18.10 Qo''shimcha → 09'
);

-- ─── BR-041, BR-042: qo'lda tanlangan oy ───────────────────────────────────
with ins as (
  insert into public.transactions (household_id, kind, account_id, amount, category_id, occurred_on, budget_month, budget_month_source)
  values ((select id from ref where name = 'h'), 'expense', (select id from ref where name = 'card'), 500000,
          (select id from ref where name = 'c_kredit/qarz'), '2026-10-05', '2026-09-01', 'manual')
  returning id
)
insert into tx select 'manual_exp', id from ins;
select is(
  (select budget_month::date from public.transactions where id = (select id from tx where name = 'manual_exp')), date '2026-09-01',
  'BR-041: 5-oktabrdagi kredit to''lovi qo''lda sentabrga biriktiriladi'
);
select lives_ok(
  $$ insert into public.transactions (household_id, kind, account_id, amount, category_id, occurred_on, budget_month)
     values ((select id from ref where name = 'h'), 'expense', (select id from ref where name = 'card'), 500000,
             (select id from ref where name = 'c_oziq-ovqat'), '2026-10-05', '2026-01-01') $$,
  'avto rejim: klient yuborgan oy e''tiborga olinmaydi'
);
select is(
  (select budget_month::date from public.transactions
    where household_id = (select id from ref where name = 'h') and category_id = (select id from ref where name = 'c_oziq-ovqat')),
  date '2026-10-01',
  'BR-041: xarajatning tegishli oyi — to''lov sanasi oyi'
);
with ins as (
  insert into public.transactions (household_id, kind, account_id, amount, category_id, occurred_on, budget_month, budget_month_source)
  values ((select id from ref where name = 'h'), 'income', (select id from ref where name = 'card'), 700000,
          (select id from ref where name = 'c_oylik'), '2026-10-20', '2026-10-01', 'manual')
  returning id
)
insert into tx select 'manual_inc', id from ins;
select is(
  (select budget_month::date from public.transactions where id = (select id from tx where name = 'manual_inc')), date '2026-10-01',
  'BR-042: daromadga ham qo''lda oy (qoida o''rniga)'
);

-- ─── BR-043: siljish o'zgarsa eski yozuv o'z-o'zidan ko'chmaydi ────────────
update public.categories set month_shift = 0 where id = (select id from ref where name = 'c_kpi');
update public.transactions set note = 'KPI 3-chorak' where id = (select id from tx where name = 'inc_1006');
select is(
  (select budget_month::date from public.transactions where id = (select id from tx where name = 'inc_1006')), date '2026-09-01',
  'BR-043: izoh tahriri yozuvni yangi siljish bo''yicha ko''chirmaydi'
);
update public.transactions set occurred_on = '2026-10-07' where id = (select id from tx where name = 'inc_1006');
select is(
  (select budget_month::date from public.transactions where id = (select id from tx where name = 'inc_1006')), date '2026-10-01',
  'sana o''zgarsa tegishli oy joriy siljish bilan qayta hisoblanadi'
);

-- ─── BR-044, BR-046: reja oyi va o'tkazma oyi ──────────────────────────────
insert into public.planned_items (household_id, kind, name, category_id, planned_amount, due_date, budget_month)
values ((select id from ref where name = 'h'), 'expense', 'Internet', (select id from ref where name = 'c_kredit/qarz'),
        150000, '2026-10-03', '2026-09-01');
insert into ref select 'plan_net', p.id from public.planned_items p
  where p.household_id = (select id from ref where name = 'h') and p.name = 'Internet';
with ins as (
  insert into public.transactions (household_id, kind, account_id, amount, category_id, occurred_on, budget_month, planned_item_id)
  values ((select id from ref where name = 'h'), 'expense', (select id from ref where name = 'card'), 150000,
          (select id from ref where name = 'c_kredit/qarz'), '2026-10-03', '2026-10-01', (select id from ref where name = 'plan_net'))
  returning id
)
insert into tx select 'plan_pay', id from ins;
select is(
  (select budget_month::date from public.transactions where id = (select id from tx where name = 'plan_pay')), date '2026-09-01',
  'BR-044: reja to''lovi reja oyiga tegishli (to''lov keyingi oyda bo''lsa ham)'
);
with ins as (
  insert into public.transactions (household_id, kind, account_id, to_account_id, amount, occurred_on, budget_month)
  values ((select id from ref where name = 'h'), 'transfer', (select id from ref where name = 'card'),
          (select id from ref where name = 'cash'), 300000, '2026-10-12', '2026-01-01')
  returning id
)
insert into tx select 'transfer', id from ins;
select results_eq(
  $$ select budget_month::date, to_amount from public.transactions where id = (select id from tx where name = 'transfer') $$,
  $$ values (date '2026-10-01', 300000::bigint) $$,
  'BR-046, BR-053: o''tkazma — sana oyi; bir valyutada manzil summasi = summa'
);

-- ─── Tur cheklovlari (BR-050..053) ─────────────────────────────────────────
select throws_ok(
  $$ insert into public.transactions (household_id, kind, account_id, amount, occurred_on, budget_month)
     values ((select id from ref where name = 'h'), 'income', (select id from ref where name = 'card'), 100, '2026-10-01', '2026-10-01') $$,
  '23514', null, 'BR-050: daromad kategoriyasiz bo''lmaydi'
);
select throws_ok(
  $$ insert into public.transactions (household_id, kind, account_id, to_account_id, amount, occurred_on, budget_month)
     values ((select id from ref where name = 'h'), 'transfer', (select id from ref where name = 'card'),
             (select id from ref where name = 'card'), 100, '2026-10-01', '2026-10-01') $$,
  '23514', null, 'BR-053: manba va manzil bir xil bo''lmaydi'
);
select throws_ok(
  $$ insert into public.transactions (household_id, kind, account_id, to_account_id, amount, category_id, occurred_on, budget_month)
     values ((select id from ref where name = 'h'), 'transfer', (select id from ref where name = 'card'),
             (select id from ref where name = 'cash'), 100, (select id from ref where name = 'c_kiyim'), '2026-10-01', '2026-10-01') $$,
  '23514', null, 'BR-023: o''tkazma kategoriyasiz'
);
select throws_ok(
  $$ insert into public.transactions (household_id, kind, account_id, amount, category_id, occurred_on, budget_month)
     values ((select id from ref where name = 'h'), 'expense', (select id from ref where name = 'card'), 0,
             (select id from ref where name = 'c_kiyim'), '2026-10-01', '2026-10-01') $$,
  '23514', null, 'BR-051: summa musbat'
);
select throws_ok(
  $$ insert into public.transactions (household_id, kind, account_id, amount, category_id, occurred_on, budget_month)
     values ((select id from ref where name = 'h'), 'expense', (select id from ref where name = 'card'), 100,
             (select id from ref where name = 'c_oylik'), '2026-10-01', '2026-10-01') $$,
  'P0001', 'category_kind_mismatch', 'xarajatga daromad turi tanlanmaydi'
);

-- ─── 👤 Fond hisobi (BR-062, BR-063) ───────────────────────────────────────
with ins as (
  insert into public.transactions (household_id, kind, account_id, amount, occurred_on, budget_month)
  values ((select id from ref where name = 'h'), 'expense', (select id from ref where name = 'personal_fund'), 4500000, '2026-10-05', '2026-10-01')
  returning id
)
insert into tx select 'fund_spend', id from ins;
select is(
  (select c.system_code::text from public.transactions t join public.categories c on c.id = t.category_id
    where t.id = (select id from tx where name = 'fund_spend')),
  'personal_allocation',
  'BR-062: fonddan sarf kategoriyasiz kiritilsa — "O''zim uchun"'
);
select throws_ok(
  $$ insert into public.transactions (household_id, kind, account_id, amount, category_id, occurred_on, budget_month)
     values ((select id from ref where name = 'h'), 'income', (select id from ref where name = 'personal_fund'), 100,
             (select id from ref where name = 'c_avans'), '2026-10-01', '2026-10-01') $$,
  'P0001', 'invalid_account', 'BR-063: fondga daromad yozilmaydi (faqat ajratma o''tkazmasi)'
);

-- ─── Ko'p valyuta (BR-191..193) ────────────────────────────────────────────
select throws_ok(
  $$ insert into public.transactions (household_id, kind, account_id, amount, category_id, occurred_on, budget_month)
     values ((select id from ref where name = 'h'), 'expense', (select id from ref where name = 'usd'), 1000,
             (select id from ref where name = 'c_kiyim'), '2026-10-01', '2026-10-01') $$,
  'P0001', 'fx_rate_missing', 'BR-191: kurs yo''q bo''lsa asosiy valyutadagi summa taxmin qilinmaydi'
);
with ins as (
  insert into public.transactions (household_id, kind, account_id, amount, fx_rate, category_id, occurred_on, budget_month)
  values ((select id from ref where name = 'h'), 'expense', (select id from ref where name = 'usd'), 1000, 12650,
          (select id from ref where name = 'c_kiyim'), '2026-10-01', '2026-10-01')
  returning id
)
insert into tx select 'usd_manual', id from ins;
select is(
  (select amount_base from public.transactions where id = (select id from tx where name = 'usd_manual')), 12650000::bigint,
  'BR-192: foydalanuvchi kursi bilan: 10.00 USD × 12 650 = 126 500 so''m'
);
select tests.clear_authentication();
insert into public.exchange_rates (currency, rate_date, rate_to_base) values ('USD', '2026-10-01', 12600), ('USD', '2026-10-10', 12700);
select tests.authenticate_as((select id from u where name = 'alice'));
with ins as (
  insert into public.transactions (household_id, kind, account_id, amount, category_id, occurred_on, budget_month)
  values ((select id from ref where name = 'h'), 'expense', (select id from ref where name = 'usd'), 1000,
          (select id from ref where name = 'c_kiyim'), '2026-10-08', '2026-10-01')
  returning id
)
insert into tx select 'usd_cbu', id from ins;
select results_eq(
  $$ select amount_base, fx_rate from public.transactions where id = (select id from tx where name = 'usd_cbu') $$,
  $$ values (12600000::bigint, 12600::numeric) $$,
  'BR-191: sanadagi yoki undan oldingi eng yaqin CBU kursi'
);
select throws_ok(
  $$ insert into public.transactions (household_id, kind, account_id, to_account_id, amount, occurred_on, budget_month)
     values ((select id from ref where name = 'h'), 'transfer', (select id from ref where name = 'usd'),
             (select id from ref where name = 'cash'), 1000, '2026-10-12', '2026-10-01') $$,
  'P0001', 'to_amount_required', 'BR-193: turli valyutali o''tkazmada ikkala summa kiritiladi'
);
select throws_ok(
  $$ update public.transactions set amount_base = 1 where id = (select id from tx where name = 'usd_cbu') $$,
  '42501', null, 'ADR-08: asosiy valyutadagi summa klientdan yozilmaydi'
);

-- ─── Hisob va kategoriya himoyasi (BR-024, BR-026, BR-036) ─────────────────
select throws_ok(
  $$ update public.accounts set currency = 'EUR' where id = (select id from ref where name = 'usd') $$,
  'P0001', 'account_currency_locked', 'BR-026: amali bor hisob valyutasi o''zgarmaydi'
);
select throws_ok(
  $$ update public.accounts set deleted_at = now() where id = (select id from ref where name = 'usd') $$,
  'P0001', 'account_in_use', 'BR-024: amali bor hisob o''chirilmaydi — arxivlanadi'
);
select throws_ok(
  $$ update public.categories set deleted_at = now() where id = (select id from ref where name = 'c_kiyim') $$,
  'P0001', 'category_in_use', 'BR-036: amali bor kategoriya o''chirilmaydi'
);

-- ─── Qarz va reja bog'lanishi (BR-111, BR-073) ─────────────────────────────
insert into public.debts (household_id, name, direction, currency, total)
  values ((select id from ref where name = 'h'), 'Akamdan', 'owed_to_me', 'UZS', 1000000);
insert into ref select 'debt', d.id from public.debts d
  where d.household_id = (select id from ref where name = 'h') and d.name = 'Akamdan';
select throws_ok(
  $$ insert into public.transactions (household_id, kind, account_id, amount, category_id, occurred_on, budget_month, debt_id)
     values ((select id from ref where name = 'h'), 'expense', (select id from ref where name = 'card'), 100,
             (select id from ref where name = 'c_kiyim'), '2026-10-01', '2026-10-01', (select id from ref where name = 'debt')) $$,
  'P0001', 'debt_kind_mismatch', 'BR-111: menga qarzdor qarzga faqat daromad bog''lanadi'
);
insert into public.transactions (household_id, kind, account_id, amount, category_id, occurred_on, budget_month, debt_id)
  values ((select id from ref where name = 'h'), 'income', (select id from ref where name = 'card'), 200000,
          (select id from ref where name = 'c_avans'), '2026-10-02', '2026-10-01', (select id from ref where name = 'debt'));
select throws_ok(
  $$ update public.debts set deleted_at = now() where id = (select id from ref where name = 'debt') $$,
  'P0001', 'debt_in_use', 'BR-110: bog''langan amali bor qarz o''chirilmaydi (arxivlanadi)'
);
select throws_ok(
  $$ insert into public.transactions (household_id, kind, account_id, amount, category_id, occurred_on, budget_month, planned_item_id)
     values ((select id from ref where name = 'h'), 'income', (select id from ref where name = 'card'), 100,
             (select id from ref where name = 'c_avans'), '2026-10-01', '2026-10-01', (select id from ref where name = 'plan_net')) $$,
  'P0001', 'planned_kind_mismatch', 'xarajat rejasiga daromad bog''lanmaydi'
);
update public.planned_items set skipped_at = now() where id = (select id from ref where name = 'plan_net');
select throws_ok(
  $$ insert into public.transactions (household_id, kind, account_id, amount, category_id, occurred_on, budget_month, planned_item_id)
     values ((select id from ref where name = 'h'), 'expense', (select id from ref where name = 'card'), 100,
             (select id from ref where name = 'c_kredit/qarz'), '2026-10-04', '2026-10-01', (select id from ref where name = 'plan_net')) $$,
  'P0001', 'planned_skipped', 'BR-071: o''tkazib yuborilgan rejaga to''lov bog''lanmaydi'
);

-- ─── Teglar (BR-200) ───────────────────────────────────────────────────────
insert into public.tags (household_id, name) values ((select id from ref where name = 'h'), 'safar'), ((select id from ref where name = 'h'), 'eski');
select lives_ok(
  $$ insert into public.transaction_tags (household_id, transaction_id, tag_id)
     values ((select id from ref where name = 'h'), (select id from tx where name = 'transfer'),
             (select g.id from public.tags g where g.name = 'safar' and g.household_id = (select id from ref where name = 'h'))) $$,
  'BR-200: amalga teg qo''yiladi'
);
update public.tags set deleted_at = now() where household_id = (select id from ref where name = 'h') and name = 'eski';
select throws_ok(
  $$ insert into public.transaction_tags (household_id, transaction_id, tag_id)
     values ((select id from ref where name = 'h'), (select id from tx where name = 'transfer'),
             (select g.id from public.tags g where g.name = 'eski' and g.household_id = (select id from ref where name = 'h'))) $$,
  'P0001', 'tag_deleted', 'o''chirilgan teg qo''yilmaydi'
);

-- ─── Rollar (BR-011, BR-210) ───────────────────────────────────────────────
select tests.authenticate_as((select id from u where name = 'bob'));
select lives_ok(
  $$ insert into public.transactions (household_id, kind, account_id, amount, category_id, occurred_on, budget_month)
     values ((select id from ref where name = 'h'), 'expense', (select id from ref where name = 'cash'), 2000000,
             (select id from ref where name = 'c_oziq-ovqat'), '2026-10-09', '2026-10-01') $$,
  'BR-011: member amal yozadi'
);
select tests.authenticate_as((select id from u where name = 'carol'));
select throws_ok(
  $$ insert into public.transactions (household_id, kind, account_id, amount, category_id, occurred_on, budget_month)
     values ((select id from ref where name = 'h'), 'expense', (select id from ref where name = 'cash'), 100,
             (select id from ref where name = 'c_oziq-ovqat'), '2026-10-09', '2026-10-01') $$,
  '42501', null, 'BR-011: viewer amal yoza olmaydi'
);
select tests.authenticate_as((select id from u where name = 'dave'));
select is_empty(
  $$ select 1 from public.transactions where household_id = (select id from ref where name = 'h') $$,
  'BR-210: begona byudjet amallari ko''rinmaydi'
);

-- ─── Oy qulfi (BR-055, BR-150..152) ────────────────────────────────────────
select tests.clear_authentication();
insert into public.months (household_id, month, closed_at) values ((select id from ref where name = 'h'), '2026-08-01', now());
select tests.authenticate_as((select id from u where name = 'alice'));
with ins as (
  insert into public.transactions (household_id, kind, account_id, amount, category_id, occurred_on, budget_month)
  values ((select id from ref where name = 'h'), 'expense', (select id from ref where name = 'cash'), 100,
          (select id from ref where name = 'c_oziq-ovqat'), '2026-08-20', '2026-08-01')
  returning id
)
insert into tx select 'august', id from ins;
select isnt_empty(
  $$ select 1 from tx where name = 'august' $$,
  'BR-055: qattiq qulf o''chiq — yopilgan oyga yozuv o''tadi (klient ogohlantiradi)'
);
update public.households set strict_month_lock = true where id = (select id from ref where name = 'h');
select throws_ok(
  $$ insert into public.transactions (household_id, kind, account_id, amount, category_id, occurred_on, budget_month)
     values ((select id from ref where name = 'h'), 'expense', (select id from ref where name = 'cash'), 100,
             (select id from ref where name = 'c_oziq-ovqat'), '2026-08-21', '2026-08-01') $$,
  'P0001', 'month_closed', 'BR-055: qattiq qulfda yopilgan oyga yangi amal yozilmaydi'
);
select throws_ok(
  $$ update public.transactions set amount = 200 where id = (select id from tx where name = 'august') $$,
  'P0001', 'month_closed', 'BR-152: qattiq qulfda yopilgan oy amali tahrirlanmaydi'
);
select throws_ok(
  $$ update public.transactions set occurred_on = '2026-09-01' where id = (select id from tx where name = 'august') $$,
  'P0001', 'month_closed', 'yopilgan oydan amal ko''chirib chiqarilmaydi'
);
select throws_ok(
  $$ update public.transactions set deleted_at = now() where id = (select id from tx where name = 'august') $$,
  'P0001', 'month_closed', 'qattiq qulfda yopilgan oy amali o''chirilmaydi'
);

select * from finish();
rollback;
