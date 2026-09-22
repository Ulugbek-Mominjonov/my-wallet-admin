-- E23-T01/T03: transactions_list (filtrlar + keyset), transactions_summary
-- (shu filtr bilan jami), bulk_transactions (har qator natijasi alohida).
begin;
select plan(21);

-- ─── Tayyorgarlik ──────────────────────────────────────────────────────────
create temporary table u (name text primary key, id uuid) on commit drop;
insert into u values
  ('alice', tests.create_user('alice@test.uz')),
  ('bob',   tests.create_user('bob@test.uz')),
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
    and c.name in ('Oziq-ovqat', 'Transport', 'Kiyim', 'Avans');

create temporary table tx (name text primary key, id uuid) on commit drop;
grant all on tx to authenticated;

select tests.authenticate_as((select id from u where name = 'alice'));
create temporary table inv (role text primary key, code text) on commit drop;
grant all on inv to authenticated;
insert into inv select 'member', code from public.create_invite((select id from ref where name = 'h'), 'member');
insert into inv select 'viewer', code from public.create_invite((select id from ref where name = 'h'), 'viewer');
-- Transport → Taksi (subkategoriya) va bitta teg.
insert into public.categories (household_id, kind, name, parent_id)
  values ((select id from ref where name = 'h'), 'expense', 'Taksi', (select id from ref where name = 'c_transport'));
insert into ref select 'c_taksi', c.id from public.categories c
  where c.household_id = (select id from ref where name = 'h') and c.name = 'Taksi';
insert into public.tags (household_id, name) values ((select id from ref where name = 'h'), 'Ta''til');
insert into ref select 'tag', t.id from public.tags t where t.household_id = (select id from ref where name = 'h');

select tests.authenticate_as((select id from u where name = 'bob'));
select public.accept_invite((select code from inv where role = 'member'));
select tests.authenticate_as((select id from u where name = 'carol'));
select public.accept_invite((select code from inv where role = 'viewer'));

-- Avgust yopilgan (qattiq qulf keyinroq yoqiladi — ommaviy o'chirish testi).
select tests.clear_authentication();
insert into public.months (household_id, month, closed_at) values ((select id from ref where name = 'h'), '2026-08-01', now());

-- alice: 6 ta amal; bob: 2 ta. Korzinka va Makro — bir kunda (keyset teng sana).
select tests.authenticate_as((select id from u where name = 'alice'));
with ins as (
  insert into public.transactions (household_id, kind, account_id, amount, category_id, payee, note, occurred_on, budget_month)
  values
    ((select id from ref where name = 'h'), 'expense', (select id from ref where name = 'cash'), 5000000, (select id from ref where name = 'c_oziq-ovqat'), 'Korzinka', null, '2026-09-03', '2026-09-01'),
    ((select id from ref where name = 'h'), 'expense', (select id from ref where name = 'card'), 3000000, (select id from ref where name = 'c_taksi'), 'Yandex', null, '2026-09-05', '2026-09-01'),
    ((select id from ref where name = 'h'), 'expense', (select id from ref where name = 'card'), 12000000, (select id from ref where name = 'c_kiyim'), 'Zara', 'kurtka 100%_chegirma', '2026-09-10', '2026-09-01'),
    ((select id from ref where name = 'h'), 'income', (select id from ref where name = 'card'), 800000000, (select id from ref where name = 'c_avans'), 'Avans', null, '2026-10-16', '2026-10-01'),
    ((select id from ref where name = 'h'), 'expense', (select id from ref where name = 'cash'), 100000, (select id from ref where name = 'c_oziq-ovqat'), 'Avgust', null, '2026-08-20', '2026-08-01')
  returning id, lower(payee) as name
)
insert into tx select name, id from ins;
with ins as (
  insert into public.transactions (household_id, kind, account_id, to_account_id, amount, payee, occurred_on, budget_month)
  values ((select id from ref where name = 'h'), 'transfer', (select id from ref where name = 'card'),
          (select id from ref where name = 'cash'), 1000000, 'Bankomat', '2026-09-15', '2026-09-01')
  returning id
)
insert into tx select 'bankomat', id from ins;
insert into public.transaction_tags (household_id, transaction_id, tag_id)
  values ((select id from ref where name = 'h'), (select id from tx where name = 'zara'), (select id from ref where name = 'tag'));

select tests.authenticate_as((select id from u where name = 'bob'));
with ins as (
  insert into public.transactions (household_id, kind, account_id, amount, category_id, payee, occurred_on, budget_month)
  values
    ((select id from ref where name = 'h'), 'expense', (select id from ref where name = 'cash'), 2000000, (select id from ref where name = 'c_oziq-ovqat'), 'Makro', '2026-09-03', '2026-09-01'),
    ((select id from ref where name = 'h'), 'expense', (select id from ref where name = 'card'), 4000000, (select id from ref where name = 'c_transport'), 'Benzin', '2026-09-20', '2026-09-01')
  returning id, lower(payee) as name
)
insert into tx select name, id from ins;

-- ─── Filtrlar (viewer ham o'qiydi) ─────────────────────────────────────────
select tests.authenticate_as((select id from u where name = 'carol'));
select set_eq(
  $$ select payee from public.transactions_list((select id from ref where name = 'h'),
       jsonb_build_object('month', '2026-09-01')) $$,
  array['Benzin', 'Bankomat', 'Zara', 'Yandex', 'Makro', 'Korzinka'],
  'oy filtri — tegishli oy bo''yicha'
);
select set_eq(
  $$ select payee from public.transactions_list((select id from ref where name = 'h'),
       jsonb_build_object('categories', jsonb_build_array((select id from ref where name = 'c_transport')))) $$,
  array['Benzin', 'Yandex'],
  'kategoriya — subkategoriyalari bilan (Transport → Taksi)'
);
select set_eq(
  $$ select payee from public.transactions_list((select id from ref where name = 'h'),
       jsonb_build_object('accounts', jsonb_build_array((select id from ref where name = 'cash')),
                          'from', '2026-09-01', 'to', '2026-09-30')) $$,
  array['Bankomat', 'Makro', 'Korzinka'],
  'hisob — manba yoki manzil (o''tkazma kirimi ham); sana oralig''i'
);
select set_eq(
  $$ select payee from public.transactions_list((select id from ref where name = 'h'),
       jsonb_build_object('members', jsonb_build_array((select id from u where name = 'bob')))) $$,
  array['Makro', 'Benzin'],
  'a''zo filtri — kim kiritgan'
);
select results_eq(
  $$ select payee, tag_ids from public.transactions_list((select id from ref where name = 'h'),
       jsonb_build_object('tags', jsonb_build_array((select id from ref where name = 'tag')))) $$,
  $$ values ('Zara'::text, array[(select id from ref where name = 'tag')]) $$,
  'teg filtri; qatorda teglari'
);
select set_eq(
  $$ select payee from public.transactions_list((select id from ref where name = 'h'),
       jsonb_build_object('q', '100%_')) $$,
  array['Zara'],
  'qidiruv izohda ham; % va _ — oddiy belgi (LIKE naqshi emas)'
);
select set_eq(
  $$ select payee from public.transactions_list((select id from ref where name = 'h'),
       jsonb_build_object('q', 'korz')) $$,
  array['Korzinka'],
  'qidiruv — joy nomi qismi, katta-kichik harf farqsiz'
);
select set_eq(
  $$ select payee from public.transactions_list((select id from ref where name = 'h'),
       jsonb_build_object('q', 'karzinka')) $$,
  array['Korzinka'],
  'BR-202: xatoli yozuv ham topiladi (trgm so''z o''xshashligi)'
);
select set_eq(
  $$ select payee from public.transactions_list((select id from ref where name = 'h'),
       jsonb_build_object('kinds', jsonb_build_array('expense'), 'min', 3000000, 'max', 5000000)) $$,
  array['Benzin', 'Yandex', 'Korzinka'],
  'tur va summa oralig''i (asosiy valyutada, chegaralar kiradi)'
);

-- ─── Keyset: sahifalar birlashmasi = to'liq tartib (teng sanada ham) ───────
create temporary table full_order as
  select array_agg(t.id order by t.occurred_on desc, t.id desc) as ids
    from public.transactions t
   where t.household_id = (select id from ref where name = 'h') and t.deleted_at is null;
grant select on full_order to authenticated;
-- Chegara 5-qatorda: Korzinka va Makro (bir kun) ikki sahifaga bo'linadi.
create temporary table page1 as
  select * from public.transactions_list((select id from ref where name = 'h'), '{}', null, null, 5)
    with ordinality;
grant select on page1 to authenticated;
create temporary table page2 as
  select * from public.transactions_list((select id from ref where name = 'h'), '{}',
    (select occurred_on from page1 order by ordinality desc limit 1),
    (select id from page1 order by ordinality desc limit 1), 5)
    with ordinality;
grant select on page2 to authenticated;
select is(
  array(select id from page1 order by ordinality) || array(select id from page2 order by ordinality),
  (select ids from full_order),
  'keyset — takror ham, tushib qolish ham yo''q'
);

-- ─── Jami (shu filtr) ──────────────────────────────────────────────────────
select is(
  public.transactions_summary((select id from ref where name = 'h'), jsonb_build_object('month', '2026-09-01')),
  '{"count": 6, "income": 0, "expense": 26000000, "transfer": 1000000}'::jsonb,
  'jami — ro''yxat bilan bir xil filtrdan'
);

-- ─── RLS ───────────────────────────────────────────────────────────────────
select tests.authenticate_as((select id from u where name = 'eve'));
select throws_ok(
  $$ select 1 from public.transactions_list((select id from ref where name = 'h')) $$,
  'P0001', 'forbidden', 'a''zo bo''lmagan — ro''yxat rad etiladi'
);
select throws_ok(
  $$ select public.transactions_summary((select id from ref where name = 'h')) $$,
  'P0001', 'forbidden', 'a''zo bo''lmagan — jami rad etiladi'
);

-- ─── Ommaviy amallar ───────────────────────────────────────────────────────
select tests.authenticate_as((select id from u where name = 'carol'));
select throws_ok(
  $$ select public.bulk_transactions((select id from ref where name = 'h'),
       array[(select id from tx where name = 'makro')], 'delete') $$,
  'P0001', 'forbidden', 'viewer ommaviy o''zgartira olmaydi'
);

select tests.authenticate_as((select id from u where name = 'bob'));
select throws_ok(
  $$ select public.bulk_transactions((select id from ref where name = 'h'),
       array[(select id from tx where name = 'makro')], 'set_category') $$,
  'P0001', 'invalid_action', 'kategoriyasiz set_category — rad'
);
select throws_ok(
  $$ select public.bulk_transactions((select id from ref where name = 'h'),
       array(select gen_random_uuid() from generate_series(1, 501)), 'delete') $$,
  'P0001', 'invalid_batch', '500 tadan ortiq — rad'
);
select is(
  public.bulk_transactions((select id from ref where name = 'h'),
    array[(select id from tx where name = 'korzinka'), (select id from tx where name = 'avans'),
          (select id from tx where name = 'bankomat'), '00000000-0000-0000-0000-000000000001'::uuid],
    'set_category', (select id from ref where name = 'c_kiyim')),
  jsonb_build_object(
    'done', jsonb_build_array((select id from tx where name = 'korzinka')),
    'skipped', jsonb_build_array(
      jsonb_build_object('id', (select id from tx where name = 'avans'), 'reason', 'category_kind_mismatch'),
      jsonb_build_object('id', (select id from tx where name = 'bankomat'), 'reason', 'category_kind_mismatch'),
      jsonb_build_object('id', '00000000-0000-0000-0000-000000000001', 'reason', 'not_found'))),
  'set_category — mos kelmagan tur, o''tkazma va begona id o''tkaziladi, qolgani bajariladi'
);
select is(
  public.bulk_transactions((select id from ref where name = 'h'),
    array[(select id from tx where name = 'zara'), (select id from tx where name = 'yandex')],
    'add_tag', (select id from ref where name = 'tag')) -> 'done',
  jsonb_build_array((select id from tx where name = 'zara'), (select id from tx where name = 'yandex')),
  'add_tag — mavjud teg qayta qo''shilmaydi (idempotent)'
);
select is(
  (select count(*)::int from public.transaction_tags x
    where x.tag_id = (select id from ref where name = 'tag') and x.deleted_at is null),
  2,
  'add_tag — takror qator yo''q'
);

select tests.authenticate_as((select id from u where name = 'alice'));
update public.households set strict_month_lock = true where id = (select id from ref where name = 'h');
select tests.authenticate_as((select id from u where name = 'bob'));
select is(
  public.bulk_transactions((select id from ref where name = 'h'),
    array[(select id from tx where name = 'makro'), (select id from tx where name = 'avgust')], 'delete'),
  jsonb_build_object(
    'done', jsonb_build_array((select id from tx where name = 'makro')),
    'skipped', jsonb_build_array(
      jsonb_build_object('id', (select id from tx where name = 'avgust'), 'reason', 'month_closed'))),
  'delete — qattiq qulfdagi yopilgan oy amali o''tkaziladi (BR-055)'
);
select is(
  (public.transactions_summary((select id from ref where name = 'h'), jsonb_build_object('month', '2026-09-01')) ->> 'count')::int,
  5,
  'o''chirilgan amal ro''yxat va jamidan chiqadi'
);

select * from finish();
rollback;
