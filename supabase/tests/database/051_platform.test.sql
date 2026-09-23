-- E26-T03..T05: platforma admini — foydalanuvchilar ro'yxati (agregat),
-- bloklash, e'lonlar va tizim salomatligi. Qoidalar: BR-213, BR-163..166.
begin;
select plan(16);

create temporary table u (name text primary key, id uuid) on commit drop;
insert into u values
  ('root',  tests.create_user('root@test.uz')),
  ('alice', tests.create_user('alice@test.uz')),
  ('bob',   tests.create_user('bob@test.uz'));
insert into public.platform_admins (user_id) select id from u where name = 'root';
grant select on u to authenticated;

create temporary table r (name text primary key, v jsonb) on commit drop;
grant all on r to authenticated;

-- Alice Telegram'ini ulaydi va push kanalini yoqadi (standart holat).
insert into public.telegram_links (user_id, chat_id) select id, 111 from u where name = 'alice';
insert into public.device_tokens (token, user_id, platform)
  select 'alice-device-token-1', id, 'android' from u where name = 'alice';
update public.notification_prefs set telegram = true
 where user_id = (select id from u where name = 'alice');

-- ─── Huquq (BR-213) ────────────────────────────────────────────────────────
select tests.authenticate_as((select id from u where name = 'alice'));
select throws_ok(
  $$ select public.platform_users() $$,
  'P0001', 'forbidden', 'BR-213: foydalanuvchilar ro''yxati — platforma admini'
);
select throws_ok(
  $$ select public.send_announcement('{"uz": "a", "ru": "b", "en": "c"}'::jsonb) $$,
  'P0001', 'forbidden', 'BR-213: e''lon — platforma admini'
);
select tests.authenticate_as((select id from u where name = 'root'));
select throws_ok(
  $$ select public.platform_users() $$,
  'P0001', 'forbidden', 'BR-213: 2FA''siz (aal1) platforma amallari yopiq'
);
select throws_ok(
  $$ select public.platform_health() $$,
  'P0001', 'forbidden', 'BR-213: tizim salomatligi — platforma admini (aal2)'
);

select tests.authenticate_as((select id from u where name = 'root'), 'aal2');

-- ─── Foydalanuvchilar (E26-T04) ────────────────────────────────────────────
-- Qidiruv bilan: bazada boshqa testlardan qolgan foydalanuvchilar bo'lishi mumkin.
insert into r select 'users', public.platform_users('@test.uz');
select is(
  (select (v ->> 'total')::int from r where name = 'users'), 3,
  'ro''yxat va qidiruv: uch sinov foydalanuvchisi'
);
select results_eq(
  $$ select x ->> 'email', (x ->> 'households')::int, (x ->> 'blocked')::boolean, (x ->> 'is_admin')::boolean
       from r, jsonb_array_elements(v -> 'users') x
      where name = 'users' and x ->> 'email' = 'alice@test.uz' $$,
  $$ values ('alice@test.uz', 1, false, false) $$,
  'agregat: byudjetlar soni, bloklanmagan, oddiy foydalanuvchi'
);
select is(
  (select jsonb_array_length(v -> 'users')
     from (select public.platform_users('bob') as v) x), 1,
  'qidiruv: email bo''yicha'
);

-- ─── Bloklash ──────────────────────────────────────────────────────────────
select lives_ok(
  $$ select public.platform_set_blocked((select id from u where name = 'bob'), true) $$,
  'bloklash'
);
select is(
  (select (x ->> 'blocked')::boolean
     from (select public.platform_users('bob') as v) p, jsonb_array_elements(p.v -> 'users') x),
  true,
  'bloklangan foydalanuvchi ro''yxatda belgilanadi (banned_until)'
);
select throws_ok(
  $$ select public.platform_set_blocked((select id from u where name = 'root'), true) $$,
  'P0001', 'self_block', 'o''zini bloklay olmaydi'
);

-- ─── E'lon (E26-T03) ───────────────────────────────────────────────────────
-- Aniq foydalanuvchiga: bazada boshqa testlardan qolgan hisoblar bo'lishi mumkin.
insert into r select 'sent', public.send_announcement(
  '{"uz": "Yangilanish", "ru": "Обновление", "en": "Update"}'::jsonb,
  null,
  array[(select id from u where name = 'alice')]
);
select results_eq(
  $$ select (v ->> 'queued')::int, (v ->> 'users')::int from r where name = 'sent' $$,
  $$ values (2, 1) $$,
  'BR-163: faqat kanali bor foydalanuvchiga (push + telegram)'
);
-- Navbat qatorlari — egasining o'zida ko'rinadi (RLS: o'ziniki).
select tests.authenticate_as((select id from u where name = 'alice'));
select results_eq(
  $$ select o.type, o.channel, o.payload -> 'message' ->> 'uz'
       from public.notification_outbox o
      where o.type = 'announcement' order by o.channel $$,
  $$ values ('announcement', 'push', 'Yangilanish'), ('announcement', 'telegram', 'Yangilanish') $$,
  'navbatga tushgan e''lon — matni bilan'
);
select tests.authenticate_as((select id from u where name = 'root'), 'aal2');
select is(
  (select (v -> 'items' -> 0 ->> 'users')::int
     from (select public.announcement_log() as v) x), 1,
  'e''lonlar jurnali: nechta foydalanuvchiga ketgani'
);

-- ─── Tizim salomatligi (E26-T05) ───────────────────────────────────────────
insert into r select 'health', public.platform_health();
select ok(
  (select (v #>> '{stats,db_bytes}')::bigint > 0
      and (v #>> '{limits,db_bytes}')::bigint = 500 * 1024 * 1024
      and (v #>> '{limits,warn_pct}')::numeric = 70
     from r where name = 'health'),
  'baza hajmi va bepul reja chegarasi (ogohlantirish 70%)'
);
select ok(
  (select jsonb_typeof(v #> '{stats,largest_tables}') = 'array'
      and jsonb_array_length(v #> '{stats,largest_tables}') > 0
     from r where name = 'health'),
  'eng katta jadvallar ro''yxati'
);
select is(
  (select (v #>> '{outbox,pending}')::int from r where name = 'health'), 2,
  'navbatda — yuqorida yuborilgan e''lon xabarlari'
);

select * from finish();
rollback;
