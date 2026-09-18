-- E11-T03: navbatga qo'yish — kunlik eslatma (BR-160), kechikkan daromad
-- (BR-165), oylik hisobot va arxiv (BR-161, BR-162, BR-167), limit
-- ogohlantirishi (BR-133). Takror yo'q — dedupe_key (BR-166).
begin;
select plan(11);

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
  where a.household_id = (select id from ref where name = 'h') and a.type = 'card';
insert into ref select 'c_' || lower(c.name), c.id from public.categories c
  where c.household_id = (select id from ref where name = 'h');

select tests.authenticate_as((select id from u where name = 'alice'));
create temporary table inv (code text) on commit drop;
grant all on inv to authenticated;
insert into inv select code from public.create_invite((select id from ref where name = 'h'), 'member');
select public.register_device('fcm-token-alice-0001', 'android');
select tests.authenticate_as((select id from u where name = 'bob'));
select public.accept_invite((select code from inv));
-- carol: qurilmasi bor, lekin rejalari yo'q.
select tests.authenticate_as((select id from u where name = 'carol'));
select public.register_device('fcm-token-carol-0001', 'android');
select tests.clear_authentication();

-- Oktabr rejalari (bugun — 2026-10-05, 3 kun oldinga).
insert into public.planned_items (household_id, kind, name, category_id, account_id, planned_amount, due_date, budget_month)
select (select id from ref where name = 'h'), v.kind::public.plan_kind, v.name, (select id from ref where name = v.cat),
       (select id from ref where name = 'card'), v.amount, v.due, '2026-10-01'
  from (values
    ('expense', 'Internet', 'c_internet/aloqa', 15000000::bigint, '2026-10-03'::date),
    ('expense', 'Elektr',   'c_kommunal',       null,             '2026-10-05'),
    ('expense', 'Kredit',   'c_kredit/qarz',    250000000,        '2026-10-07'),
    ('expense', 'Sport',    'c_kommunal',       20000000,         '2026-10-20'),
    ('expense', 'Suv',      'c_kommunal',       5000000,          '2026-10-04'),
    ('income',  'Oylik',    'c_oylik',          800000000,        '2026-10-01'),
    ('income',  'Avans',    'c_avans',          300000000,        '2026-10-04')
  ) as v (kind, name, cat, amount, due);
select tests.authenticate_as((select id from u where name = 'alice'));
select public.pay_planned((select id from public.planned_items where name = 'Suv'
                              and household_id = (select id from ref where name = 'h')), p_date => '2026-10-04');
select tests.clear_authentication();

-- Faqat shu test foydalanuvchilarining navbati (bazadagi boshqa ma'lumotdan mustaqil).
create temporary view q as
select o.* from public.notification_outbox o where o.user_id in (select id from u);
create temporary table counts (name text primary key, n int) on commit drop;

-- ─── Kunlik eslatma (BR-160) ───────────────────────────────────────────────
select jobs.enqueue_reminders('2026-10-05 04:00:00+00');
insert into counts select 'rem1', count(*) from q where type = 'daily_reminder';
select results_eq(
  $$ select u.name, o.channel, o.payload ->> 'date' from q o join u on u.id = o.user_id
      where o.type = 'daily_reminder' $$,
  $$ values ('alice', 'push', '2026-10-05') $$,
  'faqat yetkaziladigan manzilga (bob — qurilmasiz), eslatadigan narsa yo''q bo''lsa (carol) — yuborilmaydi'
);
select results_eq(
  $$ select jsonb_path_query_array(payload, '$.overdue[*].name'), payload -> 'today',
            jsonb_path_query_array(payload, '$.upcoming[*].name'), jsonb_typeof(payload -> 'balance')
       from q where type = 'daily_reminder' $$,
  $$ values ('["Internet"]'::jsonb,
             '[{"name": "Elektr", "amount": null, "due_date": "2026-10-05", "kind": "expense"}]'::jsonb,
             '["Kredit"]'::jsonb, 'number') $$,
  'muddati o''tgan, bugungi (summa noma''lum — null), 3 kun ichidagi; to''langan va daromad — yo''q'
);
select jobs.enqueue_reminders('2026-10-05 04:00:00+00');
insert into counts select 'rem2', count(*) from q where type = 'daily_reminder';
select jobs.enqueue_reminders('2026-10-05 05:00:00+00');
insert into counts select 'rem3', count(*) from q where type = 'daily_reminder';
select results_eq(
  $$ select name, n from counts where name like 'rem%' order by name $$,
  $$ values ('rem1', 1), ('rem2', 1), ('rem3', 1) $$,
  'takror yo''q (dedupe); boshqa soatda — yuborilmaydi'
);

-- ─── Kechikkan daromad (BR-165) ────────────────────────────────────────────
select jobs.enqueue_income_missing('2026-10-05 04:00:00+00');
select jobs.enqueue_income_missing('2026-10-05 04:00:00+00');
select results_eq(
  $$ select payload ->> 'name', payload ->> 'due_date', (payload ->> 'amount')::bigint from q
      where type = 'income_missing' $$,
  $$ values ('Oylik', '2026-10-01', 800000000::bigint) $$,
  '2 kundan ko''p kechikkan daromad (Avans — hali 1 kun); qayta ishga tushirishda — takror yo''q'
);

-- ─── Oylik hisobot (BR-161, BR-162, BR-167) ────────────────────────────────
-- Iyul, avgust — 10 mln daromad; sentabr — 3 mln (o'rtachaning 60% idan kam).
insert into public.transactions (household_id, kind, account_id, amount, category_id, occurred_on, budget_month)
select (select id from ref where name = 'h'), v.kind::public.transaction_kind, (select id from ref where name = 'card'),
       v.amount, (select id from ref where name = v.cat), v.day, date_trunc('month', v.day)::date
  from (values
    ('income',  1000000000::bigint, 'c_avans',      '2026-07-10'::date),
    ('income',  1000000000,         'c_avans',      '2026-08-10'),
    ('income',  300000000,          'c_avans',      '2026-09-10'),
    ('expense', 150000000,          'c_oziq-ovqat', '2026-09-12'),
    ('expense', 50000000,           'c_transport',  '2026-09-15')
  ) as v (kind, amount, cat, day);

select jobs.enqueue_monthly_reports('2026-10-21 04:00:00+00');
insert into counts select 'rep1', count(*) from q where type = 'monthly_report';
select results_eq(
  $$ select (payload ->> 'income')::bigint, (payload ->> 'expense')::bigint, (payload ->> 'suspicious')::boolean,
            jsonb_path_query_array(payload, '$.top_categories[*].name')
       from public.monthly_reports where household_id = (select id from ref where name = 'h') and month = '2026-09-01' $$,
  $$ values (300000000::bigint, 200000000::bigint, true, '["Oziq-ovqat", "Transport"]'::jsonb) $$,
  'o''tgan oy hisoboti arxivda: daromad, xarajat, eng ko''p sarflanganlar; shubhali oy (BR-162)'
);
select is(
  (select (payload ->> 'income')::bigint from public.monthly_reports
    where household_id = (select id from ref where name = 'h') and month = '2026-09-01'),
  (select f.income from private.month_facts((select id from ref where name = 'h'), '2026-09-01', '2026-09-01') f),
  'raqamlar hisobotlar yadrosidan (ekrandagi bilan bir xil)'
);
select results_eq(
  $$ select u.name, o.payload ->> 'month', o.payload ->> 'locale' from q o join u on u.id = o.user_id
      where o.type = 'monthly_report' and o.household_id = (select id from ref where name = 'h') $$,
  $$ values ('alice', '2026-09-01', 'uz') $$,
  'hisobot kuni va soatida yuborildi (foydalanuvchi tilida)'
);
select jobs.enqueue_monthly_reports('2026-10-21 04:00:00+00');
insert into counts select 'rep2', count(*) from q where type = 'monthly_report';
select jobs.enqueue_monthly_reports('2026-10-22 04:00:00+00');
insert into counts select 'rep3', count(*) from q where type = 'monthly_report';
select results_eq(
  $$ select name, n from counts where name like 'rep%' order by name $$,
  $$ values ('rep1', 2), ('rep2', 2), ('rep3', 2) $$,
  'har a''zoga bir marta (carol — o''z byudjeti bo''yicha); boshqa kuni — yo''q'
);

-- ─── Limit ogohlantirishi (BR-133) ─────────────────────────────────────────
select set_config('app.today', '2026-10-05', true);
insert into public.category_limits (household_id, category_id, amount, alert_80)
values ((select id from ref where name = 'h'), (select id from ref where name = 'c_ko''ngilochar'), 100000000, true),
       ((select id from ref where name = 'h'), (select id from ref where name = 'c_kiyim'), 100000000, false);

create function pg_temp.spend(p_cat text, p_amount bigint) returns void language sql as $$
  insert into public.transactions (household_id, kind, account_id, amount, category_id, occurred_on, budget_month)
  values ((select id from ref where name = 'h'), 'expense', (select id from ref where name = 'card'), p_amount,
          (select id from ref where name = p_cat), '2026-10-05', '2026-10-01')
$$;
select pg_temp.spend('c_ko''ngilochar', 85000000);
select pg_temp.spend('c_kiyim', 90000000);
select results_eq(
  $$ select payload ->> 'category', (payload ->> 'threshold')::int, (payload ->> 'actual')::bigint
       from q where type = 'limit_alert' order by id $$,
  $$ values ('Ko''ngilochar', 80, 85000000::bigint) $$,
  '80% ga yetdi — ogohlantirish; 80% o''chirilgan limit — yo''q'
);
select pg_temp.spend('c_ko''ngilochar', 10000000);
select pg_temp.spend('c_ko''ngilochar', 10000000);
select pg_temp.spend('c_kiyim', 20000000);
select pg_temp.spend('c_kiyim', 5000000);
select results_eq(
  $$ select payload ->> 'category', (payload ->> 'threshold')::int
       from q where type = 'limit_alert' order by id $$,
  $$ values ('Ko''ngilochar', 80), ('Ko''ngilochar', 100), ('Kiyim', 100) $$,
  'oyda har chegara uchun bir marta; 100% — alohida'
);
select is(
  (select count(*)::int from q o join u on u.id = o.user_id
    where o.type = 'limit_alert' and u.name <> 'alice'),
  0, 'faqat yetkaziladigan a''zolarga'
);

select * from finish();
rollback;
