-- E05-T01..T03: byudjet (household), a'zolar, rollar, takliflar va RLS.
-- Qoidalar: BR-010..015, BR-210, BR-213; ADR-04.

-- ─── Tiplar va yordamchilar ────────────────────────────────────────────────
create type public.member_role as enum ('owner', 'admin', 'member', 'viewer');

create type public.personal_fund_mode as enum ('percent', 'fixed');

-- IANA vaqt zonasi haqiqiymi (CHECK uchun; pg_timezone_names amalda o'zgarmaydi).
create or replace function private.is_valid_timezone(p_timezone text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone)
$$;

-- ─── Byudjet (tenant) ──────────────────────────────────────────────────────
create table public.households (
  id                               uuid primary key default private.uuid_v7(),
  name                             text not null check (char_length(btrim(name)) between 1 and 80),
  base_currency                    text not null default 'UZS' check (base_currency ~ '^[A-Z]{3}$'),
  timezone                         text not null default 'Asia/Tashkent'
                                   check (private.is_valid_timezone(timezone)),
  -- 👤 Shaxsiy fond qoidasi (BR-060): foiz yoki qat'iy summa (eng kichik birlikda).
  personal_fund_mode               public.personal_fund_mode not null default 'percent',
  personal_fund_percent            numeric(5, 2) not null default 10
                                   check (personal_fund_percent between 0 and 100),
  personal_fund_fixed_amount       bigint not null default 0 check (personal_fund_fixed_amount >= 0),
  personal_fund_day                smallint not null default 5 check (personal_fund_day between 1 and 31),
  personal_fund_source_account_id  uuid, -- FK — E06 (accounts)
  -- Oy siyosati (BR-084, BR-055).
  auto_open_month                  boolean not null default true,
  strict_month_lock                boolean not null default false,
  created_by                       uuid references auth.users (id) on delete set null,
  created_at                       timestamptz not null default now(),
  updated_at                       timestamptz not null default now(),
  row_version                      bigint not null default 0
);

comment on table public.households is 'BR-010: byudjet — barcha ma''lumotlar egasi (tenant).';

-- ─── Profil ────────────────────────────────────────────────────────────────
create table public.profiles (
  user_id           uuid primary key references auth.users (id) on delete cascade,
  display_name      text not null default '' check (char_length(display_name) <= 100),
  locale            text not null default 'uz' check (locale in ('uz', 'ru', 'en')),
  last_household_id uuid references public.households (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.profiles is 'Foydalanuvchi profili (auth.users bilan 1:1).';

create trigger profiles_touch before update on public.profiles
  for each row execute function private.touch_updated_at();

-- Byudjet qatorida household_id o'rniga id — shuning uchun alohida trigger
-- (private.touch_synced_row bilan bir xil kafolat: advisory lock + row_version).
create or replace function private.touch_household_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(private.sync_lock_namespace(), hashtext(new.id::text));
  new.row_version := nextval('private.sync_seq');
  new.updated_at := now();
  return new;
end;
$$;

create trigger households_touch before insert or update on public.households
  for each row execute function private.touch_household_row();
create trigger households_audit after insert or update or delete on public.households
  for each row execute function private.audit();

-- ─── A'zolar ───────────────────────────────────────────────────────────────
create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  role         public.member_role not null default 'member',
  joined_at    timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (household_id, user_id)
);

comment on table public.household_members is 'BR-011: a''zolik va rol.';

-- RLS a'zolik tekshiruvi foydalanuvchi bo'yicha qidiradi.
create index household_members_user_idx on public.household_members (user_id);

create trigger household_members_touch before update on public.household_members
  for each row execute function private.touch_updated_at();
create trigger household_members_audit after insert or update or delete on public.household_members
  for each row execute function private.audit();

-- BR-014: byudjetning oxirgi owner'i o'chirilmaydi va roli tushirilmaydi.
-- Byudjetning o'zi o'chirilayotganda (cascade) tekshiruv o'tkazib yuboriladi.
create or replace function private.protect_last_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.role <> 'owner' or (tg_op = 'UPDATE' and new.role = 'owner') then
    return coalesce(new, old);
  end if;
  if not exists (select 1 from public.households h where h.id = old.household_id) then
    return coalesce(new, old);
  end if;
  if not exists (
    select 1 from public.household_members m
     where m.household_id = old.household_id
       and m.role = 'owner'
       and m.user_id <> old.user_id
  ) then
    raise exception 'last_owner' using
      errcode = 'P0001',
      hint = 'Byudjetning oxirgi egasi: avval egalikni boshqa a''zoga o''tkazing.';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger household_members_last_owner before update or delete on public.household_members
  for each row execute function private.protect_last_owner();

-- ─── Takliflar ─────────────────────────────────────────────────────────────
create table public.household_invites (
  id           uuid primary key default private.uuid_v7(),
  household_id uuid not null references public.households (id) on delete cascade,
  -- 8 belgi, adashtiradigan belgilarsiz (0/O, 1/I yo'q) — BR-012.
  code         text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  role         public.member_role not null default 'member' check (role <> 'owner'),
  created_by   uuid references auth.users (id) on delete set null,
  expires_at   timestamptz not null default now() + interval '7 days',
  accepted_by  uuid references auth.users (id) on delete set null,
  accepted_at  timestamptz,
  created_at   timestamptz not null default now()
);

create index household_invites_household_idx on public.household_invites (household_id, created_at desc);

-- ─── Platforma ─────────────────────────────────────────────────────────────
create table public.platform_admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.platform_admins is 'BR-213: super-admin; amallari uchun 2FA (aal2) majburiy.';

create table public.app_config (
  key        text primary key check (key ~ '^[a-z][a-z0-9_]{1,63}$'),
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

comment on table public.app_config is 'Ilova sozlamalari: min versiyalar, texnik ishlar banneri, flaglar (BR-214).';

create trigger app_config_touch before update on public.app_config
  for each row execute function private.touch_updated_at();

insert into public.app_config (key, value) values
  ('min_android_version', '"0.1.0"'),
  ('maintenance', 'null');

-- ─── RLS yordamchilari (E05-T02) ───────────────────────────────────────────
-- Siyosatlarda `x in (select private.my_household_ids())` ko'rinishida —
-- funksiya so'rovga bir marta (initPlan) baholanadi, har qatorda emas.
create or replace function private.my_household_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.household_id from public.household_members m where m.user_id = (select auth.uid())
$$;

create or replace function private.my_writable_household_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.household_id from public.household_members m
   where m.user_id = (select auth.uid()) and m.role in ('owner', 'admin', 'member')
$$;

create or replace function private.my_admin_household_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.household_id from public.household_members m
   where m.user_id = (select auth.uid()) and m.role in ('owner', 'admin')
$$;

-- BR-213: platforma admini VA sessiya 2FA bilan tasdiqlangan (aal2).
create or replace function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.platform_admins a where a.user_id = (select auth.uid()))
     and coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2'
$$;

grant execute on function
  private.my_household_ids(),
  private.my_writable_household_ids(),
  private.my_admin_household_ids(),
  private.is_platform_admin(),
  private.is_valid_timezone(text)
to authenticated;

-- ─── RLS siyosatlari (E05-T03) ─────────────────────────────────────────────
-- Yozuvlar (byudjet yaratish, a'zolik, takliflar) faqat RPC orqali (E05-T05):
-- invariantlar (oxirgi owner, bir martalik taklif) bitta joyda.
alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invites enable row level security;
alter table public.platform_admins enable row level security;
alter table public.app_config enable row level security;

-- Profil: o'zi va bir byudjetdagi hamkorlari (ism ko'rinishi uchun).
create policy profiles_select on public.profiles for select to authenticated
  using (
    user_id = (select auth.uid())
    or user_id in (
      select m.user_id from public.household_members m
       where m.household_id in (select private.my_household_ids())
    )
  );
create policy profiles_update on public.profiles for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy households_select on public.households for select to authenticated
  using (id in (select private.my_household_ids()));
create policy households_update on public.households for update to authenticated
  using (id in (select private.my_admin_household_ids()))
  with check (id in (select private.my_admin_household_ids()));

create policy household_members_select on public.household_members for select to authenticated
  using (household_id in (select private.my_household_ids()));

create policy household_invites_select on public.household_invites for select to authenticated
  using (household_id in (select private.my_admin_household_ids()));

create policy app_config_select on public.app_config for select to authenticated
  using (true);

-- Audit jurnali (E01-T03): faqat byudjet owner/admin'lari o'qiydi (E25-T05).
create policy audit_log_select on public.audit_log for select to authenticated
  using (household_id in (select private.my_admin_household_ids()));

-- Profil ustunlaridan faqat ism va til o'zgartiriladi.
revoke update on public.profiles from authenticated;
grant update (display_name, locale, last_household_id) on public.profiles to authenticated;

-- Byudjetda tizim maydonlari (yaratuvchi, versiya) klientdan o'zgartirilmaydi.
revoke update on public.households from authenticated;
grant update (
  name, base_currency, timezone,
  personal_fund_mode, personal_fund_percent, personal_fund_fixed_amount,
  personal_fund_day, personal_fund_source_account_id,
  auto_open_month, strict_month_lock
) on public.households to authenticated;
