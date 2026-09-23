-- E06-T01: tizim spravochniklari — valyutalar, kategoriya shablonlari,
-- kurslar; E26-T01: karta xabar shablonlari; E26-T02: ilova konfiguratsiyasi.
-- Qoidalar: BR-031..033, BR-190, BR-213, BR-214, BR-222.
begin;
select plan(28);

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
-- BR-222: karta xabar shablonlari — faqat platforma admini (o'qish ham).
select is_empty(
  $$ select 1 from public.card_message_templates $$,
  'BR-222: oddiy foydalanuvchi karta shablonlarini ko''rmaydi'
);
select throws_ok(
  $$ insert into public.card_message_templates (bank, pattern)
     values ('Bank', 'Xarajat (?<amount>[0-9]+) so''m') $$,
  '42501', null, 'oddiy foydalanuvchi karta shabloni qo''sha olmaydi'
);
-- BR-214: konfiguratsiyani hamma o'qiydi, faqat platforma admini yozadi.
select isnt_empty(
  $$ select 1 from public.app_config where key = 'min_android_version' $$,
  'BR-214: minimal versiya hamma uchun ochiq'
);
select throws_ok(
  $$ insert into public.app_config (key, value) values ('feature_x', 'true') $$,
  '42501', null, 'oddiy foydalanuvchi konfiguratsiyaga kalit qo''sha olmaydi'
);
-- RLS'da yozish siyosati yo'q: UPDATE xato bermaydi, lekin hech nimani
-- o'zgartirmaydi (qator ko'rinmaydi) — natija bo'yicha tekshiriladi.
select lives_ok(
  $$ update public.app_config set value = '"9.9.9"' where key = 'min_android_version' $$
);
select is(
  (select value #>> '{}' from public.app_config where key = 'min_android_version'), '0.1.0',
  'BR-214: oddiy foydalanuvchi minimal versiyani o''zgartira olmaydi'
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
select lives_ok(
  $$ insert into public.card_message_templates (bank, pattern, sample)
     values ('Kapitalbank', '(?<amount>[0-9 ]+) UZS (?<payee>.+) (?<card>[0-9]{4})',
             '25 000 UZS KORZINKA 1234') $$,
  'BR-222: platforma admini (aal2) karta shabloni qo''shadi'
);
select throws_ok(
  $$ insert into public.card_message_templates (bank, pattern)
     values ('Bank', 'summa (?<sum>[0-9]+)') $$,
  '23514', null, 'naqshda `amount` guruhi majburiy'
);
select throws_ok(
  $$ insert into public.card_message_templates (bank, pattern, kind)
     values ('Bank', 'Xarajat (?<amount>[0-9]+)', 'transfer') $$,
  '23514', null, 'karta xabari o''tkazma bo''lmaydi'
);
select lives_ok(
  $$ update public.app_config set value = '"1.5.0"' where key = 'min_android_version' $$,
  'BR-214: platforma admini (aal2) minimal versiyani o''zgartiradi'
);
select throws_ok(
  $$ update public.app_config set value = '"1.5"' where key = 'min_android_version' $$,
  '23514', null, 'BR-214: versiya `X.Y.Z` ko''rinishida'
);
select throws_ok(
  $$ update public.app_config set value = '{"message": {"uz": "Ish"}}' where key = 'maintenance' $$,
  '23514', null, 'texnik ishlar xabari uch tilda bo''lishi kerak'
);
select lives_ok(
  $$ update public.app_config
        set value = '{"message": {"uz": "Ish", "ru": "Работы", "en": "Maintenance"}}'
      where key = 'maintenance' $$,
  'texnik ishlar banneri yoqiladi'
);

select * from finish();
rollback;
