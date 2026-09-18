-- E06-T08: yangi byudjetga standart to'plam (BR-010, BR-031..033, BR-060).
begin;
select plan(12);

create temporary table u (name text primary key, id uuid) on commit drop;
insert into u values
  ('uz', tests.create_user('uz@test.uz')),
  ('ru', tests.create_user('ru@test.uz', '{"locale": "ru"}'));
grant select on u to authenticated;

create temporary table h (name text primary key, id uuid) on commit drop;
insert into h select u.name, p.last_household_id from u join public.profiles p on p.user_id = u.id;
grant all on h to authenticated;

-- ─── Kategoriyalar ─────────────────────────────────────────────────────────
select results_eq(
  $$ select kind::text, count(*)::int from public.categories
      where household_id = (select id from h where name = 'uz') group by kind order by 1 $$,
  $$ values ('expense', 14), ('income', 4) $$,
  'BR-031/032: yangi byudjetda 4 daromad turi va 14 xarajat kategoriyasi'
);
select results_eq(
  $$ select name::text, month_shift::int from public.categories
      where household_id = (select id from h where name = 'uz') and kind = 'income' order by sort_order $$,
  $$ values ('Avans', 0), ('Oylik', -1), ('KPI', -1), ('Qo''shimcha', -1) $$,
  'BR-031: daromad turlari oy siljishi bilan'
);
select results_eq(
  $$ select name::text from public.categories
      where household_id = (select id from h where name = 'uz') and system_code = 'personal_allocation' $$,
  $$ values ('O''zim uchun') $$,
  'BR-033: "O''zim uchun" tizim kategoriyasi'
);
select results_eq(
  $$ select name::text from public.categories
      where household_id = (select id from h where name = 'ru') and kind = 'income' order by sort_order $$,
  $$ values ('Аванс'), ('Зарплата'), ('KPI'), ('Доп. доход') $$,
  'standart to''plam foydalanuvchi tilida (ru)'
);

-- ─── Hisoblar va fond qoidasi ──────────────────────────────────────────────
select results_eq(
  $$ select name::text, type::text, currency from public.accounts
      where household_id = (select id from h where name = 'uz') order by sort_order $$,
  $$ values ('Naqd', 'cash', 'UZS'), ('Karta', 'card', 'UZS'), ('Shaxsiy fond', 'personal_fund', 'UZS') $$,
  'BR-020: Naqd, Karta va shaxsiy fond hisoblari'
);
select results_eq(
  $$ select name::text from public.accounts
      where household_id = (select id from h where name = 'ru') order by sort_order $$,
  $$ values ('Наличные'), ('Карта'), ('Личный фонд') $$,
  'hisob nomlari foydalanuvchi tilida (ru)'
);
select results_eq(
  $$ select h2.personal_fund_mode::text, h2.personal_fund_percent::text, h2.personal_fund_day::int, a.type::text
       from public.households h2
       join public.accounts a on a.id = h2.personal_fund_source_account_id
      where h2.id = (select id from h where name = 'uz') $$,
  $$ values ('percent', '10.00', 5, 'cash') $$,
  'BR-060: fond qoidasi standarti — 10%, 5-kun, naqd hisobdan'
);
select is(
  (select opening_date from public.accounts
    where household_id = (select id from h where name = 'uz') and type = 'cash'),
  (now() at time zone 'Asia/Tashkent')::date,
  'BR-002: boshlang''ich sana — byudjet vaqt zonasidagi bugun'
);
select is_empty(
  $$ select 1 from public.categories
      where household_id = (select id from h where name = 'uz')
        and (created_by is distinct from (select id from u where name = 'uz') or row_version <= 0)
     union all
     select 1 from public.accounts
      where household_id = (select id from h where name = 'uz')
        and (created_by is distinct from (select id from u where name = 'uz') or row_version <= 0) $$,
  'standart yozuvlar egasi va sinxron versiyasi bilan'
);

-- ─── Audit va create_household ─────────────────────────────────────────────
select is_empty(
  $$ select 1 from public.audit_log
      where household_id = (select id from h where name = 'uz')
        and table_name in ('categories', 'accounts') $$,
  'standart to''plam audit jurnalini to''ldirmaydi'
);
select isnt(
  current_setting('app.skip_audit', true), 'on',
  'standart to''plamdan keyin audit qayta yoqiladi'
);

select tests.authenticate_as((select id from u where name = 'uz'));
insert into h select 'family', public.create_household('Oila');
select results_eq(
  $$ select (select count(*)::int from public.categories where household_id = (select id from h where name = 'family')),
            (select count(*)::int from public.accounts where household_id = (select id from h where name = 'family')) $$,
  $$ values (18, 3) $$,
  'BR-010: create_household ham standart to''plamni beradi'
);

select * from finish();
rollback;
