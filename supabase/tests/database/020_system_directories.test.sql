-- E06-T01: tizim spravochniklari — valyutalar, kategoriya shablonlari,
-- kurslar (BR-031..033, BR-190, BR-213).
begin;
select plan(15);

create temporary table u (name text primary key, id uuid) on commit drop;
insert into u values
  ('alice', tests.create_user('alice@test.uz')),
  ('root',  tests.create_user('root@test.uz'));
insert into public.platform_admins (user_id) select id from u where name = 'root';
grant select on u to authenticated;

-- ─── Ma'lumotlar ───────────────────────────────────────────────────────────
select results_eq(
  $$ select code, exponent::int from public.currencies order by sort_order $$,
  $$ values ('UZS', 2), ('USD', 2), ('EUR', 2), ('RUB', 2) $$,
  'BR-190: valyutalar (UZS asosiy), kasr xonalari ISO 4217 bo''yicha'
);
select results_eq(
  $$ select kind::text, count(*)::int from public.category_templates group by kind order by 1 $$,
  $$ values ('expense', 14), ('income', 4) $$,
  'BR-031/032: 4 daromad turi va 14 xarajat kategoriyasi shabloni'
);
select results_eq(
  $$ select name_i18n ->> 'uz', month_shift::int from public.category_templates
      where kind = 'income' order by sort_order $$,
  $$ values ('Avans', 0), ('Oylik', -1), ('KPI', -1), ('Qo''shimcha', -1) $$,
  'BR-031: daromad turlarining oy siljishi'
);
select results_eq(
  $$ select name_i18n ->> 'uz', kind::text from public.category_templates
      where system_code = 'personal_allocation' $$,
  $$ values ('O''zim uchun', 'expense') $$,
  'BR-033: "O''zim uchun" — yagona tizim shabloni'
);
select throws_ok(
  $$ insert into public.category_templates (kind, name_i18n, icon, color, month_shift)
     values ('expense', '{"uz": "X", "ru": "X", "en": "X"}', 'cart', '#000000', -1) $$,
  '23514', null, 'BR-031: oy siljishi faqat daromad turida'
);
select throws_ok(
  $$ insert into public.category_templates (kind, name_i18n, icon, color)
     values ('expense', '{"uz": "X"}', 'cart', '#000000') $$,
  '23514', null, 'shablon nomi uch tilda majburiy'
);

-- ─── Huquqlar ──────────────────────────────────────────────────────────────
select tests.authenticate_as_anon();
select throws_ok(
  $$ select 1 from public.currencies $$,
  '42501', null, 'anon spravochniklarni o''qiy olmaydi'
);
select tests.clear_authentication();

select tests.authenticate_as((select id from u where name = 'alice'));
select isnt_empty(
  $$ select 1 from public.category_templates $$,
  'kirgan foydalanuvchi shablonlarni o''qiydi'
);
select throws_ok(
  $$ insert into public.currencies (code, name_i18n, symbol) values ('KZT', '{"uz": "Tenge", "ru": "Тенге", "en": "Tenge"}', '₸') $$,
  '42501', null, 'BR-213: oddiy foydalanuvchi valyuta qo''sha olmaydi'
);
select throws_ok(
  $$ insert into public.exchange_rates (currency, rate_date, rate_to_base) values ('USD', '2026-09-18', 12650) $$,
  '42501', null, 'oddiy foydalanuvchi kurs yoza olmaydi'
);
select throws_ok(
  $$ update public.households set base_currency = 'XYZ'
      where id = (select last_household_id from public.profiles where user_id = (select id from u where name = 'alice')) $$,
  '23503', null, 'BR-190: byudjet valyutasi spravochnikdan'
);
select is(
  public.app_bootstrap() #>> '{currencies,0,code}', 'UZS',
  'app_bootstrap valyutalarni tartib bilan qaytaradi'
);
-- BR-060: mobil ajratmani oldindan ko'rsatishi uchun yaxlitlash birligi.
select is(
  public.app_bootstrap() #>> '{currencies,0,allocation_rounding}', '100000',
  'app_bootstrap valyutada allocation_rounding ham qaytaradi'
);

select tests.authenticate_as((select id from u where name = 'root'));
select throws_ok(
  $$ insert into public.currencies (code, name_i18n, symbol) values ('KZT', '{"uz": "Tenge", "ru": "Тенге", "en": "Tenge"}', '₸') $$,
  '42501', null, 'BR-213: platforma admini ham 2FA''siz (aal1) yoza olmaydi'
);

select tests.authenticate_as((select id from u where name = 'root'), 'aal2');
select lives_ok(
  $$ insert into public.currencies (code, name_i18n, symbol) values ('KZT', '{"uz": "Tenge", "ru": "Тенге", "en": "Tenge"}', '₸') $$,
  'BR-213: platforma admini (aal2) valyuta qo''shadi'
);

select * from finish();
rollback;
