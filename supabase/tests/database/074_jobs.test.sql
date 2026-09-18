-- E11-T07, T08: rejali ishlar (pg_cron jadvali, job_runs, Vault orqali Edge
-- Function chaqiruvi), navbat tozalash, chek fayllari (BR-201), akkauntni
-- o'chirish (BR-015), oylik hisobotni hozir yuborish (BR-164, BR-167).
begin;
select plan(18);

-- ─── Tayyorgarlik ──────────────────────────────────────────────────────────
create temporary table u (name text primary key, id uuid) on commit drop;
insert into u values
  ('alice', tests.create_user('alice@test.uz')),
  ('bob',   tests.create_user('bob@test.uz')),
  ('eve',   tests.create_user('eve@test.uz'));
grant select on u to authenticated;

create temporary table ref (name text primary key, id uuid) on commit drop;
grant all on ref to authenticated;
insert into ref select 'h_' || u.name, p.last_household_id from public.profiles p join u on u.id = p.user_id;
insert into ref select 'card', a.id from public.accounts a
  where a.household_id = (select id from ref where name = 'h_alice') and a.type = 'card';

create temporary table r (name text primary key, v jsonb) on commit drop;
grant all on r to authenticated;

select tests.authenticate_as((select id from u where name = 'alice'));
create temporary table inv (code text) on commit drop;
grant all on inv to authenticated;
insert into inv select code from public.create_invite((select id from ref where name = 'h_alice'), 'member');
select public.register_device('fcm-token-alice-0001', 'android');
select tests.authenticate_as((select id from u where name = 'bob'));
select public.accept_invite((select code from inv));
select tests.clear_authentication();

-- ─── Jadval (ARXITEKTURA 7) ────────────────────────────────────────────────
select results_eq(
  $$ select jobname::text, schedule::text from cron.job order by jobname $$,
  $$ values ('daily_sweep', '5 * * * *'), ('enqueue_income_missing', '0 * * * *'), ('enqueue_monthly_reports', '0 * * * *'),
            ('enqueue_reminders', '0 * * * *'), ('fx_sync', '30 5 * * *'), ('notify_dispatch', '*/5 * * * *'),
            ('platform_stats', '0 23 * * *'), ('purge', '30 22 * * *'), ('purge_files', '45 22 * * *') $$,
  'pg_cron: barcha rejali ishlar jadvalda (UTC)'
);

-- ─── jobs.run → job_runs ───────────────────────────────────────────────────
-- Bazada haqiqiy pg_cron yozuvlari va lokal Vault sozlamasi bo'lishi mumkin:
-- test faqat o'z tranzaksiyasidagi qatorlarni ko'radi, Vault — test ichida bo'sh.
delete from vault.secrets where name in ('edge_functions_url', 'cron_secret');
select jobs.run('dispatch_notifications');
insert into public.notification_outbox (user_id, channel, type, dedupe_key)
values ((select id from u where name = 'alice'), 'push', 'test', 'jobs:1');
select jobs.run('dispatch_notifications');
select jobs.run('no_such_job');
select results_eq(
  $$ select job, status, details, finished_at is not null from public.job_runs where started_at = now() order by id $$,
  $$ values ('dispatch_notifications', 'ok', '{"pending": 0}'::jsonb, true),
            ('dispatch_notifications', 'ok', '{"skipped": "not_configured"}', true),
            ('no_such_job', 'failed', '{"error": "unknown_job: no_such_job", "sqlstate": "P0001"}', true) $$,
  'har ish jurnalda: navbat bo''sh — HTTP yo''q; Vault sozlanmagan — o''tkazildi; xato — failed (sababi bilan)'
);

select jobs.run('platform_stats');
select ok(
  (select details ?& array['db_bytes', 'db_limit_pct', 'storage_bytes', 'storage_limit_pct', 'users', 'households']
          and jsonb_array_length(details -> 'largest_tables') between 1 and 10
     from public.job_runs where job = 'platform_stats' and started_at = now()),
  'platform_stats: DB va Storage hajmi (bepul chegaradan foiz), eng katta jadvallar — jurnalga'
);

-- ─── Vault va Edge Function chaqiruvi ──────────────────────────────────────
select ok(
  not has_function_privilege('authenticated', 'private.upsert_vault_secret(text, text)', 'execute')
  and not has_function_privilege('service_role', 'private.upsert_vault_secret(text, text)', 'execute'),
  'Vault yozuvi — faqat postgres (deploy)'
);
select private.upsert_vault_secret('edge_functions_url', 'http://edge.invalid/functions/v1/');
select private.upsert_vault_secret('cron_secret', 'first-secret');
select private.upsert_vault_secret('cron_secret', 'second-secret');
select results_eq(
  $$ select name collate "default", decrypted_secret collate "default" from vault.decrypted_secrets
      where name in ('edge_functions_url', 'cron_secret') order by name $$,
  $$ values ('cron_secret'::text, 'second-secret'::text), ('edge_functions_url', 'http://edge.invalid/functions/v1/') $$,
  'qayta deploy sirni yangilaydi (ikkinchi yozuv yaratilmaydi)'
);
insert into r select 'call', jobs.call_edge_function('notify-dispatch');
select results_eq(
  $$ select q.url, q.headers ->> 'x-cron-secret' from net.http_request_queue q
      where q.id = (select (v ->> 'request_id')::bigint from r where name = 'call') $$,
  $$ values ('http://edge.invalid/functions/v1/notify-dispatch', 'second-secret') $$,
  'pg_net so''rovi: manzil va sir Vault''dan (repoda yo''q)'
);

-- ─── Navbat tarixi 90 kun (BR-166) ─────────────────────────────────────────
insert into public.notification_outbox (user_id, channel, type, dedupe_key, status, created_at)
values ((select id from u where name = 'alice'), 'push', 'test', 'old:sent', 'sent', now() - interval '100 days'),
       ((select id from u where name = 'alice'), 'push', 'test', 'old:pending', 'pending', now() - interval '100 days'),
       ((select id from u where name = 'alice'), 'push', 'test', 'new:sent', 'sent', now() - interval '10 days');
select is(jobs.purge_outbox(), '{"notification_outbox": 1}'::jsonb, '90 kundan eski yakunlangan xabarlar o''chirildi');
select is(
  (select array_agg(dedupe_key order by dedupe_key) from public.notification_outbox where dedupe_key like '%:%sent%' or dedupe_key like '%:pending'),
  array['new:sent', 'old:pending'], 'kutilayotgan va yangi xabarlar qoldi'
);

-- ─── Chek fayllari (BR-201) ────────────────────────────────────────────────
select is(
  jobs.purge_files() ->> 'pending',
  case when cardinality(public.receipt_files_to_delete(1)) = 0 then '0' end,
  'o''chiriladigan fayl yo''q — HTTP chaqiruv yo''q'
);

insert into public.transactions (id, household_id, kind, account_id, amount, category_id, occurred_on, budget_month)
select '01990000-0000-7000-8000-0000000000a1', (select id from ref where name = 'h_alice'), 'expense',
       (select id from ref where name = 'card'), 1000, c.id, '2026-09-10', '2026-09-01'
  from public.categories c where c.household_id = (select id from ref where name = 'h_alice') and c.name = 'Oziq-ovqat';
insert into ref values ('tx', '01990000-0000-7000-8000-0000000000a1');

-- Fayl yo'li: {byudjet}/{amal}/{fayl}.
create temporary table f (name text primary key, path text) on commit drop;
insert into f select v.name, format('%s/%s/%s.jpg', (select id from ref where name = 'h_alice'), (select id from ref where name = 'tx'), v.name)
  from unnest(array['live', 'recent_del', 'old_del', 'ancient', 'orphan_new', 'orphan_old']) as v (name);
insert into f values ('gone', '01990000-0000-7000-8000-00000000dead/x/new.jpg'), ('bad', 'not-a-household/new.jpg');

insert into storage.objects (bucket_id, name, created_at)
select 'receipts', f.path, case when f.name = 'orphan_old' then now() - interval '2 days' else now() end from f;
insert into public.attachments (household_id, transaction_id, storage_path, mime, size_bytes, deleted_at)
select (select id from ref where name = 'h_alice'), (select id from ref where name = 'tx'), f.path, 'image/jpeg', 1000,
       case f.name when 'recent_del' then now() - interval '3 days' when 'old_del' then now() - interval '10 days'
                   when 'ancient' then now() - interval '100 days' end
  from f where f.name in ('live', 'recent_del', 'old_del', 'ancient');

select is(
  (select array_agg(x order by x) from unnest(public.receipt_files_to_delete()) x where x in (select path from f)),
  (select array_agg(path order by path) from f where name in ('old_del', 'ancient', 'orphan_old', 'gone', 'bad')),
  'o''chiriladi: 7 kundan beri o''chirilgan, yozuvsiz eski, byudjeti yo''q; qoladi: tirik, yaqinda o''chirilgan, yangi yuklangan'
);
select is(cardinality(public.receipt_files_to_delete(2)), 2, 'paket chegarasi');
select ok(jobs.purge_files() ? 'request_id', 'fayl bor — purge-files chaqiriladi');

-- Tombstone tozalash biriktirmalarni ham oladi (fayl 7 kunda o'chgan bo'ladi).
insert into r select 'ancient_version', to_jsonb(row_version) from public.attachments
 where storage_path = (select path from f where name = 'ancient');
insert into r select 'purge', jobs.purge();
select results_eq(
  $$ select (v #>> '{attachments,deleted}')::int,
            (select purged_version from public.households where id = (select id from ref where name = 'h_alice'))
              >= (select (v)::bigint from r where name = 'ancient_version')
       from r where name = 'purge' $$,
  $$ values (1, true) $$,
  'biriktirma tombstone''i tozalandi, purged_version uni hisobga oladi (sinxron resync)'
);

-- ─── Oylik hisobotni hozir yuborish (E25-T06, BR-164) ──────────────────────
select tests.authenticate_as((select id from u where name = 'alice'));
insert into r select 'now', public.send_monthly_report_now((select id from ref where name = 'h_alice'), '2026-09-01');
select tests.authenticate_as((select id from u where name = 'eve'));
select throws_ok(
  $$ select public.send_monthly_report_now((select id from ref where name = 'h_alice'), '2026-09-01') $$,
  'P0001', 'forbidden', 'begona byudjet hisobotini so''rab bo''lmaydi'
);
select tests.clear_authentication();
select results_eq(
  $$ select v #>> '{report,month}', (v #>> '{report,expense}')::bigint,
            (select count(*)::int from public.monthly_reports where household_id = (select id from ref where name = 'h_alice')),
            (select count(*)::int from public.notification_outbox where type = 'monthly_report'
                and user_id = (select id from u where name = 'alice'))
       from r where name = 'now' $$,
  $$ values ('2026-09-01', 1000::bigint, 1, 1) $$,
  'hisobot arxivga saqlandi va faqat so''ragan a''zoga navbatga qo''yildi'
);

-- ─── Akkauntni o'chirish (BR-015) ──────────────────────────────────────────
insert into storage.objects (bucket_id, name)
values ('receipts', format('%s/%s/new.jpg', (select id from ref where name = 'h_bob'), gen_random_uuid()));
insert into public.transactions (household_id, kind, account_id, amount, category_id, occurred_on, budget_month, created_by)
select (select id from ref where name = 'h_alice'), 'expense', (select id from ref where name = 'card'), 2000, c.id,
       '2026-09-11', '2026-09-01', (select id from u where name = 'bob')
  from public.categories c where c.household_id = (select id from ref where name = 'h_alice') and c.name = 'Oziq-ovqat';

select tests.authenticate_as((select id from u where name = 'alice'));
select throws_ok(
  $$ select public.prepare_account_deletion() $$,
  'P0001', 'last_owner', 'BR-014: boshqa a''zolari bor byudjetning yagona egasi — avval egalikni o''tkazadi'
);
select tests.authenticate_as((select id from u where name = 'bob'));
insert into r select 'del_bob', public.prepare_account_deletion();
select tests.clear_authentication();
select results_eq(
  $$ select v -> 'deleted_households',
            (select count(*)::int from public.household_members where user_id = (select id from u where name = 'bob')),
            (select count(*)::int from public.households where id = (select id from ref where name = 'h_bob'))
       from r where name = 'del_bob' $$,
  $$ values (jsonb_build_array((select id from ref where name = 'h_bob')), 0, 0) $$,
  'yolg''iz byudjeti o''chirildi, boshqa byudjetdan chiqdi'
);

delete from auth.users where id = (select id from u where name = 'bob');
select results_eq(
  $$ select (select count(*)::int from public.transactions where household_id = (select id from ref where name = 'h_alice')
                and amount = 2000 and created_by is null),
            (select count(*)::int from unnest(public.receipt_files_to_delete()) x
              where x like (select id from ref where name = 'h_bob')::text || '/%') $$,
  $$ values (1, 1) $$,
  'auth foydalanuvchisi o''chgach: amallari qoladi (created_by = null), fayllari darhol tozalash navbatida'
);

select * from finish();
rollback;
