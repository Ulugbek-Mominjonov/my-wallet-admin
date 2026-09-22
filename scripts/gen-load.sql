-- E09-T07: ishlash tekshiruvi uchun sintetik yuk — 1 byudjet, 10 yil,
-- 25 000 amal (daromad, xarajat, fond ajratmasi va sarfi), har oy 12 reja.
-- Faqat lokal/CI bazada (scripts/perf-check.sh, superuser bilan).
--
-- O'lchanadigan byudjet haqiqiy yozuv yo'li bilan (triggerlar, cheklovlar).
-- Yonida 9 ta "shovqin" byudjet (har biri 25 000 amal, triggerlarsiz —
-- tez): o'lchanadigan byudjet jadvalning ~10% i bo'lsin, aks holda
-- rejalovchi to'g'ri ravishda Seq Scan tanlaydi va tekshiruv ma'nosiz.
\set ON_ERROR_STOP on

begin;

insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
        'perf-load@example.test', '', now(), '{}', '{}', now(), now())
returning id as uid \gset

select p.last_household_id as hid from public.profiles p where p.user_id = :'uid' \gset

create temporary table perf_categories on commit drop as
select row_number() over (order by c.sort_order) - 1 as n, c.id
  from public.categories c
 where c.household_id = :'hid' and c.kind = 'expense' and c.system_code is null;
create temporary table perf_accounts on commit drop as
select a.type, a.id from public.accounts a where a.household_id = :'hid';
-- Joy nomlari (E23 qidiruvi): shovqin byudjetlarda ham — GIN indeks boshqa
-- byudjet mosliklarini ham qaytaradi, o'lchov real bo'lsin.
create temporary table perf_payees on commit drop as
select n - 1 as n, payee
  from unnest(array['Korzinka', 'Makro', 'Havas', 'Yandex Go', 'Uzum Market',
                    'Artel', 'Evos', 'Bi1', 'Zara', 'Oqtepa Lavash']) with ordinality as x(payee, n);

-- 25 000 amal 120 oyga (2016-10 .. 2026-09) teng taqsimlangan: har 10-si
-- daromad, qolgani xarajat (naqd/karta aralash), + oylik ajratma va fond sarfi.
insert into public.transactions (household_id, kind, account_id, amount, category_id, payee, occurred_on, budget_month)
select :'hid',
       case when g % 10 = 0 then 'income'::public.transaction_kind else 'expense' end,
       (select a.id from perf_accounts a where a.type = case when g % 3 = 0 then 'cash' else 'card' end::public.account_type),
       (1000 + (g * 7919) % 500000) * 100,
       case when g % 10 = 0
            then (select c.id from public.categories c where c.household_id = :'hid' and c.name = 'Avans')
            else (select pc.id from perf_categories pc where pc.n = g % (select count(*) from perf_categories)) end,
       (select x.payee from perf_payees x where x.n = g % 10),
       date '2016-10-01' + (g::bigint * 3651 / 24760)::integer,
       date_trunc('month', date '2016-10-01' + (g::bigint * 3651 / 24760)::integer)::date
  from generate_series(1, 24760) as g;

insert into public.transactions (household_id, kind, account_id, to_account_id, amount, occurred_on, budget_month)
select :'hid', 'transfer', (select id from perf_accounts where type = 'cash'),
       (select id from perf_accounts where type = 'personal_fund'), 50000000,
       (date '2016-10-05' + make_interval(months => m))::date, (date '2016-10-01' + make_interval(months => m))::date
  from generate_series(0, 119) as m;

insert into public.transactions (household_id, kind, account_id, amount, occurred_on, budget_month)
select :'hid', 'expense', (select id from perf_accounts where type = 'personal_fund'), 20000000,
       (date '2016-10-20' + make_interval(months => m))::date, (date '2016-10-01' + make_interval(months => m))::date
  from generate_series(0, 119) as m;

-- Har oy 12 ta reja (yarmi to'langan deb yopilgan).
insert into public.planned_items (household_id, kind, name, category_id, planned_amount, due_date, budget_month, closed_at)
select :'hid', 'expense', 'Reja ' || p, (select pc.id from perf_categories pc where pc.n = p % (select count(*) from perf_categories)),
       (100 + p * 10) * 100000, (date '2016-10-01' + make_interval(months => m, days => p))::date,
       (date '2016-10-01' + make_interval(months => m))::date,
       case when p % 2 = 0 then now() end
  from generate_series(0, 119) as m, generate_series(1, 12) as p;

-- Shovqin byudjetlar: foydalanuvchi triggerlari bilan (standart to'plam),
-- amallar esa replica rejimida — trigger va FK'siz, hosila maydonlar qo'lda.
insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
       'perf-noise-' || n || '@example.test', '', now(), '{}', '{}', now(), now()
  from generate_series(1, 9) as n;
create temporary table perf_noise on commit drop as
select p.user_id, p.last_household_id as household_id
  from public.profiles p
  join auth.users u on u.id = p.user_id
 where u.email like 'perf-noise-%@example.test';

set local session_replication_role = replica;
insert into public.transactions (household_id, kind, account_id, amount, amount_base, category_id, payee, occurred_on, budget_month)
select z.household_id, 'expense', a.id, (1000 + (g * 7919) % 500000) * 100, (1000 + (g * 7919) % 500000) * 100, c.id,
       (select x.payee from perf_payees x where x.n = g % 10),
       date '2016-10-01' + (g::bigint * 3651 / 25000)::integer,
       date_trunc('month', date '2016-10-01' + (g::bigint * 3651 / 25000)::integer)::date
  from perf_noise z
  join public.accounts a on a.household_id = z.household_id and a.type = 'card'
  join public.categories c on c.household_id = z.household_id and c.name = 'Oziq-ovqat'
  cross join generate_series(1, 25000) as g;
insert into public.planned_items (household_id, kind, name, category_id, planned_amount, due_date, budget_month)
select z.household_id, 'expense', 'Reja ' || p, c.id, 10000000,
       (date '2016-10-01' + make_interval(months => m, days => p))::date,
       (date '2016-10-01' + make_interval(months => m))::date
  from perf_noise z
  join public.categories c on c.household_id = z.household_id and c.name = 'Kommunal'
  cross join generate_series(0, 119) as m
  cross join generate_series(1, 12) as p;
set local session_replication_role = origin;

commit;

vacuum analyze public.transactions, public.planned_items, public.accounts, public.categories;

select :'hid' as household_id, :'uid' as user_id \gset
\echo perf_household=:household_id
\echo perf_user=:user_id
select string_agg(pr.user_id::text, ',') as noise_users, string_agg(pr.last_household_id::text, ',') as noise_households
  from public.profiles pr
  join auth.users au on au.id = pr.user_id
 where au.email like 'perf-noise-%@example.test' \gset
\echo perf_noise_users=:noise_users
\echo perf_noise_households=:noise_households
