-- E07-T10: chek rasmlari — `receipts` bucket (private), attachments jadvali,
-- amal o'chirilganda fayllar o'chirish navbatiga tushadi. Qoidalar: BR-054, BR-201.
--
-- Fayl yo'li: {household_id}/{transaction_id}/{uuid}.{jpg|png|webp}.
-- Rasm qurilmada ≤ 1 MB gacha siqiladi (BR-201) — bucket limiti ham shu.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 1048576, array['image/jpeg', 'image/png', 'image/webp']);

-- ─── Storage RLS: yo'lning birinchi bo'lagi — a'zo bo'lgan byudjet ─────────
create policy receipts_select on storage.objects for select to authenticated
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] in (select h::text from private.my_household_ids() as h)
  );
create policy receipts_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] in (select h::text from private.my_writable_household_ids() as h)
  );
create policy receipts_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] in (select h::text from private.my_writable_household_ids() as h)
  );

-- ─── Biriktirmalar ─────────────────────────────────────────────────────────
create table public.attachments (
  id             uuid primary key default private.uuid_v7(),
  household_id   uuid not null references public.households (id) on delete cascade,
  transaction_id uuid not null,
  storage_path   text not null unique,
  mime           text not null check (mime in ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes     integer not null check (size_bytes between 1 and 1048576),
  created_by     uuid default auth.uid() references auth.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- O'chirilgan biriktirma = fayl o'chirish navbati: undo muddatidan keyin
  -- tozalash ishi faylni Storage API orqali o'chiradi (E11).
  deleted_at     timestamptz,
  row_version    bigint not null default 0,
  foreign key (household_id, transaction_id) references public.transactions (household_id, id) on delete cascade,
  -- Yo'l shu byudjet va shu amalga tegishli.
  check (storage_path like household_id::text || '/' || transaction_id::text || '/%')
);

comment on table public.attachments is 'BR-201: amal cheklari (fayl — receipts bucket).';

create index attachments_sync_idx on public.attachments (household_id, row_version);
create index attachments_transaction_idx on public.attachments (transaction_id);
-- Fayl o'chirish navbati (E11 tozalash ishi).
create index attachments_deleted_idx on public.attachments (deleted_at)
  where deleted_at is not null;

-- ─── Amal o'chirilsa/tiklansa — biriktirmalari ham ─────────────────────────
-- Undo (BR-009): amal bilan bir vaqtda o'chirilganlar birga qaytadi.
create or replace function private.cascade_attachments()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.deleted_at is not null then
    update public.attachments
       set deleted_at = new.deleted_at
     where transaction_id = new.id and deleted_at is null;
  else
    update public.attachments
       set deleted_at = null
     where transaction_id = new.id and deleted_at = old.deleted_at;
  end if;
  return null;
end;
$$;

create trigger transactions_attachments after update of deleted_at on public.transactions
  for each row
  when (old.deleted_at is distinct from new.deleted_at)
  execute function private.cascade_attachments();

create trigger attachments_touch before insert or update on public.attachments
  for each row execute function private.touch_synced_row();
create trigger attachments_audit after update or delete on public.attachments
  for each row execute function private.audit();

-- ─── RLS ───────────────────────────────────────────────────────────────────
alter table public.attachments enable row level security;

create policy attachments_select on public.attachments for select to authenticated
  using (household_id in (select private.my_household_ids()));
create policy attachments_insert on public.attachments for insert to authenticated
  with check (household_id in (select private.my_writable_household_ids()));
create policy attachments_update on public.attachments for update to authenticated
  using (household_id in (select private.my_writable_household_ids()))
  with check (household_id in (select private.my_writable_household_ids()));

revoke all on public.attachments from authenticated;
grant select on public.attachments to authenticated;
grant insert (id, household_id, transaction_id, storage_path, mime, size_bytes), update (deleted_at)
  on public.attachments to authenticated;
