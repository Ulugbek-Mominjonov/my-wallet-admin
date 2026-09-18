-- E07-T02..T04, T07: oy rejalari, amallar va ularning teglari; tegishli oy,
-- asosiy valyutadagi summa va o'tkazma summasini hisoblash; oy qulfi.
-- Qoidalar: BR-024..026, BR-036, BR-040..046, BR-050..055, BR-061..065,
-- BR-070..073, BR-111, BR-150..152, BR-191..193, BR-200; ADR-05, ADR-06, ADR-08.

create type public.plan_system_code as enum ('personal_allocation');
create type public.transaction_kind as enum ('income', 'expense', 'transfer');
create type public.budget_month_source as enum ('auto', 'manual');
create type public.transaction_source as enum ('manual', 'quick_action', 'auto_pay', 'import', 'telegram');

-- ─── Oy rejalari (BR-070) ──────────────────────────────────────────────────
create table public.planned_items (
  id                uuid primary key default private.uuid_v7(),
  household_id      uuid not null references public.households (id) on delete cascade,
  kind              public.plan_kind not null,
  name              public.entity_name not null,
  category_id       uuid,
  -- Taxminiy hisob (to'lashda boshqasi tanlanishi mumkin); ajratmada — manba.
  account_id        uuid,
  -- Asosiy valyutada; NULL — summa har oy o'zgaradi (BR-070).
  planned_amount    bigint check (planned_amount > 0),
  due_date          date not null,
  -- BR-044: reja va uning to'lovlari shu oyga tegishli (to'lov kuni keyingi oyda bo'lsa ham).
  budget_month      public.month_start not null,
  auto_pay          boolean not null default false,
  debt_id           uuid,
  recurring_rule_id uuid,
  system_code       public.plan_system_code,
  -- To'langan jami (asosiy valyutada) — bog'langan amallardan trigger hisoblaydi.
  paid_amount       bigint not null default 0 check (paid_amount >= 0),
  -- BR-071: to'langan (to'liq to'lov yoki qo'lda yopish) — trigger hisoblaydi.
  settled_at        timestamptz,
  -- BR-073: qo'lda "Yopish" — qisman to'langan bo'lsa ham.
  closed_at         timestamptz,
  -- BR-071: shu oy uchun o'tkazib yuborildi.
  skipped_at        timestamptz,
  note              public.note_text,
  created_by        uuid default auth.uid() references auth.users (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  row_version       bigint not null default 0,
  unique (household_id, id),
  -- BR-081: bir oyda bir shablondan bitta reja — oyni qayta ochish idempotent.
  unique (recurring_rule_id, budget_month),
  -- BR-060: oyda bitta 👤 fond ajratmasi rejasi.
  unique (household_id, budget_month, system_code),
  foreign key (household_id, category_id) references public.categories (household_id, id),
  foreign key (household_id, account_id) references public.accounts (household_id, id),
  foreign key (household_id, debt_id) references public.debts (household_id, id),
  foreign key (household_id, recurring_rule_id) references public.recurring_rules (household_id, id),
  -- Ajratmada kategoriya va qarz yo'q ("O'zim uchun" avtomatik), qolganida kategoriya majburiy.
  check ((kind = 'allocation') = (category_id is null)),
  check (kind <> 'allocation' or debt_id is null),
  check (system_code is null or kind = 'allocation'),
  -- BR-075: avto to'lov aniq summa va hisobni talab qiladi.
  check (not auto_pay or (planned_amount is not null and account_id is not null))
);

comment on table public.planned_items is 'BR-070: oy rejalari (kutilayotgan to''lov va daromadlar); fakt — transactions.';

-- ─── Amallar (BR-050..053) ─────────────────────────────────────────────────
create table public.transactions (
  id                  uuid primary key default private.uuid_v7(),
  household_id        uuid not null references public.households (id) on delete cascade,
  kind                public.transaction_kind not null,
  account_id          uuid not null,
  -- BR-053: o'tkazma manzili.
  to_account_id       uuid,
  -- Hisob valyutasida, eng kichik birlikda (BR-001). Valyuta — hisobniki:
  -- amaldan keyin o'zgarmaydi (BR-026), shuning uchun takror saqlanmaydi.
  amount              bigint not null check (amount > 0),
  -- BR-193: manzil hisob valyutasidagi summa; bir valyutada = amount (trigger).
  to_amount           bigint check (to_amount > 0),
  -- ADR-08: asosiy valyutadagi summa — yozuv paytida hisoblanib muzlatiladi.
  amount_base         bigint not null default 0 check (amount_base >= 0),
  -- 1 birlik hisob valyutasi = fx_rate birlik asosiy valyuta (BR-192: qo'lda ham).
  fx_rate             numeric(18, 6) check (fx_rate > 0),
  category_id         uuid,
  payee               public.entity_name,
  occurred_on         date not null,
  -- BR-040..046: qaysi oyning byudjeti. auto — server hisoblaydi (klient
  -- yuborgan qiymat almashtiriladi), manual — foydalanuvchi tanlovi.
  budget_month        public.month_start not null,
  budget_month_source public.budget_month_source not null default 'auto',
  planned_item_id     uuid,
  debt_id             uuid,
  note                public.note_text,
  source              public.transaction_source not null default 'manual',
  created_by          uuid default auth.uid() references auth.users (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz,
  row_version         bigint not null default 0,
  unique (household_id, id),
  foreign key (household_id, account_id) references public.accounts (household_id, id),
  foreign key (household_id, to_account_id) references public.accounts (household_id, id),
  foreign key (household_id, category_id) references public.categories (household_id, id),
  foreign key (household_id, planned_item_id) references public.planned_items (household_id, id),
  foreign key (household_id, debt_id) references public.debts (household_id, id),
  -- Daromad/xarajat — kategoriya bilan, manzilsiz; o'tkazma — boshqa hisobga,
  -- manzil summasi bilan, kategoriya va qarzsiz.
  check (
    (kind in ('income', 'expense') and category_id is not null and to_account_id is null and to_amount is null)
    or (kind = 'transfer' and category_id is null and debt_id is null
        and to_account_id is not null and to_account_id <> account_id and to_amount is not null)
  )
);

comment on table public.transactions is 'BR-050..053: daromad, xarajat, o''tkazma (fakt).';

-- ─── Amal teglari (BR-054, BR-200) ─────────────────────────────────────────
create table public.transaction_tags (
  id             uuid primary key default private.uuid_v7(),
  household_id   uuid not null references public.households (id) on delete cascade,
  transaction_id uuid not null,
  tag_id         uuid not null,
  created_by     uuid default auth.uid() references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  row_version    bigint not null default 0,
  foreign key (household_id, transaction_id) references public.transactions (household_id, id) on delete cascade,
  foreign key (household_id, tag_id) references public.tags (household_id, id) on delete cascade
);

create unique index transaction_tags_key on public.transaction_tags (transaction_id, tag_id)
  where deleted_at is null;

-- ─── Indekslar (ARXITEKTURA 3.4) ───────────────────────────────────────────
create index planned_items_sync_idx on public.planned_items (household_id, row_version);
create index planned_items_month_idx on public.planned_items (household_id, budget_month)
  where deleted_at is null;
-- To'lanmaganlar: eslatma, avto to'lov, prognoz (BR-075, BR-076).
create index planned_items_unpaid_idx on public.planned_items (household_id, due_date)
  where settled_at is null and skipped_at is null and deleted_at is null;

create index transactions_sync_idx on public.transactions (household_id, row_version);
-- Oylik/yillik hisobot — index-only scan.
create index transactions_month_idx on public.transactions (household_id, budget_month)
  include (kind, amount_base, account_id, to_account_id, category_id)
  where deleted_at is null;
-- Ro'yxat — keyset sahifalash (occurred_on, id).
create index transactions_list_idx on public.transactions (household_id, occurred_on desc, id desc)
  where deleted_at is null;
create index transactions_planned_idx on public.transactions (planned_item_id)
  where planned_item_id is not null;
create index transactions_debt_idx on public.transactions (debt_id)
  where debt_id is not null;
-- Hisob qoldig'i va BR-026 tekshiruvi.
create index transactions_account_idx on public.transactions (account_id);
create index transactions_to_account_idx on public.transactions (to_account_id)
  where to_account_id is not null;
-- Joy/nom bo'yicha xatoga chidamli qidiruv va avto-to'ldirish (BR-056, BR-117, BR-202).
create index transactions_payee_trgm_idx on public.transactions using gin (payee extensions.gin_trgm_ops)
  where deleted_at is null;

create index transaction_tags_sync_idx on public.transaction_tags (household_id, row_version);
-- Teg bo'yicha hisobot (BR-200).
create index transaction_tags_tag_idx on public.transaction_tags (tag_id)
  where deleted_at is null;

-- ─── Yordamchilar ──────────────────────────────────────────────────────────
-- BR-071: reja holati saqlanmaydi — o'qishda byudjet vaqt zonasidagi bugungi
-- sanadan hisoblanadi (BR-002). Mobil ilova shu jadvalni aynan takrorlaydi.
create or replace function private.planned_status(p_item public.planned_items, p_today date)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_item.skipped_at is not null then 'skipped'
    when p_item.settled_at is not null then 'paid'
    when p_item.due_date < p_today then 'overdue'
    when p_item.paid_amount > 0 then 'partial'
    else 'pending'
  end
$$;

-- BR-055: strict_month_lock yoqilgan byudjetda yopilgan oyga yozuv taqiq
-- (qulfsiz rejimda klient faqat ogohlantiradi).
create or replace function private.assert_month_writable(p_household uuid, p_month date)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
      from public.households h
      join public.months m on m.household_id = h.id and m.month = p_month
     where h.id = p_household and h.strict_month_lock and m.closed_at is not null
  ) then
    raise exception 'month_closed' using errcode = 'P0001';
  end if;
end;
$$;

-- exchange_rates — CBU kurslari: 1 birlik valyuta necha so'm (sanadagi yoki
-- undan oldingi eng yaqin kurs). So'mning o'zi — 1.
create or replace function private.rate_to_uzs(p_currency text, p_date date)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select case when p_currency = 'UZS' then 1::numeric else (
    select e.rate_to_base from public.exchange_rates e
     where e.currency = p_currency and e.rate_date <= p_date
     order by e.rate_date desc
     limit 1
  ) end
$$;

-- BR-191: 1 birlik p_currency necha birlik p_base (so'm orqali); kurs yo'q — NULL.
create or replace function private.fx_rate(p_currency text, p_base text, p_date date)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_currency = p_base then 1::numeric
    else private.rate_to_uzs(p_currency, p_date) / nullif(private.rate_to_uzs(p_base, p_date), 0)
  end
$$;

-- Hisob valyutasidagi summani asosiy valyutaga (kasr xonalari farqi bilan).
create or replace function private.to_base_amount(
  p_amount bigint,
  p_currency text,
  p_base text,
  p_rate numeric
)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select round(p_amount * p_rate * power(10::numeric, b.exponent - c.exponent))::bigint
    from public.currencies c, public.currencies b
   where c.code = p_currency and b.code = p_base
$$;

-- ─── Ishlatilayotgan yozuvlar (E06 + amallar, rejalar, maqsadlar) ──────────
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
      or exists (
           select 1 from public.planned_items p
            where p.household_id = p_household and p.category_id = p_category and p.deleted_at is null
         )
      or exists (
           select 1 from public.transactions t
            where t.household_id = p_household and t.category_id = p_category and t.deleted_at is null
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
      or exists (
           select 1 from public.goals g
            where g.household_id = p_household and g.account_id = p_account and g.deleted_at is null
         )
      or exists (
           select 1 from public.planned_items p
            where p.household_id = p_household and p.account_id = p_account and p.deleted_at is null
         )
      or exists (
           select 1 from public.transactions t
            where t.account_id = p_account and t.deleted_at is null
         )
      or exists (
           select 1 from public.transactions t
            where t.to_account_id = p_account and t.deleted_at is null
         )
$$;

create or replace function private.debt_in_use(p_household uuid, p_debt uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
           select 1 from public.recurring_rules r
            where r.household_id = p_household and r.debt_id = p_debt and r.deleted_at is null
         )
      or exists (
           select 1 from public.planned_items p
            where p.household_id = p_household and p.debt_id = p_debt and p.deleted_at is null
         )
      or exists (
           select 1 from public.transactions t
            where t.debt_id = p_debt and t.deleted_at is null
         )
$$;

-- ─── Validate triggerlari ──────────────────────────────────────────────────
-- Hisob: E06 qoidalari + BR-026 (amali yoki bog'langan maqsadi bor hisob
-- valyutasi o'zgarmaydi — summalar shu valyutada).
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
  if new.currency is distinct from old.currency
     and (exists (select 1 from public.transactions t where t.account_id = old.id)
          or exists (select 1 from public.transactions t where t.to_account_id = old.id)
          or exists (
               select 1 from public.goals g
                where g.household_id = old.household_id and g.account_id = old.id and g.deleted_at is null
             )) then
    raise exception 'account_currency_locked' using errcode = 'P0001';
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

-- Qarz: bog'langan tirik yozuvlari bor qarz o'chirilmaydi (arxivlanadi).
create or replace function private.validate_debt()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.deleted_at is null and new.deleted_at is not null
     and private.debt_in_use(old.household_id, old.id) then
    raise exception 'debt_in_use' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- Oy rejasi: havolalar, to'langanlik holati (BR-071, BR-073), oy qulfi.
create or replace function private.validate_planned_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_new boolean := tg_op = 'INSERT' or old.deleted_at is not null;
begin
  if tg_op = 'UPDATE' and old.deleted_at is null and new.deleted_at is not null then
    perform private.assert_month_writable(old.household_id, old.budget_month);
    -- To'lovlar haqiqiy: to'lovi bor reja o'chirilmaydi — o'tkazib yuboriladi.
    if exists (
      select 1 from public.transactions t
       where t.planned_item_id = old.id and t.deleted_at is null
    ) then
      raise exception 'planned_in_use' using errcode = 'P0001';
    end if;
    return new;
  end if;
  if new.deleted_at is not null then
    return new;
  end if;
  if not v_is_new then
    perform private.assert_month_writable(old.household_id, old.budget_month);
  end if;

  if v_is_new or (new.category_id, new.account_id, new.debt_id)
                 is distinct from (old.category_id, old.account_id, old.debt_id) then
    if new.category_id is not null and new.kind <> 'allocation' then
      perform private.assert_category(new.household_id, new.category_id, new.kind::text::public.category_kind);
    end if;
    -- Reja — byudjet bandi: 👤 fond hisobi rejada qatnashmaydi (BR-061, BR-062).
    if new.account_id is not null
       and private.assert_account(new.household_id, new.account_id) = 'personal_fund' then
      raise exception 'invalid_account' using errcode = 'P0001';
    end if;
    if new.debt_id is not null then
      perform private.assert_debt(new.household_id, new.debt_id, new.kind::text, null);
    end if;
  end if;

  -- To'landi: to'liq to'lov, summasiz rejaga to'lov yoki qo'lda yopish.
  -- To'lov o'chirilsa (paid_amount kamaysa) holat qaytadi.
  new.settled_at := case
    when new.closed_at is not null
      or (new.planned_amount is null and new.paid_amount > 0)
      or new.paid_amount >= new.planned_amount
      then coalesce(old.settled_at, now())
  end;

  if v_is_new or new.budget_month is distinct from old.budget_month then
    perform private.assert_month_writable(new.household_id, new.budget_month);
  end if;
  return new;
end;
$$;

-- Amal: havolalar, hosila maydonlar (to_amount, budget_month, amount_base),
-- oy qulfi.
create or replace function private.validate_transaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_new boolean := tg_op = 'INSERT' or old.deleted_at is not null;
  v_account_type public.account_type;
  v_account_currency text;
  v_account_deleted timestamptz;
  v_to_type public.account_type;
  v_to_currency text;
  v_to_deleted timestamptz;
  v_plan_kind public.plan_kind;
  v_plan_month date;
  v_plan_debt uuid;
  v_plan_skipped timestamptz;
  v_plan_deleted timestamptz;
  v_base text;
  v_rate numeric;
begin
  -- O'chirish: faqat oy qulfi; tombstone boshqa tekshirilmaydi.
  if tg_op = 'UPDATE' and old.deleted_at is null and new.deleted_at is not null then
    perform private.assert_month_writable(old.household_id, old.budget_month);
    return new;
  end if;
  if new.deleted_at is not null then
    return new;
  end if;
  if not v_is_new then
    perform private.assert_month_writable(old.household_id, old.budget_month);
  end if;

  select a.type, a.currency, a.deleted_at into v_account_type, v_account_currency, v_account_deleted
    from public.accounts a
   where a.household_id = new.household_id and a.id = new.account_id;
  if not found then
    return new; -- xatoni kompozit FK beradi
  end if;
  if new.kind = 'transfer' then
    select a.type, a.currency, a.deleted_at into v_to_type, v_to_currency, v_to_deleted
      from public.accounts a
     where a.household_id = new.household_id and a.id = new.to_account_id;
  end if;
  if new.planned_item_id is not null then
    select p.kind, p.budget_month, p.debt_id, p.skipped_at, p.deleted_at
      into v_plan_kind, v_plan_month, v_plan_debt, v_plan_skipped, v_plan_deleted
      from public.planned_items p
     where p.household_id = new.household_id and p.id = new.planned_item_id;
  end if;

  -- ─ Havolalar: yangi qator yoki havola o'zgarganda ─
  if v_is_new or (new.kind, new.account_id, new.to_account_id, new.category_id, new.planned_item_id, new.debt_id)
                 is distinct from (old.kind, old.account_id, old.to_account_id, old.category_id, old.planned_item_id, old.debt_id) then
    if v_account_deleted is not null or v_to_deleted is not null then
      raise exception 'account_deleted' using errcode = 'P0001';
    end if;
    -- BR-063: fondga faqat ajratma (o'tkazma) tushadi — daromad byudjet hisoblariga.
    if new.kind = 'income' and v_account_type = 'personal_fund' then
      raise exception 'invalid_account' using errcode = 'P0001';
    end if;
    -- BR-062: fonddan sarf kategoriyasiz kiritilsa — "O'zim uchun".
    if new.kind = 'expense' and new.category_id is null and v_account_type = 'personal_fund' then
      select c.id into new.category_id
        from public.categories c
       where c.household_id = new.household_id and c.system_code = 'personal_allocation';
    end if;
    if new.kind <> 'transfer' and new.category_id is not null then
      perform private.assert_category(new.household_id, new.category_id, new.kind::text::public.category_kind);
    end if;
    if v_plan_kind is not null then
      if v_plan_deleted is not null then
        raise exception 'planned_deleted' using errcode = 'P0001';
      end if;
      if v_plan_skipped is not null then
        raise exception 'planned_skipped' using errcode = 'P0001';
      end if;
      -- Reja ↔ amal: xarajat ↔ byudjet hisobidan xarajat, daromad ↔ daromad,
      -- ajratma ↔ byudjet hisobidan fondga o'tkazma (BR-061).
      if not ((v_plan_kind = 'expense' and new.kind = 'expense' and v_account_type <> 'personal_fund')
              or (v_plan_kind = 'income' and new.kind = 'income')
              or (v_plan_kind = 'allocation' and new.kind = 'transfer'
                  and v_account_type <> 'personal_fund' and v_to_type = 'personal_fund')) then
        raise exception 'planned_kind_mismatch' using errcode = 'P0001';
      end if;
      -- BR-111: qarzga bog'langan rejaning to'lovi qarzga ham bog'lanadi.
      new.debt_id := coalesce(new.debt_id, v_plan_debt);
    end if;
    if new.debt_id is not null then
      perform private.assert_debt(new.household_id, new.debt_id, new.kind::text, v_account_currency);
    end if;
  end if;

  -- ─ O'tkazma summasi (BR-193): bir valyutada = amount ─
  if new.kind = 'transfer' and v_to_currency is not null then
    if v_to_currency = v_account_currency then
      new.to_amount := new.amount;
    elsif new.to_amount is null then
      raise exception 'to_amount_required' using errcode = 'P0001';
    end if;
  end if;

  -- ─ Tegishli oy (BR-040..046, BR-065) ─ faqat kirishlar o'zgarganda: siljish
  -- keyin o'zgarsa eski yozuvlar faqat qayta joylash RPC'si bilan ko'chadi
  -- (BR-043), masalan izoh tahriri bilan emas.
  if new.budget_month_source = 'auto'
     and (v_is_new or (new.kind, new.category_id, new.occurred_on, new.planned_item_id, new.budget_month_source, new.budget_month)
                      is distinct from (old.kind, old.category_id, old.occurred_on, old.planned_item_id, old.budget_month_source, old.budget_month)) then
    new.budget_month := case
      when v_plan_month is not null then v_plan_month
      -- BR-040: sana oyi + kategoriya siljishi (qoida topilmasa 0).
      when new.kind = 'income' then (
        date_trunc('month', new.occurred_on::timestamp)
        + make_interval(months => coalesce((
            select c.month_shift from public.categories c
             where c.household_id = new.household_id and c.id = new.category_id
          ), 0))
      )::date
      else date_trunc('month', new.occurred_on::timestamp)::date
    end;
  end if;

  -- ─ Asosiy valyutadagi summa (ADR-08, BR-191) ─ kirishlar o'zgarganda.
  if v_is_new or (new.amount, new.fx_rate, new.account_id, new.occurred_on)
                 is distinct from (old.amount, old.fx_rate, old.account_id, old.occurred_on) then
    select h.base_currency into v_base from public.households h where h.id = new.household_id;
    if v_account_currency = v_base then
      new.fx_rate := null;
      new.amount_base := new.amount;
    else
      v_rate := coalesce(new.fx_rate, private.fx_rate(v_account_currency, v_base, new.occurred_on));
      if v_rate is null then
        raise exception 'fx_rate_missing' using errcode = 'P0001';
      end if;
      new.fx_rate := v_rate;
      new.amount_base := private.to_base_amount(new.amount, v_account_currency, v_base, v_rate);
    end if;
  end if;

  if v_is_new or new.budget_month is distinct from old.budget_month then
    perform private.assert_month_writable(new.household_id, new.budget_month);
  end if;
  return new;
end;
$$;

-- Amal tegi: o'chirilgan tegga yangi bog'lanish yo'q.
create or replace function private.validate_transaction_tag()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.deleted_at is null and (tg_op = 'INSERT' or old.deleted_at is not null)
     and exists (
       select 1 from public.tags g
        where g.household_id = new.household_id and g.id = new.tag_id and g.deleted_at is not null
     ) then
    raise exception 'tag_deleted' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- Audit: trigger hisoblaydigan maydonlar (to'langan summa, to'langanlik)
-- o'zgarishi shovqin — faqat foydalanuvchi o'zgartirgan maydonlar yoziladi.
create or replace function private.audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_after  jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_ref    jsonb := coalesce(v_after, v_before);
  v_old    jsonb;
  v_new    jsonb;
begin
  if current_setting('app.skip_audit', true) = 'on' then
    return null;
  end if;

  if tg_op = 'UPDATE' then
    select jsonb_object_agg(a.key, a.value)
      into v_new
      from jsonb_each(v_after) as a
     where a.key not in ('row_version', 'updated_at', 'paid_amount', 'settled_at')
       and a.value is distinct from v_before -> a.key;

    if v_new is null then
      return null;
    end if;

    select jsonb_object_agg(k.key, v_before -> k.key)
      into v_old
      from jsonb_object_keys(v_new) as k(key);
  else
    v_old := v_before;
    v_new := v_after;
  end if;

  insert into public.audit_log (household_id, actor_id, table_name, record_id, action, old_values, new_values)
  values (
    coalesce(
      (v_ref ->> 'household_id')::uuid,
      case when tg_table_name = 'households' then (v_ref ->> 'id')::uuid end
    ),
    auth.uid(),
    tg_table_name,
    coalesce(v_ref ->> 'id', v_ref ->> 'user_id'),
    lower(tg_op),
    v_old,
    v_new
  );
  return null;
end;
$$;

-- ─── Triggerlar ────────────────────────────────────────────────────────────
-- Amallar, rejalar va teglar — eng ko'p yoziladigan jadvallar: auditga
-- tahrir va o'chirish tushadi (BR-008); yaratilishi created_by/created_at da.
create trigger debts_validate before update on public.debts
  for each row execute function private.validate_debt();

create trigger planned_items_touch before insert or update on public.planned_items
  for each row execute function private.touch_synced_row();
create trigger planned_items_validate before insert or update on public.planned_items
  for each row execute function private.validate_planned_item();
create trigger planned_items_audit after update or delete on public.planned_items
  for each row execute function private.audit();

create trigger transactions_touch before insert or update on public.transactions
  for each row execute function private.touch_synced_row();
create trigger transactions_validate before insert or update on public.transactions
  for each row execute function private.validate_transaction();
create trigger transactions_audit after update or delete on public.transactions
  for each row execute function private.audit();

create trigger transaction_tags_touch before insert or update on public.transaction_tags
  for each row execute function private.touch_synced_row();
create trigger transaction_tags_validate before insert or update on public.transaction_tags
  for each row execute function private.validate_transaction_tag();
create trigger transaction_tags_audit after update or delete on public.transaction_tags
  for each row execute function private.audit();

-- ─── RLS ───────────────────────────────────────────────────────────────────
-- O'qish — a'zolar; yozish — amal yozuvchilar (owner/admin/member, BR-011).
alter table public.planned_items enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_tags enable row level security;

create policy planned_items_select on public.planned_items for select to authenticated
  using (household_id in (select private.my_household_ids()));
create policy planned_items_insert on public.planned_items for insert to authenticated
  with check (household_id in (select private.my_writable_household_ids()));
create policy planned_items_update on public.planned_items for update to authenticated
  using (household_id in (select private.my_writable_household_ids()))
  with check (household_id in (select private.my_writable_household_ids()));

create policy transactions_select on public.transactions for select to authenticated
  using (household_id in (select private.my_household_ids()));
create policy transactions_insert on public.transactions for insert to authenticated
  with check (household_id in (select private.my_writable_household_ids()));
create policy transactions_update on public.transactions for update to authenticated
  using (household_id in (select private.my_writable_household_ids()))
  with check (household_id in (select private.my_writable_household_ids()));

create policy transaction_tags_select on public.transaction_tags for select to authenticated
  using (household_id in (select private.my_household_ids()));
create policy transaction_tags_insert on public.transaction_tags for insert to authenticated
  with check (household_id in (select private.my_writable_household_ids()));
create policy transaction_tags_update on public.transaction_tags for update to authenticated
  using (household_id in (select private.my_writable_household_ids()))
  with check (household_id in (select private.my_writable_household_ids()));

-- ─── Ustun huquqlari ───────────────────────────────────────────────────────
-- Hosila maydonlar (paid_amount, settled_at, amount_base), tizim rejasi
-- (system_code) va reja turi klientdan yozilmaydi.
revoke all on public.planned_items, public.transactions, public.transaction_tags from authenticated;
grant select on public.planned_items, public.transactions, public.transaction_tags to authenticated;

grant insert (id, household_id, kind, name, category_id, account_id, planned_amount, due_date, budget_month,
              auto_pay, debt_id, recurring_rule_id, note),
  update (name, category_id, account_id, planned_amount, due_date, budget_month,
          auto_pay, debt_id, note, closed_at, skipped_at, deleted_at)
  on public.planned_items to authenticated;

grant insert (id, household_id, kind, account_id, to_account_id, amount, to_amount, fx_rate, category_id, payee,
              occurred_on, budget_month, budget_month_source, planned_item_id, debt_id, note, source),
  update (kind, account_id, to_account_id, amount, to_amount, fx_rate, category_id, payee,
          occurred_on, budget_month, budget_month_source, planned_item_id, debt_id, note, deleted_at)
  on public.transactions to authenticated;

grant insert (id, household_id, transaction_id, tag_id), update (deleted_at)
  on public.transaction_tags to authenticated;
