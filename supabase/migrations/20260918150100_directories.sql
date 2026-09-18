-- E06-T02..T07: byudjet spravochniklari — hisoblar, kategoriyalar, doimiy
-- rejalar, limitlar, tez tugmalar, teglar.
-- Qoidalar: BR-003, BR-011, BR-020..026, BR-030..037, BR-080, BR-130,
-- BR-140, BR-200; ADR-04, ADR-05, ADR-07.
--
-- Har jadvalda umumiy ustunlar (ARXITEKTURA 3.2): id (UUIDv7, klient
-- yaratadi), household_id, created_by, created_at, updated_at, deleted_at
-- (soft delete — sinxron uchun tombstone), row_version (sinxron kursori).
--
-- Byudjet ichidagi havolalar — KOMPOZIT FK: (household_id, x_id) →
-- (household_id, id). Boshqa byudjet yozuviga havola tuzilishi jihatidan
-- imkonsiz, FK tekshiruvi esa household_id bilan boshlanadigan indeksni
-- ishlatadi (katta jadvalni to'liq skanerlamaydi).
--
-- BEFORE triggerlar nom bo'yicha alifbo tartibida ishlaydi va bu muhim:
--   <jadval>_touch     byudjet advisory lock + row_version (private.touch_synced_row)
--   <jadval>_validate  biznes tekshiruvlari — lock'dan KEYIN: bir byudjetga
--                      parallel yozuvlar ketma-ket tekshiriladi (masalan
--                      kategoriya o'chirilayotganda unga yangi havola paydo bo'lmaydi)
--   <jadval>_audit     AFTER — audit jurnali (BR-008)
--
-- O'chirish — faqat `deleted_at` bilan: klientda DELETE huquqi yo'q, aks holda
-- mobil ilova o'chirilganini sinxronda bilmay qolardi (ARXITEKTURA 6).

-- ─── Tiplar ────────────────────────────────────────────────────────────────
-- BR-020: `personal_fund` — 👤 shaxsiy fond, byudjetda bitta tizim hisobi.
create type public.account_type as enum (
  'cash', 'card', 'bank', 'ewallet', 'deposit', 'personal_fund', 'other'
);

-- BR-080: doimiy reja (va E07 da oy rejasi) turi.
create type public.plan_kind as enum ('expense', 'income', 'allocation');

-- BR-003: nom — bo'sh emas, chetida bo'shliqsiz (klient trim qiladi);
-- yagonalik `lower(name)` bo'yicha (unique indekslar).
create domain public.entity_name as text
  check (char_length(value) between 1 and 60 and value = btrim(value));

-- Oy — oyning 1-kuni sifatida saqlanadi.
create domain public.month_start as date check (extract(day from value) = 1);

-- ─── Hisoblar (BR-020..026) ────────────────────────────────────────────────
create table public.accounts (
  id              uuid primary key default private.uuid_v7(),
  household_id    uuid not null references public.households (id) on delete cascade,
  name            public.entity_name not null,
  type            public.account_type not null,
  currency        text not null references public.currencies (code),
  -- Boshlang'ich qoldiq eng kichik birlikda (kredit karta — manfiy) va sanasi.
  opening_balance bigint not null default 0,
  opening_date    date not null,
  icon            public.icon_key,
  color           public.hex_color,
  sort_order      integer not null default 0,
  -- BR-024: arxivlangan hisob tanlash ro'yxatlarida yo'q, hisobotlarda bor.
  archived_at     timestamptz,
  created_by      uuid default auth.uid() references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  row_version     bigint not null default 0,
  unique (household_id, id)
);

comment on table public.accounts is 'BR-020: hisoblar (hamyonlar); personal_fund — byudjetda bitta.';

create unique index accounts_name_key on public.accounts (household_id, lower(name))
  where deleted_at is null;
create unique index accounts_personal_fund_key on public.accounts (household_id)
  where type = 'personal_fund';

-- 👤 Fond ajratmasi manbai — shu byudjet hisobi (E05 da FK'siz qoldirilgan).
-- Hisob qattiq o'chirilsa (faqat tombstone tozalash) — manba bo'shatiladi.
alter table public.households
  -- squawk-ignore adding-foreign-key-constraint, constraint-missing-not-valid
  add constraint households_personal_fund_source_fkey foreign key (id, personal_fund_source_account_id) references public.accounts (household_id, id) on delete set null (personal_fund_source_account_id);

-- ─── Kategoriyalar (BR-030..037) ───────────────────────────────────────────
create table public.categories (
  id           uuid primary key default private.uuid_v7(),
  household_id uuid not null references public.households (id) on delete cascade,
  kind         public.category_kind not null,
  name         public.entity_name not null,
  -- BR-034: bir darajali subkategoriya (validate triggeri tekshiradi).
  parent_id    uuid,
  -- BR-031/040: daromad qaysi oyga tegishli — sana oyi + siljish (faqat daromad).
  month_shift  smallint not null default 0 check (month_shift between -1 and 1),
  system_code  public.category_system_code,
  icon         public.icon_key,
  color        public.hex_color,
  sort_order   integer not null default 0,
  archived_at  timestamptz,
  created_by   uuid default auth.uid() references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  row_version  bigint not null default 0,
  unique (household_id, id),
  unique (household_id, system_code),
  foreign key (household_id, parent_id) references public.categories (household_id, id),
  check (kind = 'income' or month_shift = 0)
);

comment on table public.categories is 'BR-030: daromad turlari va xarajat kategoriyalari.';

create unique index categories_name_key on public.categories (household_id, kind, lower(name))
  where deleted_at is null;

-- ─── Doimiy rejalar (BR-080) ───────────────────────────────────────────────
create table public.recurring_rules (
  id           uuid primary key default private.uuid_v7(),
  household_id uuid not null references public.households (id) on delete cascade,
  kind         public.plan_kind not null,
  name         public.entity_name not null,
  category_id  uuid,
  -- Standart hisob (to'lashda boshqasi tanlanishi mumkin); ajratmada — manba.
  account_id   uuid,
  -- Summa (hisob valyutasida, eng kichik birlikda); NULL — o'zgaruvchan.
  amount       bigint check (amount > 0),
  -- 1–31; qisqa oyda oxirgi kunga qisiladi (E08 open_month).
  day_of_month smallint not null check (day_of_month between 1 and 31),
  auto_pay     boolean not null default false,
  active       boolean not null default true,
  debt_id      uuid, -- FK — E07 (debts)
  -- Amal qilish davri (ikkalasi ham ixtiyoriy).
  start_month  public.month_start,
  end_month    public.month_start,
  sort_order   integer not null default 0,
  created_by   uuid default auth.uid() references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  row_version  bigint not null default 0,
  unique (household_id, id),
  foreign key (household_id, category_id) references public.categories (household_id, id),
  foreign key (household_id, account_id) references public.accounts (household_id, id),
  -- Fond ajratmasida kategoriya yo'q ("O'zim uchun" avtomatik), qolganida majburiy.
  check ((kind = 'allocation') = (category_id is null)),
  -- Avto to'lov (BR-075) aniq summa va hisobsiz ishlay olmaydi.
  check (not auto_pay or (amount is not null and account_id is not null)),
  check (end_month >= start_month)
);

comment on table public.recurring_rules is 'BR-080: doimiy rejalar — oy ochilganda rejalar shulardan yaratiladi.';

create unique index recurring_rules_name_key on public.recurring_rules (household_id, lower(name))
  where deleted_at is null;

-- ─── Limitlar (BR-130) ─────────────────────────────────────────────────────
create table public.category_limits (
  id           uuid primary key default private.uuid_v7(),
  household_id uuid not null references public.households (id) on delete cascade,
  category_id  uuid not null,
  -- Oylik limit, asosiy valyutada, eng kichik birlikda.
  amount       bigint not null check (amount > 0),
  -- BR-133: 80% va 100% chegarasida bildirishnoma.
  alert_80     boolean not null default true,
  alert_100    boolean not null default true,
  created_by   uuid default auth.uid() references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  row_version  bigint not null default 0,
  foreign key (household_id, category_id) references public.categories (household_id, id)
);

comment on table public.category_limits is 'BR-130: xarajat kategoriyasi uchun oylik limit.';

create unique index category_limits_category_key on public.category_limits (household_id, category_id)
  where deleted_at is null;

-- ─── Tez tugmalar (BR-140) ─────────────────────────────────────────────────
create table public.quick_actions (
  id           uuid primary key default private.uuid_v7(),
  household_id uuid not null references public.households (id) on delete cascade,
  name         public.entity_name not null,
  amount       bigint not null check (amount > 0),
  category_id  uuid not null,
  account_id   uuid not null,
  payee        public.entity_name,
  sort_order   integer not null default 0,
  created_by   uuid default auth.uid() references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  row_version  bigint not null default 0,
  foreign key (household_id, category_id) references public.categories (household_id, id),
  foreign key (household_id, account_id) references public.accounts (household_id, id)
);

comment on table public.quick_actions is 'BR-140: bir bosishda xarajat (nom, summa, kategoriya, hisob).';

-- ─── Teglar (BR-200) ───────────────────────────────────────────────────────
create table public.tags (
  id           uuid primary key default private.uuid_v7(),
  household_id uuid not null references public.households (id) on delete cascade,
  name         public.entity_name not null,
  color        public.hex_color,
  created_by   uuid default auth.uid() references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  row_version  bigint not null default 0,
  unique (household_id, id)
);

comment on table public.tags is 'BR-200: amallar uchun erkin teglar (bog''lanish — E07 transaction_tags).';

create unique index tags_name_key on public.tags (household_id, lower(name))
  where deleted_at is null;

-- ─── Sinxron indekslari (E06-T07) ──────────────────────────────────────────
-- sync_pull: `household_id = ? and row_version > ? order by row_version`.
-- Shu indeks byudjet bo'yicha har qanday filtr, household cascade va kompozit
-- FK tekshiruvlariga ham xizmat qiladi. Spravochniklar byudjetda o'nlab qator —
-- `sort_order` bo'yicha tartiblash xotirada arzon, alohida indeks shart emas.
create index accounts_sync_idx on public.accounts (household_id, row_version);
create index categories_sync_idx on public.categories (household_id, row_version);
create index recurring_rules_sync_idx on public.recurring_rules (household_id, row_version);
create index category_limits_sync_idx on public.category_limits (household_id, row_version);
create index quick_actions_sync_idx on public.quick_actions (household_id, row_version);
create index tags_sync_idx on public.tags (household_id, row_version);

-- ─── Tekshiruv yordamchilari ───────────────────────────────────────────────
-- Havola qilingan kategoriya o'chirilmagan va turi mos (byudjet — kompozit FK).
-- Topilmasa jim: xatoni FK o'zi (23503) beradi.
create or replace function private.assert_category(
  p_household uuid,
  p_category uuid,
  p_kind public.category_kind
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_kind public.category_kind;
  v_deleted_at timestamptz;
begin
  select c.kind, c.deleted_at into v_kind, v_deleted_at
    from public.categories c
   where c.household_id = p_household and c.id = p_category;
  if not found then
    return;
  end if;
  if v_deleted_at is not null then
    raise exception 'category_deleted' using errcode = 'P0001';
  end if;
  if v_kind <> p_kind then
    raise exception 'category_kind_mismatch' using errcode = 'P0001';
  end if;
end;
$$;

-- Havola qilingan hisob o'chirilmagan; turini qaytaradi (topilmasa — NULL).
create or replace function private.assert_account(p_household uuid, p_account uuid)
returns public.account_type
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_type public.account_type;
  v_deleted_at timestamptz;
begin
  select a.type, a.deleted_at into v_type, v_deleted_at
    from public.accounts a
   where a.household_id = p_household and a.id = p_account;
  if v_deleted_at is not null then
    raise exception 'account_deleted' using errcode = 'P0001';
  end if;
  return v_type;
end;
$$;

-- BR-024, BR-036: tirik yozuvlar havola qilgan hisob/kategoriya o'chirilmaydi
-- (arxivlanadi yoki birlashtiriladi). E07 da amallar va rejalar qo'shiladi.
create or replace function private.category_in_use(p_household uuid, p_category uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
           select 1 from public.categories c
            where c.household_id = p_household and c.parent_id = p_category and c.deleted_at is null
         )
      or exists (
           select 1 from public.recurring_rules r
            where r.household_id = p_household and r.category_id = p_category and r.deleted_at is null
         )
      or exists (
           select 1 from public.category_limits l
            where l.household_id = p_household and l.category_id = p_category and l.deleted_at is null
         )
      or exists (
           select 1 from public.quick_actions q
            where q.household_id = p_household and q.category_id = p_category and q.deleted_at is null
         )
$$;

create or replace function private.account_in_use(p_household uuid, p_account uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
           select 1 from public.households h
            where h.id = p_household and h.personal_fund_source_account_id = p_account
         )
      or exists (
           select 1 from public.recurring_rules r
            where r.household_id = p_household and r.account_id = p_account and r.deleted_at is null
         )
      or exists (
           select 1 from public.quick_actions q
            where q.household_id = p_household and q.account_id = p_account and q.deleted_at is null
         )
$$;

-- ─── Validate triggerlari ──────────────────────────────────────────────────
-- Havolalar faqat kerak bo'lganda tekshiriladi: yangi qator, havola
-- o'zgargan yoki o'chirilgan qator tiklanayotgan bo'lsa.

-- Hisob: personal_fund — tizim hisobi; ishlatilayotgan hisob o'chirilmaydi.
create or replace function private.validate_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (old.type = 'personal_fund') <> (new.type = 'personal_fund')
     or (old.type = 'personal_fund' and (new.deleted_at is not null or new.archived_at is not null)) then
    raise exception 'system_account' using errcode = 'P0001';
  end if;
  if old.deleted_at is null and new.deleted_at is not null
     and private.account_in_use(old.household_id, old.id) then
    raise exception 'account_in_use' using errcode = 'P0001';
  end if;
  -- Fond manbai arxivlanmaydi — avval fond sozlamasida boshqa hisob tanlanadi.
  if old.archived_at is null and new.archived_at is not null
     and exists (
       select 1 from public.households h
        where h.id = old.household_id and h.personal_fund_source_account_id = old.id
     ) then
    raise exception 'account_in_use' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- Kategoriya: tizim kategoriyasi himoyasi (BR-033), bir daraja (BR-034),
-- ishlatilayotgani o'chirilmaydi (BR-036).
create or replace function private.validate_category()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if old.system_code is not null
       and (new.deleted_at is not null or new.archived_at is not null or new.parent_id is not null) then
      raise exception 'system_category' using errcode = 'P0001';
    end if;
    if old.deleted_at is null and new.deleted_at is not null
       and private.category_in_use(old.household_id, old.id) then
      raise exception 'category_in_use' using errcode = 'P0001';
    end if;
  end if;

  if new.parent_id is null or new.deleted_at is not null
     or (tg_op = 'UPDATE' and old.deleted_at is null and new.parent_id is not distinct from old.parent_id) then
    return new;
  end if;
  -- Ota: shu byudjetda, o'sha turda, o'zi subkategoriya emas, o'chirilmagan;
  -- bu kategoriyaning o'z subkategoriyalari yo'q.
  if new.parent_id = new.id
     or not exists (
       select 1 from public.categories p
        where p.household_id = new.household_id and p.id = new.parent_id
          and p.kind = new.kind and p.parent_id is null and p.deleted_at is null
     )
     or exists (
       select 1 from public.categories c
        where c.household_id = new.household_id and c.parent_id = new.id and c.deleted_at is null
     ) then
    raise exception 'invalid_parent' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- Doimiy reja: kategoriya turi reja turiga mos; ajratma manbai fondning o'zi emas.
create or replace function private.validate_recurring_rule()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.deleted_at is not null
     or (tg_op = 'UPDATE' and old.deleted_at is null
         and (new.kind, new.category_id, new.account_id)
             is not distinct from (old.kind, old.category_id, old.account_id)) then
    return new;
  end if;
  -- Ajratma + kategoriya holatini jadval CHECK'i rad etadi.
  if new.category_id is not null and new.kind <> 'allocation' then
    perform private.assert_category(new.household_id, new.category_id, new.kind::text::public.category_kind);
  end if;
  if new.account_id is not null
     and private.assert_account(new.household_id, new.account_id) = 'personal_fund'
     and new.kind = 'allocation' then
    raise exception 'invalid_account' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- Limit — faqat xarajat kategoriyasiga (kategoriya keyin o'zgarmaydi).
create or replace function private.validate_category_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.deleted_at is null and (tg_op = 'INSERT' or old.deleted_at is not null) then
    perform private.assert_category(new.household_id, new.category_id, 'expense');
  end if;
  return new;
end;
$$;

-- Tez tugma xarajat yozadi (BR-141): xarajat kategoriyasi, tirik hisob.
create or replace function private.validate_quick_action()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.deleted_at is not null
     or (tg_op = 'UPDATE' and old.deleted_at is null
         and (new.category_id, new.account_id) is not distinct from (old.category_id, old.account_id)) then
    return new;
  end if;
  perform private.assert_category(new.household_id, new.category_id, 'expense');
  perform private.assert_account(new.household_id, new.account_id);
  return new;
end;
$$;

-- Fond manbai: shu byudjetning tirik, arxivlanmagan, fond bo'lmagan hisobi.
create or replace function private.validate_household()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.personal_fund_source_account_id is null
     or new.personal_fund_source_account_id is not distinct from old.personal_fund_source_account_id then
    return new;
  end if;
  if not exists (
    select 1 from public.accounts a
     where a.household_id = new.id and a.id = new.personal_fund_source_account_id
       and a.type <> 'personal_fund' and a.deleted_at is null and a.archived_at is null
  ) then
    raise exception 'invalid_fund_source' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- ─── Triggerlar ────────────────────────────────────────────────────────────
create trigger accounts_touch before insert or update on public.accounts
  for each row execute function private.touch_synced_row();
create trigger accounts_validate before update on public.accounts
  for each row execute function private.validate_account();
create trigger accounts_audit after insert or update or delete on public.accounts
  for each row execute function private.audit();

create trigger categories_touch before insert or update on public.categories
  for each row execute function private.touch_synced_row();
create trigger categories_validate before insert or update on public.categories
  for each row execute function private.validate_category();
create trigger categories_audit after insert or update or delete on public.categories
  for each row execute function private.audit();

create trigger recurring_rules_touch before insert or update on public.recurring_rules
  for each row execute function private.touch_synced_row();
create trigger recurring_rules_validate before insert or update on public.recurring_rules
  for each row execute function private.validate_recurring_rule();
create trigger recurring_rules_audit after insert or update or delete on public.recurring_rules
  for each row execute function private.audit();

create trigger category_limits_touch before insert or update on public.category_limits
  for each row execute function private.touch_synced_row();
create trigger category_limits_validate before insert or update on public.category_limits
  for each row execute function private.validate_category_limit();
create trigger category_limits_audit after insert or update or delete on public.category_limits
  for each row execute function private.audit();

create trigger quick_actions_touch before insert or update on public.quick_actions
  for each row execute function private.touch_synced_row();
create trigger quick_actions_validate before insert or update on public.quick_actions
  for each row execute function private.validate_quick_action();
create trigger quick_actions_audit after insert or update or delete on public.quick_actions
  for each row execute function private.audit();

create trigger tags_touch before insert or update on public.tags
  for each row execute function private.touch_synced_row();
create trigger tags_audit after insert or update or delete on public.tags
  for each row execute function private.audit();

create trigger households_validate before update of personal_fund_source_account_id on public.households
  for each row execute function private.validate_household();

-- ─── RLS (E06-T06) ─────────────────────────────────────────────────────────
-- O'qish — a'zolar; yozish — owner/admin (BR-011). Teg — amal bilan birga
-- yaratiladi, shuning uchun yaratish amal yozuvchilarga ham ochiq (BR-200).
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.recurring_rules enable row level security;
alter table public.category_limits enable row level security;
alter table public.quick_actions enable row level security;
alter table public.tags enable row level security;

create policy accounts_select on public.accounts for select to authenticated
  using (household_id in (select private.my_household_ids()));
create policy accounts_insert on public.accounts for insert to authenticated
  with check (household_id in (select private.my_admin_household_ids()));
create policy accounts_update on public.accounts for update to authenticated
  using (household_id in (select private.my_admin_household_ids()))
  with check (household_id in (select private.my_admin_household_ids()));

create policy categories_select on public.categories for select to authenticated
  using (household_id in (select private.my_household_ids()));
create policy categories_insert on public.categories for insert to authenticated
  with check (household_id in (select private.my_admin_household_ids()));
create policy categories_update on public.categories for update to authenticated
  using (household_id in (select private.my_admin_household_ids()))
  with check (household_id in (select private.my_admin_household_ids()));

create policy recurring_rules_select on public.recurring_rules for select to authenticated
  using (household_id in (select private.my_household_ids()));
create policy recurring_rules_insert on public.recurring_rules for insert to authenticated
  with check (household_id in (select private.my_admin_household_ids()));
create policy recurring_rules_update on public.recurring_rules for update to authenticated
  using (household_id in (select private.my_admin_household_ids()))
  with check (household_id in (select private.my_admin_household_ids()));

create policy category_limits_select on public.category_limits for select to authenticated
  using (household_id in (select private.my_household_ids()));
create policy category_limits_insert on public.category_limits for insert to authenticated
  with check (household_id in (select private.my_admin_household_ids()));
create policy category_limits_update on public.category_limits for update to authenticated
  using (household_id in (select private.my_admin_household_ids()))
  with check (household_id in (select private.my_admin_household_ids()));

create policy quick_actions_select on public.quick_actions for select to authenticated
  using (household_id in (select private.my_household_ids()));
create policy quick_actions_insert on public.quick_actions for insert to authenticated
  with check (household_id in (select private.my_admin_household_ids()));
create policy quick_actions_update on public.quick_actions for update to authenticated
  using (household_id in (select private.my_admin_household_ids()))
  with check (household_id in (select private.my_admin_household_ids()));

create policy tags_select on public.tags for select to authenticated
  using (household_id in (select private.my_household_ids()));
create policy tags_insert on public.tags for insert to authenticated
  with check (household_id in (select private.my_writable_household_ids()));
create policy tags_update on public.tags for update to authenticated
  using (household_id in (select private.my_admin_household_ids()))
  with check (household_id in (select private.my_admin_household_ids()));

-- ─── Ustun huquqlari ───────────────────────────────────────────────────────
-- Klient faqat biznes maydonlarni yozadi. Tizim maydonlari (household_id
-- tahriri, created_by, row_version, system_code), o'zgarmas maydonlar
-- (kategoriya turi, limit kategoriyasi) va DELETE yopiq.
revoke all on public.accounts, public.categories, public.recurring_rules,
  public.category_limits, public.quick_actions, public.tags
  from authenticated;
grant select on public.accounts, public.categories, public.recurring_rules,
  public.category_limits, public.quick_actions, public.tags
  to authenticated;

grant insert (id, household_id, name, type, currency, opening_balance, opening_date, icon, color, sort_order),
  update (name, type, currency, opening_balance, opening_date, icon, color, sort_order, archived_at, deleted_at)
  on public.accounts to authenticated;

grant insert (id, household_id, kind, name, parent_id, month_shift, icon, color, sort_order),
  update (name, parent_id, month_shift, icon, color, sort_order, archived_at, deleted_at)
  on public.categories to authenticated;

grant insert (id, household_id, kind, name, category_id, account_id, amount, day_of_month,
              auto_pay, active, start_month, end_month, sort_order),
  update (kind, name, category_id, account_id, amount, day_of_month,
          auto_pay, active, start_month, end_month, sort_order, deleted_at)
  on public.recurring_rules to authenticated;

grant insert (id, household_id, category_id, amount, alert_80, alert_100),
  update (amount, alert_80, alert_100, deleted_at)
  on public.category_limits to authenticated;

grant insert (id, household_id, name, amount, category_id, account_id, payee, sort_order),
  update (name, amount, category_id, account_id, payee, sort_order, deleted_at)
  on public.quick_actions to authenticated;

grant insert (id, household_id, name, color),
  update (name, color, deleted_at)
  on public.tags to authenticated;
