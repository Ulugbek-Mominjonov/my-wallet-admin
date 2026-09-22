-- E23-T02: save_transaction (amal + teglar bitta tranzaksiyada, tegishli oy
-- qoidalari) va payee_suggestions (BR-056).
begin;
select plan(17);

-- ─── Tayyorgarlik ──────────────────────────────────────────────────────────
create temporary table u (name text primary key, id uuid) on commit drop;
insert into u values
  ('alice', tests.create_user('alice@test.uz')),
  ('carol', tests.create_user('carol@test.uz')),
  ('eve',   tests.create_user('eve@test.uz'));
grant select on u to authenticated;

create temporary table ref (name text primary key, id uuid) on commit drop;
grant all on ref to authenticated;
insert into ref select 'h', p.last_household_id from public.profiles p
  where p.user_id = (select id from u where name = 'alice');
insert into ref select a.type::text, a.id from public.accounts a
  where a.household_id = (select id from ref where name = 'h');
insert into ref select 'c_' || lower(c.name), c.id from public.categories c
  where c.household_id = (select id from ref where name = 'h')
    and c.name in ('Oziq-ovqat', 'Kiyim', 'Oylik');

select tests.authenticate_as((select id from u where name = 'alice'));
insert into public.tags (household_id, name)
  values ((select id from ref where name = 'h'), 'Ta''til'), ((select id from ref where name = 'h'), 'Ish');
insert into ref select 'tag_' || lower(replace(t.name, '''', '')), t.id from public.tags t
  where t.household_id = (select id from ref where name = 'h');
create temporary table inv (code text) on commit drop;
grant all on inv to authenticated;
insert into inv select code from public.create_invite((select id from ref where name = 'h'), 'viewer');
select tests.authenticate_as((select id from u where name = 'carol'));
select public.accept_invite((select code from inv));

create temporary table tx (name text primary key, id uuid) on commit drop;
grant all on tx to authenticated;

-- ─── Yaratish ──────────────────────────────────────────────────────────────
select tests.authenticate_as((select id from u where name = 'alice'));
insert into tx select 'korzinka', public.save_transaction(
  (select id from ref where name = 'h'), 'expense', (select id from ref where name = 'cash'), 5000000, '2026-09-03',
  p_category_id => (select id from ref where name = 'c_oziq-ovqat'), p_payee => '  Korzinka ',
  p_tag_ids => array[(select id from ref where name = 'tag_tatil'), (select id from ref where name = 'tag_ish')]);
select results_eq(
  $$ select t.payee::text, t.budget_month::date, t.budget_month_source::text, t.source::text, t.created_by
       from public.transactions t where t.id = (select id from tx where name = 'korzinka') $$,
  $$ values ('Korzinka'::text, date '2026-09-01', 'auto'::text, 'manual'::text, (select id from u where name = 'alice')) $$,
  'yaratish: joy nomi kesiladi, oy — trigger (avto), manba — admin (manual)'
);
select is(
  (select count(*)::int from public.transaction_tags x
    where x.transaction_id = (select id from tx where name = 'korzinka') and x.deleted_at is null),
  2, 'teglar amal bilan birga yoziladi'
);

insert into tx select 'oylik', public.save_transaction(
  (select id from ref where name = 'h'), 'income', (select id from ref where name = 'card'), 900000000, '2026-10-02',
  p_category_id => (select id from ref where name = 'c_oylik'));
select is(
  (select budget_month::date from public.transactions where id = (select id from tx where name = 'oylik')),
  date '2026-09-01', 'BR-040: 2-oktabrdagi oylik — sentabrga (kategoriya siljishi)'
);

insert into tx select 'manual', public.save_transaction(
  (select id from ref where name = 'h'), 'expense', (select id from ref where name = 'card'), 1000000, '2026-09-05',
  p_category_id => (select id from ref where name = 'c_kiyim'), p_budget_month => '2026-08-01');
select results_eq(
  $$ select budget_month::date, budget_month_source::text from public.transactions
      where id = (select id from tx where name = 'manual') $$,
  $$ values (date '2026-08-01', 'manual'::text) $$,
  'BR-042: oy berilsa — qo''lda tanlangan'
);

-- ─── Tahrirlash ────────────────────────────────────────────────────────────
select lives_ok(
  $$ select public.save_transaction(
       (select id from ref where name = 'h'), 'expense', (select id from ref where name = 'cash'), 6000000, '2026-09-03',
       p_category_id => (select id from ref where name = 'c_oziq-ovqat'), p_payee => 'Korzinka',
       p_tag_ids => array[(select id from ref where name = 'tag_ish')], p_id => (select id from tx where name = 'korzinka')) $$,
  'tahrirlash: summa va teglar'
);
select results_eq(
  $$ select x.tag_id, x.deleted_at is null from public.transaction_tags x
      where x.transaction_id = (select id from tx where name = 'korzinka') order by x.deleted_at is null, x.tag_id $$,
  $$ values ((select id from ref where name = 'tag_tatil'), false), ((select id from ref where name = 'tag_ish'), true) $$,
  'ro''yxatda yo''q teg o''chiriladi (tombstone), qolgani joyida'
);

-- BR-043: siljish keyin o'zgarsa, izoh tahriri eski daromadni ko'chirmaydi.
update public.categories set month_shift = 0 where id = (select id from ref where name = 'c_oylik');
select public.save_transaction(
  (select id from ref where name = 'h'), 'income', (select id from ref where name = 'card'), 900000000, '2026-10-02',
  p_category_id => (select id from ref where name = 'c_oylik'), p_note => 'izoh', p_id => (select id from tx where name = 'oylik'));
select results_eq(
  $$ select budget_month::date, note::text from public.transactions where id = (select id from tx where name = 'oylik') $$,
  $$ values (date '2026-09-01', 'izoh'::text) $$,
  'BR-043: izoh tahriri tegishli oyni qayta hisoblamaydi'
);

select public.save_transaction(
  (select id from ref where name = 'h'), 'expense', (select id from ref where name = 'card'), 1000000, '2026-09-05',
  p_category_id => (select id from ref where name = 'c_kiyim'), p_id => (select id from tx where name = 'manual'));
select results_eq(
  $$ select budget_month::date, budget_month_source::text from public.transactions
      where id = (select id from tx where name = 'manual') $$,
  $$ values (date '2026-09-01', 'auto'::text) $$,
  'qo''lda → avto: oy qoidaga qaytadi'
);

-- ─── Xatolar va atomarlik ──────────────────────────────────────────────────
select throws_ok(
  $$ select public.save_transaction((select id from ref where name = 'h'), 'expense', (select id from ref where name = 'cash'), 100, '2026-09-03', p_id => gen_random_uuid()) $$,
  'P0001', 'transaction_not_found', 'mavjud bo''lmagan amal — xato'
);
select throws_ok(
  $$ select public.save_transaction((select id from ref where name = 'h'), 'expense',
       (select id from ref where name = 'cash'), 100, '2026-09-03',
       p_category_id => (select id from ref where name = 'c_oylik')) $$,
  'P0001', 'category_kind_mismatch', 'trigger tekshiruvi (xarajatga daromad kategoriyasi)'
);
update public.tags set deleted_at = now() where id = (select id from ref where name = 'tag_tatil');
select throws_ok(
  $$ select public.save_transaction((select id from ref where name = 'h'), 'expense',
       (select id from ref where name = 'cash'), 100, '2026-09-03', p_payee => 'Atomar',
       p_category_id => (select id from ref where name = 'c_oziq-ovqat'),
       p_tag_ids => array[(select id from ref where name = 'tag_tatil')]) $$,
  'P0001', 'tag_deleted', 'o''chirilgan teg — rad'
);
select is_empty(
  $$ select 1 from public.transactions where payee = 'Atomar' $$,
  'teg xatosida amal ham yozilmaydi (bitta tranzaksiya)'
);

select tests.authenticate_as((select id from u where name = 'carol'));
select throws_ok(
  $$ select public.save_transaction((select id from ref where name = 'h'), 'expense',
       (select id from ref where name = 'cash'), 100, '2026-09-03') $$,
  'P0001', 'forbidden', 'viewer amal yozmaydi'
);

-- ─── BR-056: joy nomi takliflari ───────────────────────────────────────────
select tests.authenticate_as((select id from u where name = 'alice'));
select public.save_transaction((select id from ref where name = 'h'), 'expense',
  (select id from ref where name = 'card'), 100, '2026-09-10', p_payee => 'korzinka',
  p_category_id => (select id from ref where name = 'c_kiyim'));
select public.save_transaction((select id from ref where name = 'h'), 'expense',
  (select id from ref where name = 'cash'), 100, '2026-09-11', p_payee => 'Makro',
  p_category_id => (select id from ref where name = 'c_oziq-ovqat'));
select public.save_transaction((select id from ref where name = 'h'), 'expense',
  (select id from ref where name = 'cash'), 100, '2026-09-12', p_payee => 'Avtobus',
  p_category_id => (select id from ref where name = 'c_oziq-ovqat'));

select tests.authenticate_as((select id from u where name = 'carol'));
select results_eq(
  $$ select payee, category_id, account_id from public.payee_suggestions((select id from ref where name = 'h'), 'KOR') $$,
  $$ values ('korzinka'::text, (select id from ref where name = 'c_kiyim'), (select id from ref where name = 'card')) $$,
  'har nom bir marta, oxirgi kategoriya va hisobi bilan (katta-kichik harf farqsiz)'
);
select results_eq(
  $$ select payee from public.payee_suggestions((select id from ref where name = 'h'), 'a') $$,
  $$ values ('Avtobus'::text), ('Makro'), ('korzinka') $$,
  'boshidan mos kelgani oldin, keyin eng so''nggisi; daromad nomlari yo''q'
);
select is_empty(
  $$ select 1 from public.payee_suggestions((select id from ref where name = 'h'), '%') $$,
  '% — oddiy belgi'
);

select tests.authenticate_as((select id from u where name = 'eve'));
select throws_ok(
  $$ select 1 from public.payee_suggestions((select id from ref where name = 'h'), 'kor') $$,
  'P0001', 'forbidden', 'a''zo bo''lmagan — rad'
);

select * from finish();
rollback;
