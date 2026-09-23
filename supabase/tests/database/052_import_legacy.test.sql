-- E27-T03 (BR-181): eski Sheets byudjetini ko'chirish — dry-run hech narsa
-- yozmaydi, natija Sheets yakunlari bilan teng; qayta import idempotent.
begin;
select plan(12);

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

-- Namunaviy eksport (scripts/fixtures/legacy-v1.json bilan bir xil ma'no):
-- 2 oy, reja+fakt, faqat fakt, to'lanmagan reja, fond ajratmasi va sarfi.
create temporary table payload (v jsonb) on commit drop;
grant all on payload to authenticated;
insert into payload values ($json$
{
  "version": 1,
  "settings": {
    "personalFund": {"mode": "percent", "value": 12, "method": "card", "day": 7},
    "incomeRules": [{"type": "Oylik", "shift": -1}, {"type": "Avans", "shift": 0}],
    "limits": [{"category": "Oziq-ovqat", "monthlyLimit": 2000000}],
    "recurring": [{"name": "Ijara", "category": "Ijara", "amount": 3000000,
                   "method": "card", "day": 5, "autoPay": true}],
    "quickAdd": [{"name": "Kofe", "amount": 25000, "category": "Ko'ngilochar", "method": "cash"}],
    "reminders": {"telegram": true, "email": "", "kun": 4, "soat": 8,
                  "oylik": true, "hisobotKuni": 25}
  },
  "incomes": [
    {"monthKey": "2026-08", "paidAt": "2026-09-02", "type": "Oylik", "method": "card", "amount": 8000000},
    {"monthKey": "2026-08", "paidAt": "2026-08-20", "type": "Avans", "method": "cash", "amount": 2000000},
    {"monthKey": "2026-09", "paidAt": "2026-10-02", "type": "Oylik", "method": "card", "amount": 8500000}
  ],
  "expenses": [
    {"monthKey": "2026-08", "dueDate": "2026-08-05", "name": "Ijara", "category": "Ijara",
     "method": "card", "planned": 3000000, "actual": 3000000, "autoPay": true},
    {"monthKey": "2026-08", "dueDate": "2026-08-12", "name": "Korzinka", "category": "Oziq-ovqat",
     "method": "cash", "planned": null, "actual": 1200000},
    {"monthKey": "2026-08", "dueDate": "2026-08-10", "name": "Internet", "category": "Internet/Aloqa",
     "method": "card", "planned": 300000, "actual": null},
    {"monthKey": "2026-08", "dueDate": "2026-08-05", "name": "O'zim uchun", "category": "O'zim uchun",
     "method": "card", "planned": 1000000, "actual": 1000000},
    {"monthKey": "2026-09", "dueDate": "2026-09-05", "name": "Ijara", "category": "Ijara",
     "method": "card", "planned": 3000000, "actual": 3000000, "autoPay": true},
    {"monthKey": "2026-09", "dueDate": "2026-09-18", "name": "Yandex Go", "category": "Transport",
     "method": "cash", "planned": null, "actual": 500000},
    {"monthKey": "2026-09", "dueDate": "2026-09-05", "name": "O'zim uchun", "category": "O'zim uchun",
     "method": "card", "planned": 1000000, "actual": 1000000},
    {"monthKey": "2026-09", "dueDate": "2026-09-15", "name": "Kredit to'lovi", "category": "Kredit/Qarz",
     "method": "card", "planned": 1500000, "actual": 1500000, "debtName": "Hamkor bank"}
  ],
  "personalSpends": [
    {"monthKey": "2026-08", "spentAt": "2026-08-15", "amount": 400000, "purpose": "Kitob", "method": "cash"},
    {"monthKey": "2026-09", "spentAt": "2026-09-10", "amount": 250000, "purpose": "Kino", "method": "card"}
  ],
  "debts": [{"name": "Hamkor bank", "direction": "iOwe", "total": 15000000,
             "paidBefore": 3000000, "monthly": 1500000}],
  "goals": [{"name": "Ta'til", "target": 12000000, "saved": 4000000,
             "monthly": 1000000, "deadline": "2027-06-01"}],
  "expectedMonths": [
    {"monthKey": "2026-08", "income": 10000000, "expense": 5200000, "balance": 4800000,
     "saved": 5400000, "personalAllocated": 1000000, "personalSpent": 400000},
    {"monthKey": "2026-09", "income": 8500000, "expense": 6000000, "balance": 2500000,
     "saved": 3250000, "personalAllocated": 1000000, "personalSpent": 250000}
  ]
}
$json$::jsonb);

-- ─── Huquq va versiya ──────────────────────────────────────────────────────
select tests.authenticate_as((select id from u where name = 'bob'));
select throws_ok(
  $$ select public.import_legacy_v1((select id from ref where name = 'h'), (select v from payload)) $$,
  'P0001', 'forbidden', 'BR-011: ko''chirish — owner/admin'
);
select tests.authenticate_as((select id from u where name = 'alice'));
select throws_ok(
  $$ select public.import_legacy_v1((select id from ref where name = 'h'), '{"version": 2}'::jsonb) $$,
  'P0001', 'unsupported_version', 'faqat v1 formati'
);

-- ─── Dry-run ───────────────────────────────────────────────────────────────
insert into r select 'dry', public.import_legacy_v1((select id from ref where name = 'h'),
                                                    (select v from payload));
select is(
  (select count(*) from public.transactions where household_id = (select id from ref where name = 'h')),
  0::bigint,
  'dry-run hech narsa yozmaydi'
);
select results_eq(
  $$ select (v -> 'dry_run')::boolean, (v #>> '{counts,incomes}')::int,
            (v #>> '{counts,expenses}')::int, (v #>> '{counts,plans}')::int,
            (v #>> '{counts,allocations}')::int, (v #>> '{counts,fund_spends}')::int
       from r where name = 'dry' $$,
  $$ values (true, 3, 5, 6, 2, 2) $$,
  'dry-run natijasi: nechta yozuv tushadi'
);
select results_eq(
  $$ select x ->> 'month', (x #>> '{diff,balance}')::bigint, (x #>> '{diff,saved}')::bigint
       from r, jsonb_array_elements(v -> 'months') x where name = 'dry' order by 1 $$,
  $$ values ('2026-08-01', 0::bigint, 0::bigint), ('2026-09-01', 0::bigint, 0::bigint) $$,
  'BR-181: har oy uchun qoldiq va orttirgan Sheets bilan aynan teng'
);

-- ─── Haqiqiy import ────────────────────────────────────────────────────────
insert into r select 'apply', public.import_legacy_v1((select id from ref where name = 'h'),
                                                      (select v from payload), false);
select is(
  (select count(*) from public.transactions
    where household_id = (select id from ref where name = 'h') and deleted_at is null),
  12::bigint,
  'amallar yozildi (3 daromad + 5 xarajat + 2 ajratma + 2 fond sarfi)'
);
select results_eq(
  $$ select t.kind::text, t.budget_month::text, t.budget_month_source::text, t.amount
       from public.transactions t
       join public.categories c on c.id = t.category_id
      where t.household_id = (select id from ref where name = 'h')
        and c.name = 'Oylik' and t.deleted_at is null order by t.budget_month $$,
  $$ values ('income', '2026-08-01', 'manual', 800000000::bigint),
            ('income', '2026-09-01', 'manual', 850000000::bigint) $$,
  'BR-042: daromad oyi eski taqsimotda (qo''lda) qoladi'
);
select is(
  (select p.paid_amount from public.planned_items p
    where p.household_id = (select id from ref where name = 'h')
      and p.kind = 'allocation' and p.budget_month = '2026-08-01' and p.deleted_at is null),
  100000000::bigint,
  'BR-061: "O''zim uchun" — ajratma rejasi va fondga o''tkazma bilan to''langan'
);
select is(
  (select count(*) from public.transactions t
     join public.debts d on d.id = t.debt_id
    where t.household_id = (select id from ref where name = 'h') and d.name = 'Hamkor bank'
      and t.deleted_at is null),
  1::bigint,
  'qarz to''lovi nom bo''yicha bog''landi'
);

select results_eq(
  $$ select h.personal_fund_mode::text, h.personal_fund_percent, h.personal_fund_day::int,
            h.personal_fund_source_account_id = (select a.id from public.accounts a
              where a.household_id = h.id and a.type = 'card')
       from public.households h where h.id = (select id from ref where name = 'h') $$,
  $$ values ('percent', 12.00::numeric, 7, true) $$,
  'BR-060: fond qoidasi (foiz, kun, manba hisobi) ko''chdi'
);
select results_eq(
  $$ select (select count(*) from public.recurring_rules where household_id = (select id from ref where name = 'h')),
            (select count(*) from public.quick_actions where household_id = (select id from ref where name = 'h')),
            (select np.reminder_hour::int from public.notification_prefs np
              where np.household_id = (select id from ref where name = 'h')
                and np.user_id = (select id from u where name = 'alice')) $$,
  $$ values (1::bigint, 1::bigint, 8) $$,
  'sozlamalar: doimiy reja, tez tugma va eslatma soati'
);

-- ─── Qayta import (idempotent) ─────────────────────────────────────────────
insert into r select 'again', public.import_legacy_v1((select id from ref where name = 'h'),
                                                      (select v from payload), false);
select results_eq(
  $$ select count(*) filter (where deleted_at is null), count(*) filter (where deleted_at is not null)
       from public.transactions where household_id = (select id from ref where name = 'h') $$,
  $$ values (12::bigint, 12::bigint) $$,
  'qayta import: eski paket tombstone, yangisi bitta nusxada'
);

select * from finish();
rollback;
