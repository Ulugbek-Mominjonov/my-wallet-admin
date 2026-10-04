-- E24: hisobot "bitta ko'rganda" to'liq bo'lishi uchun — oy oxiridagi hisob
-- qoldiqlari va oydagi amallar ro'yxati (daromad/xarajat, fond belgisi bilan).
begin;
select plan(7);

create temporary table u (name text primary key, id uuid) on commit drop;
insert into u values ('alice', tests.create_user('alice@test.uz'));
grant select on u to authenticated;

create temporary table ref (name text primary key, id uuid) on commit drop;
grant all on ref to authenticated;
insert into ref select 'h', p.last_household_id from public.profiles p
  where p.user_id = (select id from u where name = 'alice');
insert into ref select a.type::text, a.id from public.accounts a
  where a.household_id = (select id from ref where name = 'h');
insert into ref select 'c_' || lower(c.name), c.id from public.categories c
  where c.household_id = (select id from ref where name = 'h')
    and c.name in ('Avans', 'Oziq-ovqat', 'Transport');

create temporary table r (name text primary key, v jsonb) on commit drop;
grant all on r to authenticated;

-- Oktabr: daromad, kartadan xarajat, fonddan xarajat va fondga ajratma.
insert into public.transactions (household_id, kind, account_id, amount, category_id,
                                 occurred_on, budget_month, payee)
values
  ((select id from ref where name = 'h'), 'income', (select id from ref where name = 'card'),
   500000000, (select id from ref where name = 'c_avans'), '2026-10-01', '2026-10-01', 'Oylik'),
  ((select id from ref where name = 'h'), 'expense', (select id from ref where name = 'card'),
   12000000, (select id from ref where name = 'c_oziq-ovqat'), '2026-10-03', '2026-10-01', 'Bozor'),
  ((select id from ref where name = 'h'), 'expense', (select id from ref where name = 'personal_fund'),
   3000000, (select id from ref where name = 'c_transport'), '2026-10-04', '2026-10-01', 'Taksi');

-- Keyingi oydagi xarajat: oy oxiridagi qoldiqqa kirmasligi kerak.
insert into public.transactions (household_id, kind, account_id, amount, category_id,
                                 occurred_on, budget_month, payee)
values ((select id from ref where name = 'h'), 'expense', (select id from ref where name = 'card'),
        99000000, (select id from ref where name = 'c_oziq-ovqat'), '2026-11-02', '2026-11-01', 'Keyingi oy');

select tests.authenticate_as((select id from u where name = 'alice'));
select set_config('app.today', '2026-11-10', true);
insert into r select 'oct', public.report_month((select id from ref where name = 'h'), '2026-10-01');

-- ─── Daromadlar ro'yxati ───────────────────────────────────────────────────
select results_eq(
  $$ select e ->> 'name', e ->> 'category', e ->> 'account', (e ->> 'amount')::bigint
       from r, jsonb_array_elements(r.v -> 'incomes') e where r.name = 'oct' $$,
  $$ values ('Oylik'::text, 'Avans'::text, 'Karta'::text, 500000000::bigint) $$,
  'daromadlar ro''yxati: nomi, kategoriyasi, hisobi va summasi'
);

-- ─── Xarajatlar ro'yxati (fond belgisi bilan) ──────────────────────────────
select results_eq(
  $$ select e ->> 'name', (e ->> 'from_fund')::boolean, (e ->> 'amount')::bigint
       from r, jsonb_array_elements(r.v -> 'expenses') e where r.name = 'oct'
      order by e ->> 'occurred_on' $$,
  $$ values ('Bozor'::text, false, 12000000::bigint), ('Taksi', true, 3000000) $$,
  'xarajatlar sana bo''yicha; shaxsiy fond sarfi belgilangan (BR-063)'
);

select is(
  (select count(*)::int from r, jsonb_array_elements(r.v -> 'expenses') e
    where r.name = 'oct' and (e ->> 'occurred_on') like '2026-11%'),
  0, 'keyingi oy amali oktabr ro''yxatiga tushmaydi'
);

-- ─── Oy oxiridagi qoldiqlar ────────────────────────────────────────────────
select is(
  (select (e ->> 'balance')::bigint from r, jsonb_array_elements(r.v -> 'accounts') e
    where r.name = 'oct' and e ->> 'type' = 'card'),
  488000000::bigint, 'karta qoldig''i oy oxiriga ko''ra (keyingi oy xarajati hisobga olinmaydi)'
);

select is(
  (select (e ->> 'balance')::bigint from r, jsonb_array_elements(r.v -> 'accounts') e
    where r.name = 'oct' and e ->> 'type' = 'personal_fund'),
  -3000000::bigint, 'fond qoldig''i: ajratmasiz sarf — manfiy (BR-062)'
);

-- Noyabr hisobotida keyingi oy xarajati ko'rinadi va qoldiq kamayadi.
insert into r select 'nov', public.report_month((select id from ref where name = 'h'), '2026-11-01');
select is(
  (select (e ->> 'balance')::bigint from r, jsonb_array_elements(r.v -> 'accounts') e
    where r.name = 'nov' and e ->> 'type' = 'card'),
  389000000::bigint, 'noyabr oxirida karta qoldig''i — oktabr qoldig''idan keyingi oy xarajati ayirilgan'
);

select is(
  (select count(*)::int from r, jsonb_array_elements(r.v -> 'incomes') e where r.name = 'nov'),
  0, 'daromadsiz oyda ro''yxat bo''sh (null emas)'
);

select * from finish();
rollback;
