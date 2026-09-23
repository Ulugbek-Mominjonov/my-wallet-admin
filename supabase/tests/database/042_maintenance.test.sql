-- E08-T04, T05: tegishli oyni qayta joylash (E25-T04 — yozuvlar ro'yxati),
-- oyni yopish, kategoriyalarni birlashtirish.
-- Qoidalar: BR-034, BR-036, BR-042, BR-043, BR-150, BR-153, BR-011.
begin;
select plan(19);

-- ─── Tayyorgarlik ──────────────────────────────────────────────────────────
create temporary table u (name text primary key, id uuid) on commit drop;
insert into u values
  ('alice', tests.create_user('alice@test.uz')),
  ('bob',   tests.create_user('bob@test.uz'));
grant select on u to authenticated;

create temporary table ref (name text primary key, id uuid) on commit drop;
grant all on ref to authenticated;
insert into ref select 'h', p.last_household_id from public.profiles p
  where p.user_id = (select id from u where name = 'alice');
insert into ref select a.type::text, a.id from public.accounts a
  where a.household_id = (select id from ref where name = 'h');
insert into ref select 'c_' || lower(c.name), c.id from public.categories c
  where c.household_id = (select id from ref where name = 'h')
    and c.name in ('Oylik', 'Avans', 'KPI', 'Transport', 'Oziq-ovqat', 'Kiyim', 'Uy-ro''zg''or');
insert into ref select 'c_self', c.id from public.categories c
  where c.household_id = (select id from ref where name = 'h') and c.system_code = 'personal_allocation';

create temporary table r (name text primary key, v jsonb) on commit drop;
grant all on r to authenticated;

select tests.authenticate_as((select id from u where name = 'alice'));
create temporary table inv (code text) on commit drop;
grant all on inv to authenticated;
insert into inv select code from public.create_invite((select id from ref where name = 'h'), 'member');

-- Oylik (−1): 02.10 → 09 (auto), 20.10 → qo'lda 10.
insert into public.transactions (household_id, kind, account_id, amount, category_id, occurred_on, budget_month, budget_month_source)
values ((select id from ref where name = 'h'), 'income', (select id from ref where name = 'card'), 800000000,
        (select id from ref where name = 'c_oylik'), '2026-10-02', '2026-09-01', 'auto'),
       ((select id from ref where name = 'h'), 'income', (select id from ref where name = 'card'), 100000000,
        (select id from ref where name = 'c_oylik'), '2026-10-20', '2026-10-01', 'manual');

select tests.authenticate_as((select id from u where name = 'bob'));
select public.accept_invite((select code from inv));

-- ─── Qayta joylash (BR-043) ────────────────────────────────────────────────
select throws_ok(
  $$ select public.recalc_income_months_preview((select id from ref where name = 'h')) $$,
  'P0001', 'forbidden', 'BR-011: qayta joylash — owner/admin'
);
select throws_ok(
  $$ select public.recalc_income_months_rows((select id from ref where name = 'h')) $$,
  'P0001', 'forbidden', 'BR-011: ko''chadigan yozuvlar ro''yxati — owner/admin'
);
select tests.authenticate_as((select id from u where name = 'alice'));
update public.categories set month_shift = 0 where id = (select id from ref where name = 'c_oylik');
insert into r select 'preview', public.recalc_income_months_preview((select id from ref where name = 'h'));
select results_eq(
  $$ select (v ->> 'count')::int, v -> 'moves' -> 0 ->> 'from_month', v -> 'moves' -> 0 ->> 'to_month' from r where name = 'preview' $$,
  $$ values (1, '2026-09-01', '2026-10-01') $$,
  'BR-043: preview — "1 ta yozuv ko''chadi: 2026-09 → 2026-10"; qo''lda tanlangani ko''chmaydi (BR-042)'
);
insert into r select 'rows', public.recalc_income_months_rows((select id from ref where name = 'h'), 50);
select results_eq(
  $$ select (v ->> 'total')::int, jsonb_array_length(v -> 'rows'),
            v -> 'rows' -> 0 ->> 'occurred_on', v -> 'rows' -> 0 ->> 'category',
            v -> 'rows' -> 0 ->> 'from_month', v -> 'rows' -> 0 ->> 'to_month'
       from r where name = 'rows' $$,
  $$ values (1, 1, '2026-10-02', 'Oylik', '2026-09-01', '2026-10-01') $$,
  'E25-T04: har yozuv ko''rinadi — sana, turi, eski oy → yangi oy'
);
select throws_ok(
  $$ select public.recalc_income_months_apply((select id from ref where name = 'h'), 5) $$,
  'P0001', 'preview_outdated', 'BR-043: preview''dan keyin o''zgargan bo''lsa — rad etiladi'
);
select is(
  (public.recalc_income_months_apply((select id from ref where name = 'h'), 1) ->> 'moved')::int, 1,
  'BR-043: tasdiqdan keyin bitta tranzaksiyada qayta joylanadi'
);
select results_eq(
  $$ select occurred_on, budget_month::date from public.transactions
      where household_id = (select id from ref where name = 'h') and kind = 'income' order by occurred_on $$,
  $$ values (date '2026-10-02', date '2026-10-01'), ('2026-10-20', '2026-10-01') $$,
  'qayta joylangandan keyin hammasi yangi qoida bo''yicha'
);

-- ─── Oyni yopish (BR-150, BR-153) ──────────────────────────────────────────
insert into public.planned_items (household_id, kind, name, category_id, planned_amount, due_date, budget_month)
values ((select id from ref where name = 'h'), 'expense', 'Ijara', (select id from ref where name = 'c_uy-ro''zg''or'), 300000000, '2026-08-05', '2026-08-01'),
       ((select id from ref where name = 'h'), 'expense', 'Suv', (select id from ref where name = 'c_uy-ro''zg''or'), null, '2026-08-10', '2026-08-01');
select results_eq(
  $$ select (v ->> 'unpaid_count')::int, (v ->> 'unpaid_amount')::bigint, (v ->> 'unknown_count')::int
       from (select public.month_close_check((select id from ref where name = 'h'), '2026-08-01') as v) x $$,
  $$ values (1, 300000000::bigint, 1) $$,
  'BR-153: yopishdan oldin — to''lanmagan va summasi noma''lum rejalar'
);
select throws_ok(
  $$ select public.set_month_closed((select id from ref where name = 'h'),
       date_trunc('month', now() at time zone 'Asia/Tashkent')::date, true) $$,
  'P0001', 'month_not_finished', 'BR-150: faqat tugagan oy yopiladi'
);
select tests.authenticate_as((select id from u where name = 'bob'));
select throws_ok(
  $$ select public.set_month_closed((select id from ref where name = 'h'), '2026-08-01', true) $$,
  'P0001', 'forbidden', 'BR-150: member oyni yopa olmaydi'
);
select tests.authenticate_as((select id from u where name = 'alice'));
select public.set_month_closed((select id from ref where name = 'h'), '2026-08-01', true);
select isnt_empty(
  $$ select 1 from public.months where household_id = (select id from ref where name = 'h') and month = '2026-08-01'
       and closed_at is not null and closed_by = (select id from u where name = 'alice') $$,
  'BR-150: oy yopildi (kim yopgani bilan)'
);
select public.set_month_closed((select id from ref where name = 'h'), '2026-08-01', false);
select isnt_empty(
  $$ select 1 from public.months where household_id = (select id from ref where name = 'h') and month = '2026-08-01' and closed_at is null $$,
  'BR-150: oy qayta ochiladi'
);

-- ─── Kategoriyalarni birlashtirish (BR-036) ────────────────────────────────
-- "Kiyim" (manba): subkategoriya, amal, reja, doimiy reja, tez tugma, limit;
-- "Oziq-ovqat" (maqsad): o'z limiti bor — maqsadniki qoladi.
insert into public.categories (household_id, kind, name, parent_id)
  values ((select id from ref where name = 'h'), 'expense', 'Poyabzal', (select id from ref where name = 'c_kiyim'));
insert into public.transactions (household_id, kind, account_id, amount, category_id, occurred_on, budget_month)
  values ((select id from ref where name = 'h'), 'expense', (select id from ref where name = 'card'), 25000000,
          (select id from ref where name = 'c_kiyim'), '2026-10-03', '2026-10-01');
insert into public.planned_items (household_id, kind, name, category_id, planned_amount, due_date, budget_month)
  values ((select id from ref where name = 'h'), 'expense', 'Qishki kurtka', (select id from ref where name = 'c_kiyim'), 90000000, '2026-10-20', '2026-10-01');
insert into public.recurring_rules (household_id, kind, name, category_id, day_of_month)
  values ((select id from ref where name = 'h'), 'expense', 'Kiyim-kechak', (select id from ref where name = 'c_kiyim'), 15);
insert into public.quick_actions (household_id, name, amount, category_id, account_id)
  values ((select id from ref where name = 'h'), 'Paypoq', 3000000, (select id from ref where name = 'c_kiyim'), (select id from ref where name = 'cash'));
insert into public.category_limits (household_id, category_id, amount)
  values ((select id from ref where name = 'h'), (select id from ref where name = 'c_kiyim'), 50000000),
         ((select id from ref where name = 'h'), (select id from ref where name = 'c_oziq-ovqat'), 200000000);

select throws_ok(
  $$ select public.merge_categories((select id from ref where name = 'c_self'), (select id from ref where name = 'c_kiyim')) $$,
  'P0001', 'system_category', 'BR-033: tizim kategoriyasi birlashtirib o''chirilmaydi'
);
select throws_ok(
  $$ select public.merge_categories((select id from ref where name = 'c_kiyim'), (select id from ref where name = 'c_avans')) $$,
  'P0001', 'category_kind_mismatch', 'xarajat va daromad turi birlashmaydi'
);
select throws_ok(
  $$ select public.merge_categories((select id from ref where name = 'c_avans'), (select id from ref where name = 'c_kpi')) $$,
  'P0001', 'month_shift_mismatch', 'BR-043: oy siljishi farqli daromad turlari birlashmaydi (amallar oyi jimgina o''zgarardi)'
);
insert into public.categories (household_id, kind, name, parent_id)
  values ((select id from ref where name = 'h'), 'expense', 'Taksi', (select id from ref where name = 'c_transport'));
select throws_ok(
  $$ select public.merge_categories((select id from ref where name = 'c_kiyim'),
       (select c.id from public.categories c where c.household_id = (select id from ref where name = 'h') and c.name = 'Taksi')) $$,
  'P0001', 'invalid_parent', 'BR-034: subkategoriyasi bor kategoriya subkategoriyaga birlashmaydi'
);

select tests.authenticate_as((select id from u where name = 'bob'));
select throws_ok(
  $$ select public.merge_categories((select id from ref where name = 'c_kiyim'), (select id from ref where name = 'c_oziq-ovqat')) $$,
  'P0001', 'forbidden', 'BR-011: birlashtirish — owner/admin'
);

select tests.authenticate_as((select id from u where name = 'alice'));
insert into r select 'merge', public.merge_categories((select id from ref where name = 'c_kiyim'), (select id from ref where name = 'c_oziq-ovqat'));
select results_eq(
  $$ select (v ->> 'children')::int, (v ->> 'transactions')::int, (v ->> 'plans')::int,
            (v ->> 'recurring_rules')::int, (v ->> 'quick_actions')::int
       from r where name = 'merge' $$,
  $$ values (1, 1, 1, 1, 1) $$,
  'BR-036: barcha havolalar maqsad kategoriyaga ko''chdi'
);
select results_eq(
  $$ select (select deleted_at is not null from public.categories where id = (select id from ref where name = 'c_kiyim')),
            (select count(*)::int from public.category_limits
              where category_id = (select id from ref where name = 'c_oziq-ovqat') and deleted_at is null),
            (select amount from public.category_limits
              where category_id = (select id from ref where name = 'c_oziq-ovqat') and deleted_at is null) $$,
  $$ values (true, 1, 200000000::bigint) $$,
  'BR-036: manba o''chirildi; maqsad limiti saqlandi (bitta)'
);

select * from finish();
rollback;
