-- E06-T01: tizim spravochniklari — valyutalar, kategoriya shablonlari,
-- valyuta kurslari. O'qish — har bir kirgan foydalanuvchi; yozish — faqat
-- platforma admini (BR-213) yoki server (service role, masalan fx-sync).

-- ─── Umumiy tiplar ─────────────────────────────────────────────────────────
create type public.category_kind as enum ('income', 'expense');

-- Tizim kategoriyalari: klient yarata olmaydi, o'chira olmaydi (BR-033).
create type public.category_system_code as enum ('personal_allocation');

-- Ikon — neytral kalit (`cart`, `bus`, ...): har klient o'z ikon to'plamiga
-- moslaydi, noma'lum kalitga umumiy ikon (ro'yxat — contracts/api.md).
create domain public.icon_key as text check (value ~ '^[a-z][a-z0-9-]{1,31}$');

create domain public.hex_color as text check (value ~ '^#[0-9A-F]{6}$');

-- ─── Valyutalar (BR-190) ───────────────────────────────────────────────────
create table public.currencies (
  code       text primary key check (code ~ '^[A-Z]{3}$'),
  name_i18n  jsonb not null check (name_i18n ?& array['uz', 'ru', 'en']),
  symbol     text not null check (char_length(symbol) between 1 and 5),
  -- ISO 4217 kasr xonalari: summalar shu darajadagi eng kichik birlikda (BR-001).
  exponent   smallint not null default 2 check (exponent between 0 and 4),
  active     boolean not null default true,
  sort_order integer not null default 0
);

insert into public.currencies (code, name_i18n, symbol, exponent, sort_order) values
  ('UZS', '{"uz": "O''zbek so''mi", "ru": "Узбекский сум", "en": "Uzbek som"}', 'so''m', 2, 1),
  ('USD', '{"uz": "AQSh dollari", "ru": "Доллар США", "en": "US dollar"}', '$', 2, 2),
  ('EUR', '{"uz": "Yevro", "ru": "Евро", "en": "Euro"}', '€', 2, 3),
  ('RUB', '{"uz": "Rossiya rubli", "ru": "Российский рубль", "en": "Russian ruble"}', '₽', 2, 4);

-- Byudjet valyutasi endi spravochnikdan (E05 da faqat format CHECK edi).
-- Jadval kichik va migratsiya bir marta ishlaydi — to'liq skan ahamiyatsiz.
alter table public.households
  -- squawk-ignore adding-foreign-key-constraint, constraint-missing-not-valid
  add constraint households_base_currency_fkey foreign key (base_currency) references public.currencies (code);

-- ─── Kategoriya shablonlari (BR-031, BR-032) ───────────────────────────────
-- Yangi byudjet shu ro'yxatdan (foydalanuvchi tilida) standart kategoriyalar
-- oladi — private.seed_household (E06-T08).
create table public.category_templates (
  id          uuid primary key default private.uuid_v7(),
  kind        public.category_kind not null,
  name_i18n   jsonb not null check (name_i18n ?& array['uz', 'ru', 'en']),
  icon        public.icon_key not null,
  color       public.hex_color not null,
  -- BR-040: daromad qaysi oyga tegishli — sana oyi + siljish (faqat daromad).
  month_shift smallint not null default 0 check (month_shift between -1 and 1),
  system_code public.category_system_code unique,
  sort_order  integer not null default 0,
  check (kind = 'income' or month_shift = 0)
);

insert into public.category_templates (kind, name_i18n, icon, color, month_shift, system_code, sort_order) values
  -- Daromad turlari va ularning oy siljishi (BR-031).
  ('income', '{"uz": "Avans", "ru": "Аванс", "en": "Advance"}', 'wallet', '#16A34A', 0, null, 1),
  ('income', '{"uz": "Oylik", "ru": "Зарплата", "en": "Salary"}', 'briefcase', '#15803D', -1, null, 2),
  ('income', '{"uz": "KPI", "ru": "KPI", "en": "KPI bonus"}', 'trophy', '#0D9488', -1, null, 3),
  ('income', '{"uz": "Qo''shimcha", "ru": "Доп. доход", "en": "Extra income"}', 'plus-circle', '#65A30D', -1, null, 4),
  -- Xarajat kategoriyalari (BR-032).
  ('expense', '{"uz": "Ijara", "ru": "Аренда", "en": "Rent"}', 'home', '#7C3AED', 0, null, 10),
  ('expense', '{"uz": "Kommunal", "ru": "Коммунальные", "en": "Utilities"}', 'bolt', '#F59E0B', 0, null, 11),
  ('expense', '{"uz": "Internet/Aloqa", "ru": "Интернет/Связь", "en": "Internet/Phone"}', 'wifi', '#0EA5E9', 0, null, 12),
  ('expense', '{"uz": "Oziq-ovqat", "ru": "Продукты", "en": "Groceries"}', 'cart', '#22C55E', 0, null, 13),
  ('expense', '{"uz": "Transport", "ru": "Транспорт", "en": "Transport"}', 'bus', '#3B82F6', 0, null, 14),
  ('expense', '{"uz": "Kredit/Qarz", "ru": "Кредит/Долг", "en": "Loans/Debt"}', 'credit-card', '#EF4444', 0, null, 15),
  ('expense', '{"uz": "Sog''liq", "ru": "Здоровье", "en": "Health"}', 'heart-pulse', '#EC4899', 0, null, 16),
  ('expense', '{"uz": "Ta''lim", "ru": "Образование", "en": "Education"}', 'graduation-cap', '#6366F1', 0, null, 17),
  ('expense', '{"uz": "Kiyim", "ru": "Одежда", "en": "Clothing"}', 'shirt', '#A855F7', 0, null, 18),
  ('expense', '{"uz": "Ko''ngilochar", "ru": "Развлечения", "en": "Entertainment"}', 'party', '#F97316', 0, null, 19),
  ('expense', '{"uz": "Sovg''a", "ru": "Подарки", "en": "Gifts"}', 'gift', '#E11D48', 0, null, 20),
  ('expense', '{"uz": "Uy-ro''zg''or", "ru": "Дом и быт", "en": "Household"}', 'sofa', '#84CC16', 0, null, 21),
  -- BR-033: tizim kategoriyasi — 👤 shaxsiy fond ajratmalari shu yerda.
  ('expense', '{"uz": "O''zim uchun", "ru": "Для себя", "en": "For myself"}', 'user', '#8B5CF6', 0, 'personal_allocation', 22),
  ('expense', '{"uz": "Boshqa", "ru": "Другое", "en": "Other"}', 'dots', '#64748B', 0, null, 99);

-- ─── Valyuta kurslari (BR-191; to'ldirish — E29 fx-sync) ────────────────────
create table public.exchange_rates (
  currency     text not null references public.currencies (code),
  rate_date    date not null,
  -- 1 birlik valyuta necha birlik asosiy valyuta (CBU: `Rate / Nominal`).
  rate_to_base numeric(18, 6) not null check (rate_to_base > 0),
  source       text not null default 'CBU' check (source in ('CBU', 'manual')),
  created_at   timestamptz not null default now(),
  -- "Sanadagi yoki undan oldingi eng yaqin kurs" — shu PK bo'yicha bitta qidiruv.
  primary key (currency, rate_date)
);

-- ─── RLS ───────────────────────────────────────────────────────────────────
alter table public.currencies enable row level security;
alter table public.category_templates enable row level security;
alter table public.exchange_rates enable row level security;

create policy currencies_select on public.currencies for select to authenticated
  using (true);
create policy currencies_admin on public.currencies for all to authenticated
  using ((select private.is_platform_admin()))
  with check ((select private.is_platform_admin()));

create policy category_templates_select on public.category_templates for select to authenticated
  using (true);
create policy category_templates_admin on public.category_templates for all to authenticated
  using ((select private.is_platform_admin()))
  with check ((select private.is_platform_admin()));

create policy exchange_rates_select on public.exchange_rates for select to authenticated
  using (true);
create policy exchange_rates_admin on public.exchange_rates for all to authenticated
  using ((select private.is_platform_admin()))
  with check ((select private.is_platform_admin()));

-- ─── app_bootstrap: valyutalar ham (ARXITEKTURA 5) ─────────────────────────
-- Qo'shimcha maydon — shartnoma versiyasi o'zgarmaydi (contracts/README.md).
create or replace function public.app_bootstrap()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'schema_version', private.api_schema_version(),
    'is_platform_admin', private.is_platform_admin(),
    'profile', (
      select jsonb_build_object(
        'user_id', p.user_id,
        'display_name', p.display_name,
        'locale', p.locale,
        'last_household_id', p.last_household_id
      )
        from public.profiles p where p.user_id = (select auth.uid())
    ),
    'households', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'id', h.id,
                 'name', h.name,
                 'role', m.role,
                 'base_currency', h.base_currency,
                 'timezone', h.timezone
               ) order by h.created_at
             )
        from public.household_members m
        join public.households h on h.id = m.household_id
       where m.user_id = (select auth.uid())
    ), '[]'::jsonb),
    'currencies', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'code', c.code,
                 'name', c.name_i18n,
                 'symbol', c.symbol,
                 'exponent', c.exponent
               ) order by c.sort_order
             )
        from public.currencies c
       where c.active
    ), '[]'::jsonb),
    'app_config', coalesce((select jsonb_object_agg(c.key, c.value) from public.app_config c), '{}'::jsonb)
  )
$$;
