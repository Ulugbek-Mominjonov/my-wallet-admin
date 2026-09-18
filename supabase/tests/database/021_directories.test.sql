-- E06-T09: byudjet spravochniklari — cheklovlar, himoyalar, rollar.
-- Qoidalar: BR-003, BR-008, BR-011, BR-020, BR-024, BR-031, BR-033, BR-034,
-- BR-036, BR-060, BR-080, BR-130, BR-140, BR-200, BR-210; ADR-04.
begin;
select plan(64);

-- ─── Tayyorgarlik ──────────────────────────────────────────────────────────
-- alice — owner; bob — member; carol — viewer; dave — begona.
create temporary table u (name text primary key, id uuid) on commit drop;
insert into u values
  ('alice', tests.create_user('alice@test.uz')),
  ('bob',   tests.create_user('bob@test.uz')),
  ('carol', tests.create_user('carol@test.uz')),
  ('dave',  tests.create_user('dave@test.uz'));
grant select on u to authenticated;

-- Yozuvlar id'lari nom bo'yicha (h — alice'ning byudjeti, h2 — ikkinchisi).
create temporary table ref (name text primary key, id uuid) on commit drop;
grant all on ref to authenticated;
insert into ref select 'h', p.last_household_id from public.profiles p
  where p.user_id = (select id from u where name = 'alice');
insert into ref select 'cash', a.id from public.accounts a
  where a.household_id = (select id from ref where name = 'h') and a.type = 'cash';
insert into ref select 'card', a.id from public.accounts a
  where a.household_id = (select id from ref where name = 'h') and a.type = 'card';
insert into ref select 'fund', a.id from public.accounts a
  where a.household_id = (select id from ref where name = 'h') and a.type = 'personal_fund';
insert into ref select 'c_' || lower(c.name), c.id from public.categories c
  where c.household_id = (select id from ref where name = 'h')
    and c.name in ('Transport', 'Oziq-ovqat', 'Oylik', 'Ijara', 'Kommunal', 'Kiyim');
insert into ref select 'c_self', c.id from public.categories c
  where c.household_id = (select id from ref where name = 'h') and c.system_code = 'personal_allocation';

select tests.authenticate_as((select id from u where name = 'alice'));
create temporary table inv (role text primary key, code text) on commit drop;
grant all on inv to authenticated;
insert into inv select 'member', code from public.create_invite((select id from ref where name = 'h'), 'member');
insert into inv select 'viewer', code from public.create_invite((select id from ref where name = 'h'), 'viewer');
insert into ref select 'h2', public.create_household('Oila');
insert into ref select 'h2_cash', a.id from public.accounts a
  where a.household_id = (select id from ref where name = 'h2') and a.type = 'cash';
select tests.authenticate_as((select id from u where name = 'bob'));
select public.accept_invite((select code from inv where role = 'member'));
select tests.authenticate_as((select id from u where name = 'carol'));
select public.accept_invite((select code from inv where role = 'viewer'));

-- ─── Hisoblar: o'qish va rollar (BR-011, BR-210) ───────────────────────────
select tests.authenticate_as((select id from u where name = 'bob'));
select isnt_empty(
  $$ select 1 from public.accounts where household_id = (select id from ref where name = 'h') $$,
  'BR-011: member hisoblarni ko''radi'
);
select throws_ok(
  $$ insert into public.accounts (household_id, name, type, currency, opening_date)
     values ((select id from ref where name = 'h'), 'Bobniki', 'card', 'UZS', '2026-09-18') $$,
  '42501', null, 'BR-011: member hisob qo''sha olmaydi'
);
update public.accounts set name = 'Bobniki' where id = (select id from ref where name = 'cash');

select tests.authenticate_as((select id from u where name = 'dave'));
select is_empty(
  $$ select 1 from public.accounts where household_id = (select id from ref where name = 'h') $$,
  'BR-210: begona byudjet hisoblari ko''rinmaydi'
);

select tests.clear_authentication();
select is(
  (select name::text from public.accounts where id = (select id from ref where name = 'cash')), 'Naqd',
  'BR-011: member hisobni o''zgartira olmaydi'
);

-- ─── Hisoblar: cheklovlar (BR-003, BR-020, BR-024, BR-060) ─────────────────
select tests.authenticate_as((select id from u where name = 'alice'));
select lives_ok(
  $$ insert into public.accounts (household_id, name, type, currency, opening_date)
     values ((select id from ref where name = 'h'), 'Humo', 'card', 'UZS', '2026-09-18') $$,
  'owner hisob qo''shadi'
);
insert into ref select 'humo', a.id from public.accounts a
  where a.household_id = (select id from ref where name = 'h') and a.name = 'Humo';
select throws_ok(
  $$ insert into public.accounts (household_id, name, type, currency, opening_date)
     values ((select id from ref where name = 'h'), 'humo', 'card', 'UZS', '2026-09-18') $$,
  '23505', null, 'BR-003: hisob nomi registrdan qat''i nazar yagona'
);
select throws_ok(
  $$ insert into public.accounts (household_id, name, type, currency, opening_date)
     values ((select id from ref where name = 'h'), 'Uzcard ', 'card', 'UZS', '2026-09-18') $$,
  '23514', null, 'BR-003: nom chetida bo''shliq bilan saqlanmaydi'
);
select throws_ok(
  $$ insert into public.accounts (household_id, name, type, currency, opening_date)
     values ((select id from ref where name = 'h'), 'Fond 2', 'personal_fund', 'UZS', '2026-09-18') $$,
  '23505', null, 'BR-020: byudjetda bitta shaxsiy fond'
);
select throws_ok(
  $$ update public.accounts set archived_at = now() where id = (select id from ref where name = 'fund') $$,
  'P0001', 'system_account', 'BR-020: shaxsiy fond arxivlanmaydi'
);
select throws_ok(
  $$ update public.accounts set deleted_at = now() where id = (select id from ref where name = 'fund') $$,
  'P0001', 'system_account', 'BR-020: shaxsiy fond o''chirilmaydi'
);
select throws_ok(
  $$ update public.accounts set type = 'card' where id = (select id from ref where name = 'fund') $$,
  'P0001', 'system_account', 'BR-020: shaxsiy fond turi o''zgarmaydi'
);
select throws_ok(
  $$ update public.accounts set type = 'personal_fund' where id = (select id from ref where name = 'humo') $$,
  'P0001', 'system_account', 'BR-020: oddiy hisob shaxsiy fondga aylanmaydi'
);
select throws_ok(
  $$ update public.accounts set deleted_at = now() where id = (select id from ref where name = 'cash') $$,
  'P0001', 'account_in_use', 'BR-060: fond manbai bo''lgan hisob o''chirilmaydi'
);
select throws_ok(
  $$ update public.accounts set archived_at = now() where id = (select id from ref where name = 'cash') $$,
  'P0001', 'account_in_use', 'BR-060: fond manbai bo''lgan hisob arxivlanmaydi'
);
select throws_ok(
  $$ delete from public.accounts where id = (select id from ref where name = 'humo') $$,
  '42501', null, 'o''chirish faqat soft delete (klientda DELETE huquqi yo''q)'
);
select throws_ok(
  $$ update public.accounts set created_by = null where id = (select id from ref where name = 'humo') $$,
  '42501', null, 'tizim maydoni (created_by) klientdan yozilmaydi'
);
select throws_ok(
  $$ update public.accounts set household_id = (select id from ref where name = 'h2')
      where id = (select id from ref where name = 'humo') $$,
  '42501', null, 'ADR-04: hisob boshqa byudjetga ko''chirilmaydi'
);

create temporary table rv (v bigint) on commit drop;
grant all on rv to authenticated;
insert into rv select row_version from public.accounts where id = (select id from ref where name = 'humo');
update public.accounts set name = 'Humo karta' where id = (select id from ref where name = 'humo');
select cmp_ok(
  (select row_version from public.accounts where id = (select id from ref where name = 'humo')),
  '>', (select v from rv),
  'sinxron: tahrir row_version ni oshiradi'
);
select isnt_empty(
  $$ select 1 from public.audit_log
      where table_name = 'accounts' and action = 'update'
        and record_id = (select id from ref where name = 'humo')::text
        and new_values ->> 'name' = 'Humo karta' $$,
  'BR-008: spravochnik tahriri auditga tushadi'
);

-- ─── Fond manbai (BR-060) ──────────────────────────────────────────────────
select throws_ok(
  $$ update public.households set personal_fund_source_account_id = (select id from ref where name = 'fund')
      where id = (select id from ref where name = 'h') $$,
  'P0001', 'invalid_fund_source', 'BR-060: fond manbai fondning o''zi bo''lolmaydi'
);
select throws_ok(
  $$ update public.households set personal_fund_source_account_id = (select id from ref where name = 'h2_cash')
      where id = (select id from ref where name = 'h') $$,
  'P0001', 'invalid_fund_source', 'ADR-04: fond manbai boshqa byudjet hisobi bo''lolmaydi'
);
select lives_ok(
  $$ update public.households set personal_fund_source_account_id = (select id from ref where name = 'card')
      where id = (select id from ref where name = 'h') $$,
  'BR-060: fond manbai boshqa hisobga o''zgaradi'
);

-- ─── Kategoriyalar (BR-003, BR-031, BR-033, BR-034, BR-036) ────────────────
select lives_ok(
  $$ insert into public.categories (household_id, kind, name, parent_id)
     values ((select id from ref where name = 'h'), 'expense', 'Taksi', (select id from ref where name = 'c_transport')) $$,
  'BR-034: subkategoriya qo''shiladi'
);
insert into ref select 'c_taksi', c.id from public.categories c
  where c.household_id = (select id from ref where name = 'h') and c.name = 'Taksi';
select throws_ok(
  $$ insert into public.categories (household_id, kind, name, parent_id)
     values ((select id from ref where name = 'h'), 'expense', 'Yandex', (select id from ref where name = 'c_taksi')) $$,
  'P0001', 'invalid_parent', 'BR-034: subkategoriya faqat bir daraja'
);
select throws_ok(
  $$ insert into public.categories (household_id, kind, name, parent_id)
     values ((select id from ref where name = 'h'), 'expense', 'Bonus', (select id from ref where name = 'c_oylik')) $$,
  'P0001', 'invalid_parent', 'BR-034: ota kategoriya bilan bir turda'
);
select throws_ok(
  $$ update public.categories set parent_id = (select id from ref where name = 'c_oziq-ovqat')
      where id = (select id from ref where name = 'c_transport') $$,
  'P0001', 'invalid_parent', 'BR-034: subkategoriyasi bor kategoriya boshqasining ostiga o''tmaydi'
);
select throws_ok(
  $$ insert into public.categories (household_id, kind, name, month_shift)
     values ((select id from ref where name = 'h'), 'expense', 'Kafe', -1) $$,
  '23514', null, 'BR-031: oy siljishi faqat daromad turida'
);
select throws_ok(
  $$ insert into public.categories (household_id, kind, name)
     values ((select id from ref where name = 'h'), 'expense', 'transport') $$,
  '23505', null, 'BR-003: kategoriya nomi tur ichida registrsiz yagona'
);
select lives_ok(
  $$ insert into public.categories (household_id, kind, name)
     values ((select id from ref where name = 'h'), 'income', 'Transport') $$,
  'BR-003: boshqa turda bir xil nom mumkin'
);
select lives_ok(
  $$ update public.categories set name = 'Shaxsiy xarajat' where id = (select id from ref where name = 'c_self') $$,
  'BR-033: tizim kategoriyasi nomi o''zgaradi'
);
select throws_ok(
  $$ update public.categories set deleted_at = now() where id = (select id from ref where name = 'c_self') $$,
  'P0001', 'system_category', 'BR-033: tizim kategoriyasi o''chirilmaydi'
);
select throws_ok(
  $$ update public.categories set archived_at = now() where id = (select id from ref where name = 'c_self') $$,
  'P0001', 'system_category', 'BR-033: tizim kategoriyasi arxivlanmaydi'
);
select throws_ok(
  $$ update public.categories set kind = 'income' where id = (select id from ref where name = 'c_kiyim') $$,
  '42501', null, 'kategoriya turi yaratilgandan keyin o''zgarmaydi'
);
select throws_ok(
  $$ insert into public.categories (household_id, kind, name, system_code)
     values ((select id from ref where name = 'h'), 'expense', 'Soxta', 'personal_allocation') $$,
  '42501', null, 'BR-033: tizim kategoriyasini klient yarata olmaydi'
);
select throws_ok(
  $$ update public.categories set deleted_at = now() where id = (select id from ref where name = 'c_transport') $$,
  'P0001', 'category_in_use', 'BR-036: subkategoriyasi bor kategoriya o''chirilmaydi'
);
update public.categories set deleted_at = now() where id = (select id from ref where name = 'c_taksi');
select lives_ok(
  $$ insert into public.categories (household_id, kind, name, parent_id)
     values ((select id from ref where name = 'h'), 'expense', 'Taksi', (select id from ref where name = 'c_transport')) $$,
  'BR-003: o''chirilgan kategoriya nomi qayta ishlatiladi'
);
delete from ref where name = 'c_taksi';
insert into ref select 'c_taksi', c.id from public.categories c
  where c.household_id = (select id from ref where name = 'h') and c.name = 'Taksi' and c.deleted_at is null;

select tests.authenticate_as((select id from u where name = 'bob'));
select throws_ok(
  $$ insert into public.categories (household_id, kind, name)
     values ((select id from ref where name = 'h'), 'expense', 'Bobniki') $$,
  '42501', null, 'BR-011: member kategoriya qo''sha olmaydi'
);

-- ─── Doimiy rejalar (BR-080) ───────────────────────────────────────────────
select tests.authenticate_as((select id from u where name = 'alice'));
select lives_ok(
  $$ insert into public.recurring_rules (household_id, kind, name, category_id, account_id, amount, day_of_month)
     values ((select id from ref where name = 'h'), 'expense', 'Ijara', (select id from ref where name = 'c_ijara'),
             (select id from ref where name = 'card'), 300000000, 5) $$,
  'BR-080: doimiy xarajat qo''shiladi'
);
select throws_ok(
  $$ insert into public.recurring_rules (household_id, kind, name, category_id, day_of_month)
     values ((select id from ref where name = 'h'), 'expense', 'ijara', (select id from ref where name = 'c_ijara'), 5) $$,
  '23505', null, 'BR-003: doimiy reja nomi yagona'
);
select throws_ok(
  $$ insert into public.recurring_rules (household_id, kind, name, category_id, day_of_month)
     values ((select id from ref where name = 'h'), 'expense', 'Suv', (select id from ref where name = 'c_kommunal'), 32) $$,
  '23514', null, 'BR-080: oy kuni 1–31'
);
select throws_ok(
  $$ insert into public.recurring_rules (household_id, kind, name, category_id, day_of_month)
     values ((select id from ref where name = 'h'), 'allocation', 'Fond', (select id from ref where name = 'c_self'), 5) $$,
  '23514', null, 'BR-080: fond ajratmasida kategoriya bo''lmaydi'
);
select throws_ok(
  $$ insert into public.recurring_rules (household_id, kind, name, category_id, day_of_month)
     values ((select id from ref where name = 'h'), 'expense', 'Suv', (select id from ref where name = 'c_oylik'), 5) $$,
  'P0001', 'category_kind_mismatch', 'BR-080: kategoriya turi reja turiga mos'
);
select throws_ok(
  $$ insert into public.recurring_rules (household_id, kind, name, category_id, account_id, day_of_month, auto_pay)
     values ((select id from ref where name = 'h'), 'expense', 'Suv', (select id from ref where name = 'c_kommunal'),
             (select id from ref where name = 'card'), 5, true) $$,
  '23514', null, 'BR-075: avto to''lov noma''lum summa bilan bo''lmaydi'
);
select throws_ok(
  $$ insert into public.recurring_rules (household_id, kind, name, category_id, day_of_month, start_month)
     values ((select id from ref where name = 'h'), 'expense', 'Suv', (select id from ref where name = 'c_kommunal'), 5, '2026-09-15') $$,
  '23514', null, 'BR-080: amal davri oy boshidan (1-kun)'
);
select throws_ok(
  $$ insert into public.recurring_rules (household_id, kind, name, category_id, day_of_month, start_month, end_month)
     values ((select id from ref where name = 'h'), 'expense', 'Suv', (select id from ref where name = 'c_kommunal'), 5,
             '2026-09-01', '2026-08-01') $$,
  '23514', null, 'BR-080: tugash oyi boshlanishdan oldin emas'
);
select throws_ok(
  $$ insert into public.recurring_rules (household_id, kind, name, account_id, amount, day_of_month)
     values ((select id from ref where name = 'h'), 'allocation', 'Fond', (select id from ref where name = 'fund'), 100000, 5) $$,
  'P0001', 'invalid_account', 'BR-061: ajratma manbai fondning o''zi bo''lolmaydi'
);
select lives_ok(
  $$ insert into public.recurring_rules (household_id, kind, name, category_id, day_of_month)
     values ((select id from ref where name = 'h'), 'expense', 'Kommunal', (select id from ref where name = 'c_kommunal'), 10) $$,
  'BR-080: o''zgaruvchan summa (NULL) ruxsat'
);
select throws_ok(
  $$ update public.categories set deleted_at = now() where id = (select id from ref where name = 'c_ijara') $$,
  'P0001', 'category_in_use', 'BR-036: doimiy rejada ishlatilgan kategoriya o''chirilmaydi'
);

-- ─── Limitlar (BR-130) ─────────────────────────────────────────────────────
select throws_ok(
  $$ insert into public.category_limits (household_id, category_id, amount)
     values ((select id from ref where name = 'h'), (select id from ref where name = 'c_oziq-ovqat'), 0) $$,
  '23514', null, 'BR-130: limit summasi musbat'
);
select throws_ok(
  $$ insert into public.category_limits (household_id, category_id, amount)
     values ((select id from ref where name = 'h'), (select id from ref where name = 'c_oylik'), 100000) $$,
  'P0001', 'category_kind_mismatch', 'BR-130: limit faqat xarajat kategoriyasiga'
);
select lives_ok(
  $$ insert into public.category_limits (household_id, category_id, amount)
     values ((select id from ref where name = 'h'), (select id from ref where name = 'c_oziq-ovqat'), 200000000) $$,
  'BR-130: limit qo''shiladi'
);
select throws_ok(
  $$ insert into public.category_limits (household_id, category_id, amount)
     values ((select id from ref where name = 'h'), (select id from ref where name = 'c_oziq-ovqat'), 300000000) $$,
  '23505', null, 'BR-130: bitta kategoriyaga bitta limit'
);

-- ─── Tez tugmalar (BR-140) ─────────────────────────────────────────────────
select throws_ok(
  $$ insert into public.quick_actions (household_id, name, amount, category_id, account_id)
     values ((select id from ref where name = 'h'), 'Taksi', 0,
             (select id from ref where name = 'c_taksi'), (select id from ref where name = 'cash')) $$,
  '23514', null, 'BR-140: tez tugma summasi musbat'
);
select throws_ok(
  $$ insert into public.quick_actions (household_id, name, amount, category_id, account_id)
     values ((select id from ref where name = 'h'), 'Taksi', 2000000,
             (select id from ref where name = 'c_oylik'), (select id from ref where name = 'cash')) $$,
  'P0001', 'category_kind_mismatch', 'BR-141: tez tugma xarajat kategoriyasi bilan'
);
select lives_ok(
  $$ insert into public.quick_actions (household_id, name, amount, category_id, account_id)
     values ((select id from ref where name = 'h'), 'Taksi', 2000000,
             (select id from ref where name = 'c_taksi'), (select id from ref where name = 'cash')) $$,
  'BR-140: tez tugma qo''shiladi'
);
select throws_ok(
  $$ update public.accounts set deleted_at = now() where id = (select id from ref where name = 'cash') $$,
  'P0001', 'account_in_use', 'BR-024: tez tugmada ishlatilgan hisob o''chirilmaydi'
);
select throws_ok(
  $$ insert into public.quick_actions (household_id, name, amount, category_id, account_id)
     values ((select id from ref where name = 'h2'), 'Non', 500000,
             (select id from ref where name = 'c_oziq-ovqat'), (select id from ref where name = 'h2_cash')) $$,
  '23503', null, 'ADR-04: boshqa byudjet kategoriyasiga havola imkonsiz'
);
update public.categories set deleted_at = now() where id = (select id from ref where name = 'c_kiyim');
select throws_ok(
  $$ insert into public.quick_actions (household_id, name, amount, category_id, account_id)
     values ((select id from ref where name = 'h'), 'Paypoq', 3000000,
             (select id from ref where name = 'c_kiyim'), (select id from ref where name = 'cash')) $$,
  'P0001', 'category_deleted', 'o''chirilgan kategoriyaga yangi havola yo''q'
);

-- ─── Teglar (BR-200) ───────────────────────────────────────────────────────
select tests.authenticate_as((select id from u where name = 'bob'));
select lives_ok(
  $$ insert into public.tags (household_id, name) values ((select id from ref where name = 'h'), 'safar') $$,
  'BR-200: member teg yaratadi (amal bilan birga)'
);
select throws_ok(
  $$ insert into public.tags (household_id, name) values ((select id from ref where name = 'h'), 'SAFAR') $$,
  '23505', null, 'BR-003: teg nomi registrsiz yagona'
);
update public.tags set name = 'sayohat' where household_id = (select id from ref where name = 'h');

select tests.authenticate_as((select id from u where name = 'carol'));
select throws_ok(
  $$ insert into public.tags (household_id, name) values ((select id from ref where name = 'h'), 'kino') $$,
  '42501', null, 'BR-011: viewer teg yarata olmaydi'
);

select tests.clear_authentication();
select results_eq(
  $$ select name::text from public.tags where household_id = (select id from ref where name = 'h') $$,
  $$ values ('safar') $$,
  'BR-011: member tegni o''zgartira olmaydi (owner/admin)'
);

-- ─── Byudjet o'chirilsa — spravochniklar ham (cascade) ─────────────────────
select lives_ok(
  $$ delete from public.households where id = (select id from ref where name = 'h2') $$,
  'byudjet spravochniklari bilan birga o''chiriladi'
);
select is_empty(
  $$ select 1 from public.accounts where household_id = (select id from ref where name = 'h2')
     union all
     select 1 from public.categories where household_id = (select id from ref where name = 'h2') $$,
  'o''chirilgan byudjetdan yozuv qolmaydi'
);

select * from finish();
rollback;
