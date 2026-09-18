-- E10-T05: tozalash — 90 kunlik tombstone'lar (havola qilinayotgani
-- o'tkaziladi), purged_version, audit (180 kun), sinxron jurnali (30 kun).
-- Qoidalar: BR-008; ARXITEKTURA 6 (tombstone tozalash, resync).
begin;
select plan(8);

create temporary table u (name text primary key, id uuid) on commit drop;
insert into u values ('alice', tests.create_user('alice@test.uz'));
grant select on u to authenticated;

create temporary table ref (name text primary key, id uuid) on commit drop;
grant all on ref to authenticated;
insert into ref select 'h', p.last_household_id from public.profiles p
  where p.user_id = (select id from u where name = 'alice');
insert into ref select 'card', a.id from public.accounts a
  where a.household_id = (select id from ref where name = 'h') and a.type = 'card';
insert into ref select 'c_food', c.id from public.categories c
  where c.household_id = (select id from ref where name = 'h') and c.name = 'Oziq-ovqat';

-- Holat: T1 — 100 kun oldin o'chirilgan; "Eski" kategoriyasi — 100 kun oldin
-- o'chirilgan, lekin T2 (10 kun oldin o'chirilgan) hali unga havola qiladi;
-- teg — 100 kun oldin o'chirilgan, havolasiz.
insert into public.categories (household_id, kind, name) values ((select id from ref where name = 'h'), 'expense', 'Eski');
insert into ref select 'c_old', c.id from public.categories c
  where c.household_id = (select id from ref where name = 'h') and c.name = 'Eski';
insert into public.transactions (id, household_id, kind, account_id, amount, category_id, occurred_on, budget_month)
values ('01990000-0000-7000-8000-0000000000f1', (select id from ref where name = 'h'), 'expense',
        (select id from ref where name = 'card'), 1000, (select id from ref where name = 'c_food'), '2026-05-01', '2026-05-01'),
       ('01990000-0000-7000-8000-0000000000f2', (select id from ref where name = 'h'), 'expense',
        (select id from ref where name = 'card'), 2000, (select id from ref where name = 'c_old'), '2026-05-02', '2026-05-01');
insert into public.tags (household_id, name) values ((select id from ref where name = 'h'), 'eski-teg');
update public.transactions set deleted_at = now() - interval '100 days' where id = '01990000-0000-7000-8000-0000000000f1';
update public.transactions set deleted_at = now() - interval '10 days' where id = '01990000-0000-7000-8000-0000000000f2';
update public.categories set deleted_at = now() - interval '100 days' where id = (select id from ref where name = 'c_old');
update public.tags set deleted_at = now() - interval '100 days' where household_id = (select id from ref where name = 'h');

create temporary table v (name text primary key, n bigint) on commit drop;
insert into v select 'tx1_version', row_version from public.transactions where id = '01990000-0000-7000-8000-0000000000f1';
insert into v select 'tag_version', row_version from public.tags where household_id = (select id from ref where name = 'h');

insert into public.audit_log (household_id, table_name, action, at)
values ((select id from ref where name = 'h'), 'transactions', 'update', now() - interval '200 days'),
       ((select id from ref where name = 'h'), 'transactions', 'update', now() - interval '10 days');
insert into public.sync_mutations (mutation_id, household_id, device_id, table_name, record_id, status, result, applied_at)
values (gen_random_uuid(), (select id from ref where name = 'h'), 'old-phone', 'transactions', gen_random_uuid(), 'ok', '{}', now() - interval '40 days'),
       (gen_random_uuid(), (select id from ref where name = 'h'), 'new-phone', 'transactions', gen_random_uuid(), 'ok', '{}', now() - interval '1 day');

-- ─── Ruxsat ────────────────────────────────────────────────────────────────
select tests.authenticate_as((select id from u where name = 'alice'));
select throws_ok(
  $$ select jobs.purge() $$,
  '42501', null, 'tozalash ishi klientga ochiq emas (faqat pg_cron / service)'
);
select tests.clear_authentication();

-- ─── Tozalash ──────────────────────────────────────────────────────────────
create temporary table res (v jsonb) on commit drop;
insert into res select jobs.purge();
select results_eq(
  $$ select (v #>> '{transactions,deleted}')::int, (v #>> '{categories,deleted}')::int, (v #>> '{categories,skipped}')::int,
            (v #>> '{tags,deleted}')::int
       from res $$,
  $$ values (1, 0, 1, 1) $$,
  '90 kundan eski tombstone''lar o''chirildi; hali havola qilinayotgani o''tkazildi (natijada ko''rinadi)'
);
select results_eq(
  $$ select (select count(*)::int from public.transactions where id = '01990000-0000-7000-8000-0000000000f1'),
            (select count(*)::int from public.transactions where id = '01990000-0000-7000-8000-0000000000f2'),
            (select count(*)::int from public.categories where id = (select id from ref where name = 'c_old')) $$,
  $$ values (0, 1, 1) $$,
  'eski T1 yo''q; yangi tombstone T2 va unga kerak kategoriya qoldi'
);
select is(
  (select purged_version from public.households where id = (select id from ref where name = 'h')),
  (select max(n) from v),
  'purged_version — tozalangan qatorlarning eng katta versiyasi'
);
select results_eq(
  $$ select (select count(*)::int from public.audit_log
              where household_id = (select id from ref where name = 'h') and at < now() - interval '180 days'),
            (select count(*)::int from public.audit_log
              where household_id = (select id from ref where name = 'h') and at > now() - interval '30 days' and table_name = 'transactions'
                and actor_id is null and record_id is null) $$,
  $$ values (0, 1) $$,
  'BR-008: 180 kundan eski audit o''chirildi, yangisi qoldi'
);
select results_eq(
  $$ select device_id from public.sync_mutations where household_id = (select id from ref where name = 'h') $$,
  $$ values ('new-phone') $$,
  'sinxron jurnali: 30 kundan eskisi o''chirildi'
);
select is(
  (jobs.purge() #>> '{transactions,deleted}')::int, 0,
  'qayta ishga tushirish xavfsiz (idempotent)'
);

-- ─── Eski kursor → resync ──────────────────────────────────────────────────
select tests.authenticate_as((select id from u where name = 'alice'));
select is(
  (public.sync_pull((select id from ref where name = 'h'), 1) ->> 'resync_required')::boolean, true,
  'tozalangan versiyadan eski kursor — to''liq qayta yuklash talab qilinadi'
);

select * from finish();
rollback;
