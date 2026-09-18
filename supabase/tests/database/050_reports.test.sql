-- E09-T02..T04: hisobot RPC'lari — faqat a'zolar uchun; tekshiruv (health_check)
-- signallari; kategoriya trendi. Hisob-kitob qoidalari golden fixture'larda
-- (contracts/fixtures, make contract-test). Qoidalar: BR-025, BR-085, BR-095,
-- BR-113, BR-117, BR-170..172, BR-191, BR-210.
begin;
select plan(18);

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
    and c.name in ('Avans', 'Oziq-ovqat', 'Transport', 'Kredit/Qarz', 'Kommunal');

create temporary table r (v jsonb) on commit drop;
grant all on r to authenticated;

-- ─── Faqat a'zolar (BR-210) ────────────────────────────────────────────────
select tests.authenticate_as((select id from u where name = 'dave'));
select throws_ok(format('select public.%s', x.call), 'P0001', 'forbidden', format('BR-210: %s — begona byudjet', x.name))
  from (values
    ('report_month', format('report_month(%L, %L)', (select id from ref where name = 'h'), '2026-10-01')),
    ('report_year', format('report_year(%L, 2026)', (select id from ref where name = 'h'))),
    ('report_savings', format('report_savings(%L)', (select id from ref where name = 'h'))),
    ('report_personal_fund', format('report_personal_fund(%L, %L, %L)', (select id from ref where name = 'h'), '2026-01-01', '2026-10-01')),
    ('report_debts', format('report_debts(%L)', (select id from ref where name = 'h'))),
    ('report_goals', format('report_goals(%L)', (select id from ref where name = 'h'))),
    ('report_category_trend', format('report_category_trend(%L, %L, %L)', (select id from ref where name = 'h'), '2026-01-01', '2026-10-01')),
    ('health_check', format('health_check(%L)', (select id from ref where name = 'h')))
  ) as x (name, call);

-- ─── Tekshiruv uchun holat (bugun — 2026-10-15) ────────────────────────────
select tests.clear_authentication();
select set_config('app.today', '2026-10-15', true);
-- Faol doimiy reja, lekin oktabr ochilmagan (BR-085).
insert into public.recurring_rules (household_id, kind, name, category_id, amount, day_of_month)
  values ((select id from ref where name = 'h'), 'expense', 'Ijara', (select id from ref where name = 'c_kommunal'), 300000000, 5);
-- Bog'lanmagan qarz va nomi o'xshash xarajat (BR-117).
insert into public.debts (household_id, name, direction, currency, total)
  values ((select id from ref where name = 'h'), 'Mashina krediti', 'i_owe', 'UZS', 1000000000);
insert into public.transactions (household_id, kind, account_id, amount, category_id, occurred_on, budget_month, payee)
  values ((select id from ref where name = 'h'), 'expense', (select id from ref where name = 'card'), 100000000,
          (select id from ref where name = 'c_kredit/qarz'), '2026-09-10', '2026-09-01', 'Mashina kredit');
-- Manfiy naqd (BR-025) va 30+ kun kechikkan reja.
insert into public.transactions (household_id, kind, account_id, amount, category_id, occurred_on, budget_month)
  values ((select id from ref where name = 'h'), 'expense', (select id from ref where name = 'cash'), 5000000,
          (select id from ref where name = 'c_oziq-ovqat'), '2026-10-02', '2026-10-01');
insert into public.planned_items (household_id, kind, name, category_id, planned_amount, due_date, budget_month)
  values ((select id from ref where name = 'h'), 'expense', 'Eski qarz', (select id from ref where name = 'c_kommunal'),
          1000000, '2026-08-20', '2026-08-01');
-- Yopilgan oydagi amal keyin tahrirlandi.
insert into public.transactions (household_id, kind, account_id, amount, category_id, occurred_on, budget_month)
  values ((select id from ref where name = 'h'), 'expense', (select id from ref where name = 'card'), 7000000,
          (select id from ref where name = 'c_oziq-ovqat'), '2026-07-10', '2026-07-01');
insert into public.months (household_id, month, closed_at)
  values ((select id from ref where name = 'h'), '2026-07-01', now() - interval '1 minute');
update public.transactions set amount = 8000000
 where household_id = (select id from ref where name = 'h') and budget_month = '2026-07-01';
-- Boshqa valyutadagi hisob, kurs yo'q (BR-191).
insert into public.accounts (household_id, name, type, currency, opening_date)
  values ((select id from ref where name = 'h'), 'Dollar', 'card', 'USD', '2026-10-01');

select tests.authenticate_as((select id from u where name = 'alice'));
select set_config('app.today', '2026-10-15', true);
insert into r select public.health_check((select id from ref where name = 'h'));

select is(
  (select p ->> 'count' from r, jsonb_array_elements(v -> 'problems') p where p ->> 'code' = 'month_not_opened'),
  '1', 'BR-085: joriy oyga ko''chirilmagan aktiv doimiy reja — muammo'
);
select is(
  (select p #>> '{suggestions,0,payee}' from r, jsonb_array_elements(v -> 'problems') p where p ->> 'code' = 'debt_unlinked'),
  'Mashina kredit', 'BR-117: bog''lanmagan qarz uchun nomi o''xshash xarajat taklif qilinadi'
);
select is(
  (select (w ->> 'balance')::bigint from r, jsonb_array_elements(v -> 'warnings') w where w ->> 'code' = 'negative_cash'),
  -5000000::bigint, 'BR-025: manfiy naqd qoldiq — ogohlantirish'
);
select is(
  (select w ->> 'count' from r, jsonb_array_elements(v -> 'warnings') w where w ->> 'code' = 'long_overdue'),
  '1', 'BR-171: 30+ kun kechikkan reja — ogohlantirish'
);
select is(
  (select w ->> 'count' from r, jsonb_array_elements(v -> 'warnings') w where w ->> 'code' = 'edited_after_close'),
  '1', 'BR-171: yopilgan oyda keyin tahrirlangan amal — ogohlantirish'
);
select is(
  (select w ->> 'currency' from r, jsonb_array_elements(v -> 'warnings') w where w ->> 'code' = 'fx_rate_stale'),
  'USD', 'BR-191: kursi yo''q/eskirgan valyuta — ogohlantirish'
);
select ok(
  not exists (select 1 from r, jsonb_array_elements(v -> 'warnings') w where w ->> 'code' = 'no_active_rules'),
  'aktiv doimiy reja bor — "reja yo''q" ogohlantirishi chiqmaydi'
);
select results_eq(
  $$ select (v #>> '{info,transactions}')::int, v #>> '{info,first_month}', v #> '{info,closed_months}' from r $$,
  $$ values (3, '2026-07-01', '["2026-07-01"]'::jsonb) $$,
  'BR-172: holat — yozuvlar soni, birinchi oy, yopilgan oylar'
);

-- ─── Kategoriya trendi (BR-095) ────────────────────────────────────────────
select tests.clear_authentication();
insert into public.transactions (household_id, kind, account_id, amount, category_id, occurred_on, budget_month)
select (select id from ref where name = 'h'), 'expense', (select id from ref where name = 'card'), v.amount,
       (select id from ref where name = 'c_transport'), v.day, date_trunc('month', v.day::timestamp)::date
  from (values (30000000::bigint, date '2026-07-05'), (30000000, '2026-08-05'), (60000000, '2026-09-05'), (90000000, '2026-10-05'))
       as v (amount, day);
select tests.authenticate_as((select id from u where name = 'alice'));
delete from r;
insert into r select public.report_category_trend((select id from ref where name = 'h'), '2026-09-01', '2026-10-01',
                                                  (select id from ref where name = 'c_transport'));
select results_eq(
  $$ select (c ->> 'actual')::bigint, (c ->> 'prev')::bigint, (c ->> 'avg3')::bigint,
            (c ->> 'vs_prev')::numeric, (c ->> 'vs_avg3')::numeric
       from r, jsonb_array_elements(v -> 'compare') c $$,
  $$ values (90000000::bigint, 60000000::bigint, 40000000::bigint, 0.5::numeric, 1.25::numeric) $$,
  'BR-095: o''tgan oy (+50%) va 3 oylik o''rtacha (+125%) bilan solishtirish'
);
select is(
  (select jsonb_array_length(v -> 'series') from r), 2,
  'BR-095: qator faqat so''ralgan oylar uchun (sep, oct)'
);

select * from finish();
rollback;
