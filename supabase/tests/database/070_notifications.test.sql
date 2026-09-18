-- E11-T01, T07 (BR-164): bildirishnoma sozlamalari, qurilmalar, Telegram
-- tokeni, navbat/arxiv/ishlar jurnali RLS, test xabar natijasi.
-- Qoidalar: BR-160..166, BR-163 (har a'zo o'z Telegram'i), ADR-11.
begin;
select plan(16);

-- ─── Tayyorgarlik ──────────────────────────────────────────────────────────
create temporary table u (name text primary key, id uuid) on commit drop;
insert into u values
  ('alice', tests.create_user('alice@test.uz')),
  ('bob',   tests.create_user('bob@test.uz', '{"locale": "ru"}')),
  ('eve',   tests.create_user('eve@test.uz'));
grant select on u to authenticated;

create temporary table ref (name text primary key, id uuid) on commit drop;
grant all on ref to authenticated;
insert into ref select 'h', p.last_household_id from public.profiles p
  where p.user_id = (select id from u where name = 'alice');

create temporary table r (name text primary key, v jsonb) on commit drop;
grant all on r to authenticated;

select tests.authenticate_as((select id from u where name = 'alice'));
create temporary table inv (code text) on commit drop;
grant all on inv to authenticated;
insert into inv select code from public.create_invite((select id from ref where name = 'h'), 'member');
select tests.authenticate_as((select id from u where name = 'bob'));
select public.accept_invite((select code from inv));
select tests.clear_authentication();

-- ─── Sozlamalar (T01) ──────────────────────────────────────────────────────
select results_eq(
  $$ select push, telegram, email, reminder_hour::int, days_ahead::int, monthly_report, report_day::int,
            limit_alerts, income_missing
       from public.notification_prefs
      where user_id = (select id from u where name = 'alice') and household_id = (select id from ref where name = 'h') $$,
  $$ values (true, false, false, 9, 3, true, 21, true, true) $$,
  'standart: push, soat 9, 3 kun, oylik hisobot 21-kun, limit va daromad ogohlantirishi'
);
select is(
  (select count(*)::int from public.notification_prefs where user_id = (select id from u where name = 'bob')),
  2, 'a''zolik bilan sozlama ham yaratiladi (shaxsiy byudjet + taklif qilingan)'
);

select tests.authenticate_as((select id from u where name = 'alice'));
update public.notification_prefs set reminder_hour = 20, telegram = true
 where household_id = (select id from ref where name = 'h');
select tests.clear_authentication();
select results_eq(
  $$ select u.name, np.reminder_hour::int from public.notification_prefs np join u on u.id = np.user_id
      where np.household_id = (select id from ref where name = 'h') order by u.name $$,
  $$ values ('alice', 20), ('bob', 9) $$,
  'RLS: faqat o''z sozlamasi o''zgaradi (boshqa a''zoniki ko''rinmaydi)'
);
select tests.authenticate_as((select id from u where name = 'alice'));
select throws_ok(
  $$ update public.notification_prefs set user_id = (select id from u where name = 'bob') $$,
  '42501', null, 'egasi/byudjeti o''zgarmaydi (ustun huquqi yo''q)'
);
select throws_ok(
  $$ update public.notification_prefs set reminder_hour = 24 $$,
  '23514', null, 'soat 0–23 oralig''ida'
);

-- ─── Qurilmalar ────────────────────────────────────────────────────────────
select public.register_device('fcm-token-shared-0001', 'android', '1.0.0');
select tests.authenticate_as((select id from u where name = 'bob'));
select public.register_device('fcm-token-shared-0001', 'android', '1.0.1');
select tests.authenticate_as((select id from u where name = 'alice'));
select public.unregister_device('fcm-token-shared-0001');
select is(
  (select count(*)::int from public.device_tokens),
  0, 'qurilmada akkaunt almashsa token yangi egaga o''tadi; eski ega ko''rmaydi va o''chira olmaydi'
);
select tests.clear_authentication();
select is(
  (select u.name from public.device_tokens d join u on u.id = d.user_id where d.token = 'fcm-token-shared-0001'),
  'bob', 'token bob''da qoldi'
);
select tests.authenticate_as_anon();
select throws_ok(
  $$ select public.register_device('fcm-token-anon-00001', 'android') $$,
  '42501', null, 'anonim qurilma ro''yxatdan o''tkaza olmaydi'
);
select tests.clear_authentication();

-- ─── Telegram ulash tokeni (BR-163) ────────────────────────────────────────
select tests.authenticate_as((select id from u where name = 'alice'));
insert into r select 'tg', public.telegram_link_token();
select ok(
  (select v ->> 'token' ~ '^[A-Za-z0-9_-]{32}$'
          and (v ->> 'expires_at')::timestamptz between now() + interval '14 minutes' and now() + interval '16 minutes'
     from r where name = 'tg'),
  'bir martalik token: 32 belgi (URL uchun xavfsiz), 15 daqiqa'
);
select throws_ok(
  $$ select * from public.telegram_link_tokens $$,
  '42501', null, 'tokenlar jadvali klientga yopiq'
);
select tests.clear_authentication();

-- ─── Navbat, arxiv, ishlar jurnali — RLS ───────────────────────────────────
insert into public.notification_outbox (user_id, household_id, channel, type, dedupe_key)
select u.id, (select id from ref where name = 'h'), 'push', 'test', 'rls:' || u.name from u;
insert into public.monthly_reports (household_id, month, payload)
values ((select id from ref where name = 'h'), '2026-09-01', '{}');
insert into public.job_runs (job) values ('daily_sweep');

select tests.authenticate_as((select id from u where name = 'alice'));
select results_eq(
  $$ select (select count(*)::int from public.notification_outbox), (select count(*)::int from public.monthly_reports),
            (select count(*)::int from public.job_runs) $$,
  $$ values (1, 1, 0) $$,
  'jurnal — faqat o''ziniki; hisobot arxivi — byudjet a''zolariga; ishlar jurnali — faqat platforma adminiga'
);
select throws_ok(
  $$ insert into public.notification_outbox (user_id, channel, type, dedupe_key)
     values ((select id from u where name = 'alice'), 'push', 'test', 'hack') $$,
  '42501', null, 'klient navbatga yozolmaydi'
);
select tests.authenticate_as((select id from u where name = 'eve'));
select is((select count(*)::int from public.monthly_reports), 0, 'begona byudjet hisoboti ko''rinmaydi');

-- ─── Test xabar (BR-164): natija aniq ──────────────────────────────────────
select tests.authenticate_as((select id from u where name = 'alice'));
insert into r select 'test1', public.test_notification((select id from ref where name = 'h'));
select results_eq(
  $$ select c ->> 'channel', (c ->> 'queued')::boolean, c ->> 'reason'
       from r, jsonb_array_elements(r.v) c where r.name = 'test1' $$,
  $$ values ('push', false, 'no_device'), ('telegram', false, 'not_linked'), ('email', false, 'not_configured') $$,
  'BR-164: har kanal — nega yuborilmadi (qurilma yo''q / ulanmagan / sozlanmagan)'
);

select public.register_device('fcm-token-alice-0001', 'android');
update public.notification_prefs set push = false
 where household_id = (select id from ref where name = 'h');
insert into r select 'test2', public.test_notification((select id from ref where name = 'h'));
update public.notification_prefs set push = true
 where household_id = (select id from ref where name = 'h');
insert into r select 'test3', public.test_notification((select id from ref where name = 'h'));
select results_eq(
  $$ select r.name, c ->> 'channel', (c ->> 'queued')::boolean, c ->> 'reason'
       from r, jsonb_array_elements(r.v) c where r.name in ('test2', 'test3') and c ->> 'channel' = 'push'
      order by r.name $$,
  $$ values ('test2', 'push', false, 'disabled'), ('test3', 'push', true, null) $$,
  'o''chirilgan kanal — "disabled"; qurilma va yoqilgan — navbatga'
);
select tests.clear_authentication();
select results_eq(
  $$ select channel, type, payload ->> 'locale' from public.notification_outbox
      where user_id = (select id from u where name = 'alice') and type = 'test' and dedupe_key like 'test:%' $$,
  $$ values ('push', 'test', 'uz') $$,
  'navbatda bitta test xabar (faqat yetkaziladigan kanal), foydalanuvchi tilida'
);

select * from finish();
rollback;
