-- E11-T01: bildirishnoma jadvallari — sozlamalar, qurilmalar, Telegram,
-- navbat (outbox), oylik hisobotlar arxivi, rejali ishlar jurnali.
-- Qoidalar: BR-160..168, BR-163 (har foydalanuvchi o'z Telegram'i); ADR-11.

-- ─── Sozlamalar (har a'zo × byudjet) ───────────────────────────────────────
create table public.notification_prefs (
  user_id        uuid not null references auth.users (id) on delete cascade,
  household_id   uuid not null references public.households (id) on delete cascade,
  push           boolean not null default true,
  telegram       boolean not null default false,
  email          boolean not null default false,
  -- BR-160: kunlik eslatma soati (byudjet vaqt zonasida) va necha kun oldin.
  reminder_hour  smallint not null default 9 check (reminder_hour between 0 and 23),
  days_ahead     smallint not null default 3 check (days_ahead between 0 and 14),
  -- BR-161: oylik hisobot kuni (1–28 — har oyda bor).
  monthly_report boolean not null default true,
  report_day     smallint not null default 21 check (report_day between 1 and 28),
  -- BR-133, BR-165.
  limit_alerts   boolean not null default true,
  income_missing boolean not null default true,
  updated_at     timestamptz not null default now(),
  primary key (user_id, household_id)
);

comment on table public.notification_prefs is 'BR-160..165: har a''zoning bildirishnoma sozlamalari (a''zolik bilan yaratiladi).';

create index notification_prefs_household_idx on public.notification_prefs (household_id);

create trigger notification_prefs_touch before update on public.notification_prefs
  for each row execute function private.touch_updated_at();

-- A'zolik bilan birga standart sozlamalar (ish so'rovlari oddiy JOIN bo'lsin).
create or replace function private.create_notification_prefs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notification_prefs (user_id, household_id)
  values (new.user_id, new.household_id)
  on conflict do nothing;
  return null;
end;
$$;

create trigger household_members_prefs after insert on public.household_members
  for each row execute function private.create_notification_prefs();

insert into public.notification_prefs (user_id, household_id)
select m.user_id, m.household_id from public.household_members m
on conflict do nothing;

-- ─── Qurilmalar (FCM tokenlari) ────────────────────────────────────────────
create table public.device_tokens (
  token        text primary key check (char_length(token) between 10 and 4096),
  user_id      uuid not null references auth.users (id) on delete cascade,
  platform     text not null check (platform in ('android', 'ios', 'web')),
  app_version  text check (char_length(app_version) <= 32),
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index device_tokens_user_idx on public.device_tokens (user_id);

-- ─── Telegram (BR-163) ─────────────────────────────────────────────────────
create table public.telegram_links (
  user_id   uuid primary key references auth.users (id) on delete cascade,
  chat_id   bigint not null unique,
  linked_at timestamptz not null default now()
);

-- Bir martalik ulash tokeni: t.me/<bot>?start=<token>.
create table public.telegram_link_tokens (
  token      text primary key check (token ~ '^[A-Za-z0-9_-]{32}$'),
  user_id    uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null,
  used_at    timestamptz
);

create index telegram_link_tokens_user_idx on public.telegram_link_tokens (user_id);

-- ─── Navbat (ADR-11, BR-166) ───────────────────────────────────────────────
-- Har qator — bitta foydalanuvchiga bitta kanal orqali bitta xabar.
-- dedupe_key — bir xil xabar ikki marta yuborilmaydi.
create table public.notification_outbox (
  id              bigint generated always as identity primary key,
  user_id         uuid not null references auth.users (id) on delete cascade,
  household_id    uuid references public.households (id) on delete cascade,
  channel         text not null check (channel in ('push', 'telegram', 'email')),
  type            text not null check (type in ('daily_reminder', 'monthly_report', 'limit_alert',
                                                'income_missing', 'test', 'announcement')),
  payload         jsonb not null default '{}',
  dedupe_key      text not null unique,
  status          text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed', 'skipped')),
  attempts        smallint not null default 0,
  next_attempt_at timestamptz not null default now(),
  sent_at         timestamptz,
  error           text,
  created_at      timestamptz not null default now()
);

comment on table public.notification_outbox is 'ADR-11: bildirishnomalar navbati — notify-dispatch yuboradi; jurnal (BR-166), 90 kun.';

-- Dispatch: navbatdagi xabarlar.
create index notification_outbox_pending_idx on public.notification_outbox (next_attempt_at)
  where status = 'pending';
-- Foydalanuvchi jurnali (BR-164, BR-166) va tozalash.
create index notification_outbox_user_idx on public.notification_outbox (user_id, created_at desc);
create index notification_outbox_created_idx on public.notification_outbox (created_at);

-- ─── Oylik hisobotlar arxivi (BR-167) ──────────────────────────────────────
create table public.monthly_reports (
  household_id uuid not null references public.households (id) on delete cascade,
  month        public.month_start not null,
  payload      jsonb not null,
  generated_at timestamptz not null default now(),
  primary key (household_id, month)
);

-- ─── Rejali ishlar jurnali (ARXITEKTURA 7) ─────────────────────────────────
create table public.job_runs (
  id          bigint generated always as identity primary key,
  job         text not null,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  status      text not null default 'running' check (status in ('running', 'ok', 'failed')),
  details     jsonb
);

create index job_runs_job_idx on public.job_runs (job, started_at desc);

-- ─── RLS va huquqlar ───────────────────────────────────────────────────────
alter table public.notification_prefs enable row level security;
alter table public.device_tokens enable row level security;
alter table public.telegram_links enable row level security;
alter table public.telegram_link_tokens enable row level security;
alter table public.notification_outbox enable row level security;
alter table public.monthly_reports enable row level security;
alter table public.job_runs enable row level security;

-- Sozlamalar — faqat o'ziniki (a'zo bo'lgan byudjetda).
create policy notification_prefs_select on public.notification_prefs for select to authenticated
  using (user_id = (select auth.uid()));
create policy notification_prefs_update on public.notification_prefs for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Qurilmalar va Telegram — o'ziniki (yozish RPC orqali).
create policy device_tokens_select on public.device_tokens for select to authenticated
  using (user_id = (select auth.uid()));
create policy telegram_links_select on public.telegram_links for select to authenticated
  using (user_id = (select auth.uid()));

-- Yuborish jurnali — o'ziniki (BR-164, BR-166).
create policy notification_outbox_select on public.notification_outbox for select to authenticated
  using (user_id = (select auth.uid()));

-- Oylik hisobotlar arxivi — byudjet a'zolari (BR-167).
create policy monthly_reports_select on public.monthly_reports for select to authenticated
  using (household_id in (select private.my_household_ids()));

-- Rejali ishlar — platforma adminlari (E26-T05).
create policy job_runs_select on public.job_runs for select to authenticated
  using ((select private.is_platform_admin()));

revoke all on public.notification_prefs, public.device_tokens, public.telegram_links,
  public.telegram_link_tokens, public.notification_outbox, public.monthly_reports, public.job_runs
  from authenticated;
grant select on public.notification_prefs, public.device_tokens, public.telegram_links,
  public.notification_outbox, public.monthly_reports, public.job_runs
  to authenticated;
grant update (push, telegram, email, reminder_hour, days_ahead, monthly_report, report_day, limit_alerts, income_missing)
  on public.notification_prefs to authenticated;

-- ─── Qurilma va Telegram RPC'lari ──────────────────────────────────────────
-- Token boshqa akkauntda bo'lgan bo'lsa (qurilmada akkaunt almashgan) — ko'chadi.
create or replace function public.register_device(p_token text, p_platform text, p_app_version text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'unauthorized' using errcode = 'P0001';
  end if;
  insert into public.device_tokens (token, user_id, platform, app_version)
  values (p_token, (select auth.uid()), p_platform, p_app_version)
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform,
        app_version = excluded.app_version, last_seen_at = now();
end;
$$;

create or replace function public.unregister_device(p_token text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.device_tokens where token = p_token and user_id = (select auth.uid())
$$;

-- Telegram ulash tokeni muddati.
create or replace function private.telegram_token_ttl()
returns interval language sql immutable set search_path = '' as $$ select interval '15 minutes' $$;

-- BR-163: bir martalik havola uchun token (bot /start <token> bilan iste'mol qiladi).
create or replace function public.telegram_link_token()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text := translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/', '-_');
  v_expires timestamptz := now() + private.telegram_token_ttl();
begin
  if (select auth.uid()) is null then
    raise exception 'unauthorized' using errcode = 'P0001';
  end if;
  insert into public.telegram_link_tokens (token, user_id, expires_at)
  values (v_token, (select auth.uid()), v_expires);
  return jsonb_build_object('token', v_token, 'expires_at', v_expires);
end;
$$;

create or replace function public.telegram_unlink()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.telegram_links where user_id = (select auth.uid())
$$;

grant execute on function
  public.register_device(text, text, text),
  public.unregister_device(text),
  public.telegram_link_token(),
  public.telegram_unlink()
to authenticated;
