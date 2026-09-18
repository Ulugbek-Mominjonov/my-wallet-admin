-- E07-T01: qarzlar, maqsadlar, oylar; doimiy reja → qarz bog'lanishi.
-- Qoidalar: BR-110..118, BR-120..123, BR-150..152, BR-194; ADR-04.
-- Tuzilma E06 bilan bir xil: kompozit FK, `_touch` → `_validate` → `_audit`,
-- soft delete, ustun grant'lari.

create type public.debt_direction as enum ('i_owe', 'owed_to_me');

-- Izoh — ixtiyoriy erkin matn.
create domain public.note_text as text check (char_length(value) <= 1000);

-- ─── Qarzlar (BR-110) ──────────────────────────────────────────────────────
create table public.debts (
  id              uuid primary key default private.uuid_v7(),
  household_id    uuid not null references public.households (id) on delete cascade,
  name            public.entity_name not null,
  -- i_owe — men qarzdorman (xarajatlar bog'lanadi); owed_to_me — menga qarzdor
  -- (daromadlar bog'lanadi) — BR-111. Yaratilgandan keyin o'zgarmaydi.
  direction       public.debt_direction not null,
  -- BR-194: qarz o'z valyutasida; bog'langan amallar shu valyutada bo'ladi.
  currency        text not null references public.currencies (code),
  total           bigint not null check (total > 0),
  -- Ilovadan tashqarida (oldin) to'langan qism.
  paid_before     bigint not null default 0 check (paid_before >= 0),
  monthly_payment bigint check (monthly_payment > 0),
  due_date        date,
  note            public.note_text,
  archived_at     timestamptz,
  created_by      uuid default auth.uid() references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  row_version     bigint not null default 0,
  unique (household_id, id),
  check (paid_before <= total)
);

comment on table public.debts is 'BR-110: qarzlar va haqlar; bog''lanish faqat debt_id orqali (BR-111).';

create unique index debts_name_key on public.debts (household_id, lower(name))
  where deleted_at is null;

-- ─── Maqsadlar (BR-120) ────────────────────────────────────────────────────
create table public.goals (
  id                   uuid primary key default private.uuid_v7(),
  household_id         uuid not null references public.households (id) on delete cascade,
  name                 public.entity_name not null,
  currency             text not null references public.currencies (code),
  target               bigint not null check (target > 0),
  -- BR-122: hisobga bog'lanmagan maqsadda yig'ilgan summa qo'lda kiritiladi.
  saved_manual         bigint not null default 0 check (saved_manual >= 0),
  monthly_contribution bigint check (monthly_contribution > 0),
  deadline             public.month_start,
  -- BR-122: bog'langan bo'lsa yig'ilgan = hisob qoldig'i (valyutalar bir xil).
  account_id           uuid,
  sort_order           integer not null default 0,
  achieved_at          timestamptz,
  created_by           uuid default auth.uid() references auth.users (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  deleted_at           timestamptz,
  row_version          bigint not null default 0,
  foreign key (household_id, account_id) references public.accounts (household_id, id)
);

comment on table public.goals is 'BR-120: jamg''arma maqsadlari (qo''lda yoki hisob qoldig''i bo''yicha).';

create unique index goals_name_key on public.goals (household_id, lower(name))
  where deleted_at is null;

-- ─── Oylar (BR-150) ────────────────────────────────────────────────────────
-- Faqat ochilgan/yopilgan oylar uchun qator. Yozish — faqat RPC orqali
-- (open_month, set_month_closed — E08).
create table public.months (
  household_id uuid not null references public.households (id) on delete cascade,
  month        public.month_start not null,
  -- BR-081: doimiy rejalardan shu oy rejalari yaratilgan vaqt.
  opened_at    timestamptz,
  -- BR-150: yopilgan oy (strict_month_lock bo'lsa yozuv taqiqlanadi — BR-055).
  closed_at    timestamptz,
  closed_by    uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  row_version  bigint not null default 0,
  primary key (household_id, month)
);

comment on table public.months is 'BR-150: oy holati — ochilgan (rejalar yaratilgan) va yopilgan.';

-- ─── Doimiy reja → qarz (BR-111) ───────────────────────────────────────────
alter table public.recurring_rules
  -- squawk-ignore adding-foreign-key-constraint, constraint-missing-not-valid
  add constraint recurring_rules_debt_fkey foreign key (household_id, debt_id) references public.debts (household_id, id);

-- ─── Sinxron indekslari ────────────────────────────────────────────────────
create index debts_sync_idx on public.debts (household_id, row_version);
create index goals_sync_idx on public.goals (household_id, row_version);
create index months_sync_idx on public.months (household_id, row_version);

-- ─── Tekshiruvlar ──────────────────────────────────────────────────────────
-- Qarz havolasi: o'chirilmagan, yo'nalishi amal turiga mos (i_owe ← xarajat,
-- owed_to_me ← daromad), valyutasi mos (p_currency NULL bo'lsa — tekshirilmaydi).
create or replace function private.assert_debt(
  p_household uuid,
  p_debt uuid,
  p_kind text,
  p_currency text
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_direction public.debt_direction;
  v_currency text;
  v_deleted_at timestamptz;
begin
  select d.direction, d.currency, d.deleted_at into v_direction, v_currency, v_deleted_at
    from public.debts d
   where d.household_id = p_household and d.id = p_debt;
  if not found then
    return;
  end if;
  if v_deleted_at is not null then
    raise exception 'debt_deleted' using errcode = 'P0001';
  end if;
  if (v_direction = 'i_owe' and p_kind <> 'expense')
     or (v_direction = 'owed_to_me' and p_kind <> 'income') then
    raise exception 'debt_kind_mismatch' using errcode = 'P0001';
  end if;
  if p_currency is not null and p_currency <> v_currency then
    raise exception 'currency_mismatch' using errcode = 'P0001';
  end if;
end;
$$;

-- Doimiy reja: E06 tekshiruvlari + qarz bog'lanishi (BR-111).
create or replace function private.validate_recurring_rule()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.deleted_at is not null
     or (tg_op = 'UPDATE' and old.deleted_at is null
         and (new.kind, new.category_id, new.account_id, new.debt_id)
             is not distinct from (old.kind, old.category_id, old.account_id, old.debt_id)) then
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
  if new.debt_id is not null then
    perform private.assert_debt(new.household_id, new.debt_id, new.kind::text, null);
  end if;
  return new;
end;
$$;

-- Maqsad: bog'langan hisob tirik va valyutasi maqsadniki bilan bir xil.
create or replace function private.validate_goal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.account_id is null or new.deleted_at is not null
     or (tg_op = 'UPDATE' and old.deleted_at is null and new.account_id is not distinct from old.account_id) then
    return new;
  end if;
  perform private.assert_account(new.household_id, new.account_id);
  if exists (
    select 1 from public.accounts a
     where a.household_id = new.household_id and a.id = new.account_id and a.currency <> new.currency
  ) then
    raise exception 'currency_mismatch' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- ─── Triggerlar ────────────────────────────────────────────────────────────
-- debts_validate (ishlatilayotgan qarz o'chirilmaydi) — amallar jadvali bilan
-- birga keyingi migratsiyada.
create trigger debts_touch before insert or update on public.debts
  for each row execute function private.touch_synced_row();
create trigger debts_audit after insert or update or delete on public.debts
  for each row execute function private.audit();

create trigger goals_touch before insert or update on public.goals
  for each row execute function private.touch_synced_row();
create trigger goals_validate before insert or update on public.goals
  for each row execute function private.validate_goal();
create trigger goals_audit after insert or update or delete on public.goals
  for each row execute function private.audit();

create trigger months_touch before insert or update on public.months
  for each row execute function private.touch_synced_row();
create trigger months_audit after insert or update or delete on public.months
  for each row execute function private.audit();

-- ─── RLS ───────────────────────────────────────────────────────────────────
-- Qarz va maqsad — amal yozuvchilar (owner/admin/member) yuritadi; oylar —
-- faqat RPC orqali (BR-150: yopish — owner/admin).
alter table public.debts enable row level security;
alter table public.goals enable row level security;
alter table public.months enable row level security;

create policy debts_select on public.debts for select to authenticated
  using (household_id in (select private.my_household_ids()));
create policy debts_insert on public.debts for insert to authenticated
  with check (household_id in (select private.my_writable_household_ids()));
create policy debts_update on public.debts for update to authenticated
  using (household_id in (select private.my_writable_household_ids()))
  with check (household_id in (select private.my_writable_household_ids()));

create policy goals_select on public.goals for select to authenticated
  using (household_id in (select private.my_household_ids()));
create policy goals_insert on public.goals for insert to authenticated
  with check (household_id in (select private.my_writable_household_ids()));
create policy goals_update on public.goals for update to authenticated
  using (household_id in (select private.my_writable_household_ids()))
  with check (household_id in (select private.my_writable_household_ids()));

create policy months_select on public.months for select to authenticated
  using (household_id in (select private.my_household_ids()));

-- ─── Ustun huquqlari ───────────────────────────────────────────────────────
-- O'zgarmaydi: qarz yo'nalishi va valyutasi, maqsad valyutasi (bog'langan
-- amallar/hisob shunga tayanadi).
revoke all on public.debts, public.goals, public.months from authenticated;
grant select on public.debts, public.goals, public.months to authenticated;

grant insert (id, household_id, name, direction, currency, total, paid_before, monthly_payment, due_date, note),
  update (name, total, paid_before, monthly_payment, due_date, note, archived_at, deleted_at)
  on public.debts to authenticated;

grant insert (id, household_id, name, currency, target, saved_manual, monthly_contribution, deadline, account_id, sort_order),
  update (name, target, saved_manual, monthly_contribution, deadline, account_id, sort_order, achieved_at, deleted_at)
  on public.goals to authenticated;

grant insert (debt_id), update (debt_id) on public.recurring_rules to authenticated;
