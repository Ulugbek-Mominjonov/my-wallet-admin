-- E11-T04, T05, T08 (server qismi): navbatdan olish/natija, Telegram ulash
-- va buyruqlar, valyuta kurslari; E29-T01: kurslarni tarixiy to'ldirish.
-- Qoidalar: BR-163, BR-166, BR-192, BR-221, ADR-11.
begin;
select plan(19);

-- ─── Tayyorgarlik ──────────────────────────────────────────────────────────
create temporary table u (name text primary key, id uuid) on commit drop;
insert into u values
  ('alice', tests.create_user('alice@test.uz')),
  ('bob',   tests.create_user('bob@test.uz', '{"locale": "ru"}'));
grant select on u to authenticated;

create temporary table ref (name text primary key, id uuid) on commit drop;
grant all on ref to authenticated;
insert into ref select 'h', p.last_household_id from public.profiles p
  where p.user_id = (select id from u where name = 'alice');

create temporary table r (name text primary key, v jsonb) on commit drop;
grant all on r to authenticated, service_role;

-- Telegram tokenlari (ilova oladi) va qurilmalar.
select tests.authenticate_as((select id from u where name = 'alice'));
select public.register_device('fcm-token-alice-0001', 'android');
select public.register_device('fcm-token-alice-0002', 'android');
insert into r select 'tok_a1', public.telegram_link_token();
insert into r select 'tok_a2', public.telegram_link_token();
select tests.authenticate_as((select id from u where name = 'bob'));
insert into r select 'tok_b1', public.telegram_link_token();
insert into r select 'tok_b2', public.telegram_link_token();
select tests.clear_authentication();

-- Edge Function (service kaliti) sharoiti; qaytish — `reset role`.
create function pg_temp.as_service() returns void language sql as $$
  select set_config('request.jwt.claims', '{"role": "service_role"}', true);
  select set_config('role', 'service_role', true);
$$;

-- ─── Huquqlar ──────────────────────────────────────────────────────────────
select ok(
  (select bool_and(not has_function_privilege('authenticated', f, 'execute')
                   and not has_function_privilege('anon', f, 'execute')
                   and has_function_privilege('service_role', f, 'execute'))
     from unnest(array[
       'public.outbox_claim(integer)', 'public.outbox_complete(jsonb, text[])',
       'public.telegram_link_consume(text, bigint)', 'public.telegram_unlink_chat(bigint)',
       'public.telegram_summary(bigint)', 'public.fx_upsert(jsonb)',
       'public.receipt_files_to_delete(integer, timestamptz)'
     ]::regprocedure[]) f),
  'navbat, Telegram, kurs va fayl RPC''lari — faqat service_role (Edge Function)'
);

-- ─── Telegram ulash (BR-163) ───────────────────────────────────────────────
select pg_temp.as_service();
insert into r select 'c_bob', public.telegram_link_consume((select v ->> 'token' from r where name = 'tok_b1'), 555);
insert into r select 'c_alice', public.telegram_link_consume((select v ->> 'token' from r where name = 'tok_a1'), 777);
insert into r select 'c_used', public.telegram_link_consume((select v ->> 'token' from r where name = 'tok_a1'), 777);
insert into r select 'c_invalid', public.telegram_link_consume(repeat('x', 32), 777);
reset role;
update public.telegram_link_tokens set expires_at = now() - interval '1 second'
 where token = (select v ->> 'token' from r where name = 'tok_a2');
select pg_temp.as_service();
insert into r select 'c_expired', public.telegram_link_consume((select v ->> 'token' from r where name = 'tok_a2'), 777);
reset role;
select results_eq(
  $$ select name, v from r where name like 'c\_%' order by name $$,
  $$ values ('c_alice', '{"ok": true, "locale": "uz"}'::jsonb), ('c_bob', '{"ok": true, "locale": "ru"}'),
            ('c_expired', '{"ok": false, "code": "token_expired"}'), ('c_invalid', '{"ok": false, "code": "token_invalid"}'),
            ('c_used', '{"ok": false, "code": "token_used"}') $$,
  'bir martalik token: ulandi (foydalanuvchi tilida) / ishlatilgan / noto''g''ri / muddati o''tgan'
);
select is(
  (select bool_and(telegram) from public.notification_prefs where user_id = (select id from u where name = 'alice')),
  true, 'ulangan kanal yoqiladi'
);

-- bob o'z chatini alice ishlatgan chatga ko'chiradi: chat yangi egaga o'tadi.
select pg_temp.as_service();
select public.telegram_link_consume((select v ->> 'token' from r where name = 'tok_b2'), 777);
reset role;
select results_eq(
  $$ select u.name, l.chat_id from public.telegram_links l join u on u.id = l.user_id order by u.name $$,
  $$ values ('bob', 777::bigint) $$,
  'bitta chat — bitta akkaunt; akkaunt chatini almashtirsa eskisi bo''shaydi'
);

-- ─── /balans, /bugun (BR-221) ──────────────────────────────────────────────
insert into public.telegram_links (user_id, chat_id) values ((select id from u where name = 'alice'), 888);
select set_config('app.today', '2026-10-05', true);
insert into public.planned_items (household_id, kind, name, category_id, planned_amount, due_date, budget_month)
select (select id from ref where name = 'h'), v.kind::public.plan_kind, v.name, c.id, v.amount, v.due, '2026-10-01'
  from (values ('expense', 'Internet', 'Internet/Aloqa', 15000000::bigint, '2026-10-03'::date),
               ('expense', 'Ijara', 'Ijara', 300000000, '2026-10-10'),
               ('income', 'Oylik', 'Oylik', 800000000, '2026-10-01')) as v (kind, name, cat, amount, due)
  join public.categories c on c.household_id = (select id from ref where name = 'h') and c.name = v.cat;
select pg_temp.as_service();
insert into r select 'sum', public.telegram_summary(888);
insert into r select 'sum_none', coalesce(public.telegram_summary(999), 'null');
reset role;
select results_eq(
  $$ select v ->> 'locale', v ->> 'month', v -> 'today', jsonb_typeof(v -> 'forecast') from r where name = 'sum' $$,
  $$ values ('uz', '2026-10-01', '[{"name": "Internet", "amount": 15000000, "due_date": "2026-10-03"}]'::jsonb, 'number') $$,
  '/bugun: bugungacha to''lanmagan to''lovlar (daromadsiz); /balans — joriy oy'
);
select is((select v from r where name = 'sum_none'), 'null'::jsonb, 'ulanmagan chat — ma''lumot yo''q');

select pg_temp.as_service();
insert into r select 'unlink1', to_jsonb(public.telegram_unlink_chat(888));
insert into r select 'unlink2', to_jsonb(public.telegram_unlink_chat(888));
reset role;
select results_eq(
  $$ select v from r where name like 'unlink%' order by name $$,
  $$ values ('true'::jsonb), ('false') $$,
  '/stop: uzildi; qayta — o''zgarish yo''q'
);

-- ─── Navbatdan olish (ADR-11) ──────────────────────────────────────────────
insert into public.notification_outbox (user_id, household_id, channel, type, payload, dedupe_key, status, next_attempt_at)
select (select id from u where name = v.who), (select id from ref where name = 'h'), v.channel, 'test', '{}',
       v.key, v.status, now() + v.delay
  from (values ('alice', 'push', 'q1', 'pending', interval '0'), ('bob', 'telegram', 'q2', 'pending', interval '0'),
               ('alice', 'email', 'q3', 'pending', interval '0'), ('alice', 'push', 'q4', 'pending', interval '1 hour'),
               ('alice', 'push', 'q5', 'sent', interval '0')) as v (who, channel, key, status, delay);
-- Bazadagi boshqa (commit qilingan) xabarlar bu testda olinmasin.
update public.notification_outbox set next_attempt_at = now() + interval '1 day'
 where status = 'pending' and dedupe_key not like 'q_';
create temporary table q (key text primary key, id bigint) on commit drop;
grant all on q to service_role;
insert into q select dedupe_key, id from public.notification_outbox where dedupe_key like 'q_';

select tests.authenticate_as((select id from u where name = 'alice'));
select throws_ok($$ select public.outbox_claim() $$, '42501', null, 'klient navbatdan ololmaydi');
select tests.clear_authentication();

select pg_temp.as_service();
insert into r select 'claim1', public.outbox_claim(10);
insert into r select 'claim2', public.outbox_claim(10);
reset role;
select results_eq(
  $$ select c ->> 'channel', c ->> 'locale', c -> 'tokens', (c ->> 'chat_id')::bigint, c ->> 'email'
       from r, jsonb_array_elements(r.v) c where r.name = 'claim1' order by (c ->> 'id')::bigint $$,
  $$ values ('push', 'uz', '["fcm-token-alice-0001", "fcm-token-alice-0002"]'::jsonb, null::bigint, null),
            ('telegram', 'ru', 'null', 777, null), ('email', 'uz', 'null', null, 'alice@test.uz') $$,
  'navbatdagi (vaqti kelgan) xabarlar manzillari va tili bilan'
);
select results_eq(
  $$ select o.dedupe_key, o.status, o.attempts::int from public.notification_outbox o where o.dedupe_key like 'q_' order by 1 $$,
  $$ values ('q1', 'sending', 1), ('q2', 'sending', 1), ('q3', 'sending', 1), ('q4', 'pending', 0), ('q5', 'sent', 0) $$,
  'olinganlar — "sending", urinish +1; kelajakdagi va yuborilgan — tegilmaydi'
);
select is((select v from r where name = 'claim2'), '[]'::jsonb, 'qayta olishda ikkinchi marta berilmaydi');

-- ─── Natija (BR-166) ───────────────────────────────────────────────────────
select pg_temp.as_service();
select public.outbox_complete(
  jsonb_build_array(
    jsonb_build_object('id', (select id from q where key = 'q1'), 'status', 'sent'),
    jsonb_build_object('id', (select id from q where key = 'q2'), 'status', 'failed', 'retry', true, 'error', 'Telegram 429'),
    jsonb_build_object('id', (select id from q where key = 'q3'), 'status', 'skipped', 'error', 'email_not_supported'),
    jsonb_build_object('id', (select id from q where key = 'q5'), 'status', 'failed', 'error', 'late')
  ),
  array['fcm-token-alice-0002']);
reset role;
select results_eq(
  $$ select o.dedupe_key, o.status, o.sent_at is not null, o.error,
            o.next_attempt_at between now() + interval '4 minutes' and now() + interval '6 minutes'
       from public.notification_outbox o where o.dedupe_key in ('q1', 'q2', 'q3', 'q5') order by 1 $$,
  $$ values ('q1', 'sent', true, null, false), ('q2', 'pending', false, 'Telegram 429', true),
            ('q3', 'skipped', false, 'email_not_supported', false), ('q5', 'sent', false, null, false) $$,
  'yuborildi / 5 daqiqadan keyin qayta / o''tkazildi (sababi bilan); yakunlangan xabar o''zgarmaydi'
);
select results_eq(
  $$ select token from public.device_tokens where user_id = (select id from u where name = 'alice') $$,
  $$ values ('fcm-token-alice-0001') $$,
  'eskirgan FCM token o''chirildi'
);

update public.notification_outbox set status = 'sending', attempts = 3 where id = (select id from q where key = 'q2');
select pg_temp.as_service();
select public.outbox_complete(
  jsonb_build_array(jsonb_build_object('id', (select id from q where key = 'q2'), 'status', 'failed', 'retry', true, 'error', 'Telegram 502')));
reset role;
select is(
  (select status from public.notification_outbox where id = (select id from q where key = 'q2')),
  'failed', '3 urinishdan keyin — failed'
);

-- ─── Valyuta kurslari (BR-192) ─────────────────────────────────────────────
insert into public.exchange_rates (currency, rate_date, rate_to_base, source)
values ('EUR', '2026-09-18', 14000, 'manual');
select pg_temp.as_service();
insert into r select 'fx1', to_jsonb(public.fx_upsert(
  '[{"currency": "USD", "rate_date": "2026-09-18", "rate_to_base": 12650.55},
    {"currency": "EUR", "rate_date": "2026-09-18", "rate_to_base": 14780.1},
    {"currency": "GBP", "rate_date": "2026-09-18", "rate_to_base": 17000}]'));
insert into r select 'fx2', to_jsonb(public.fx_upsert(
  '[{"currency": "USD", "rate_date": "2026-09-18", "rate_to_base": 12651}]'));
reset role;
select results_eq(
  $$ select currency, rate_to_base, source from public.exchange_rates where rate_date = '2026-09-18' order by 1 $$,
  $$ values ('EUR', 14000::numeric, 'manual'), ('USD', 12651::numeric, 'CBU') $$,
  'CBU kursi yoziladi/yangilanadi; qo''lda kiritilgan tuzatish ustidan yozilmaydi; spravochnikda yo''q valyuta — yo''q'
);

-- ─── Tarixiy to'ldirish (E29-T01) ──────────────────────────────────────────
select tests.authenticate_as((select id from u where name = 'alice'));
select throws_ok(
  $$ select public.fx_backfill_dates() $$,
  '42501', null, 'BR-213: to''ldirish RPC''si faqat serverga (service_role)'
);
select tests.clear_authentication();

select pg_temp.as_service();
-- Yozuv yo'q: to'ldiradigan sana ham yo'q.
select results_eq(
  $$ select (public.fx_backfill_dates() ->> 'done')::boolean,
            jsonb_array_length(public.fx_backfill_dates() -> 'dates') $$,
  $$ values (true, 0) $$,
  'yozuvsiz byudjetda kurs kerak emas'
);
reset role;

-- Alice'ning eng eski amali — 2026-09-14 (juma).
insert into public.transactions (household_id, kind, account_id, amount, category_id,
                                 occurred_on, budget_month)
select (select id from ref where name = 'h'), 'expense',
       (select a.id from public.accounts a where a.household_id = (select id from ref where name = 'h')
         and a.type = 'cash' limit 1),
       100000,
       (select c.id from public.categories c where c.household_id = (select id from ref where name = 'h')
         and c.kind = 'expense' limit 1),
       '2026-09-14', '2026-09-01';

select pg_temp.as_service();
-- Kursor qo'lda qo'yiladi: natija "bugun" ga bog'liq bo'lmasin.
select public.fx_backfill_mark('2026-09-18');
insert into r select 'bf1', public.fx_backfill_dates(5);
select results_eq(
  $$ select x #>> '{}' from r, jsonb_array_elements(v -> 'dates') x where name = 'bf1' $$,
  $$ values ('2026-09-17'), ('2026-09-16'), ('2026-09-15'), ('2026-09-14') $$,
  'kursordan orqaga: ish kunlari, kursi bor sana (18-sentabr) tashlanadi'
);
select public.fx_backfill_mark('2026-09-15');
select is(
  (select jsonb_array_length(public.fx_backfill_dates(5) -> 'dates')), 1,
  'kursor surilgach faqat undan eski sanalar qoladi'
);
reset role;

select * from finish();
rollback;
