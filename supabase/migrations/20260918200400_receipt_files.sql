-- E11-T08: chek fayllarini tozalash (BR-201, BR-015). Storage'dagi faylni SQL
-- bilan o'chirib bo'lmaydi (`storage.protect_delete`) — `purge-files` Edge
-- Function Storage API orqali o'chiradi; bu yerda — nimani o'chirish kerakligi.
--
-- O'chiriladi:
--   1) byudjeti yo'q fayllar (byudjet yoki akkaunt o'chirilgan) — darhol;
--   2) biriktirmasi 7 kundan beri o'chirilgan fayllar (offline undo va
--      sinxron kechikishi uchun zaxira);
--   3) biriktirmasi umuman yo'q, 1 kundan eski fayllar (yuklangan, lekin
--      yozuvi kelmagan yoki tombstone tozalangan).

create or replace function private.receipt_retention_days()
returns integer language sql immutable set search_path = '' as $$ select 7 $$;
create or replace function private.receipt_orphan_grace()
returns interval language sql immutable set search_path = '' as $$ select interval '1 day' $$;
-- Storage API bitta so'rovda o'chiradigan eng ko'p fayl.
create or replace function private.receipt_delete_batch_max()
returns integer language sql immutable set search_path = '' as $$ select 1000 $$;

-- Yo'lning birinchi qismi — byudjet ID (RLS shuni talab qiladi). Noto'g'ri
-- ko'rinishdagi nom xato bermaydi — null (PK indeksi ishlatiladi).
create or replace function private.receipt_household(p_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when split_part(p_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then split_part(p_name, '/', 1)::uuid
  end
$$;

-- Faqat service_role (purge-files). `bucketid_objname` indeksi bo'yicha nom
-- tartibida — limitga yetganda to'xtaydi; har fayl uchun bitta indeks qidiruvi.
create or replace function public.receipt_files_to_delete(p_limit integer default 1000, p_now timestamptz default now())
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(f.name order by f.name), '{}')
    from (
      select o.name
        from storage.objects o
       where o.bucket_id = 'receipts'
         -- Tirik yoki yaqinda o'chirilgan biriktirma fayli — qoladi.
         and not exists (
           select 1 from public.attachments a
            where a.storage_path = o.name
              and (a.deleted_at is null
                   or a.deleted_at > p_now - make_interval(days => private.receipt_retention_days()))
         )
         and (
           -- 1) byudjeti yo'q;
           not exists (select 1 from public.households h where h.id = private.receipt_household(o.name))
           -- 2) biriktirmasi bor (demak, 7 kundan beri o'chirilgan; yo'l unique);
           or exists (select 1 from public.attachments a where a.storage_path = o.name)
           -- 3) yozuvsiz va yuklanganiga 1 kundan oshgan.
           or o.created_at < p_now - private.receipt_orphan_grace()
         )
       order by o.name
       limit least(greatest(p_limit, 1), private.receipt_delete_batch_max())
    ) f
$$;

revoke execute on function public.receipt_files_to_delete(integer, timestamptz) from authenticated, anon;
grant execute on function public.receipt_files_to_delete(integer, timestamptz) to service_role;

-- ─── Biriktirma tombstone'lari ham tozalanadi ──────────────────────────────
-- E10 dagi `jobs.purge` + `attachments` (amaldan oldin — bolalardan otalarga).
-- Aks holda amal bilan kaskadda o'chib, `purged_version` biriktirmaning
-- versiyasini hisobga olmay qolardi. Fayl bu vaqtgacha allaqachon o'chgan (7 kun).
create or replace function jobs.purge(p_now timestamptz default now())
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cutoff timestamptz := p_now - make_interval(days => private.tombstone_retention_days());
  v_table text;
  v_id uuid;
  v_household uuid;
  v_version bigint;
  v_deleted integer;
  v_skipped integer;
  v_result jsonb := '{}'::jsonb;
  v_count integer;
begin
  for v_table in select unnest(array[
    'attachments', 'transaction_tags', 'transactions', 'planned_items', 'category_limits', 'quick_actions',
    'recurring_rules', 'goals', 'debts', 'tags', 'categories', 'accounts'
  ]) loop
    v_deleted := 0;
    v_skipped := 0;
    for v_id, v_household, v_version in execute format(
      'select x.id, x.household_id, x.row_version from public.%I x
        where x.deleted_at < $1 order by x.deleted_at limit $2', v_table)
      using v_cutoff, private.purge_batch_size()
    loop
      begin
        execute format('delete from public.%I where id = $1', v_table) using v_id;
        update public.households set purged_version = greatest(purged_version, v_version)
         where id = v_household;
        v_deleted := v_deleted + 1;
      exception when foreign_key_violation then
        -- Hali havola qilinmoqda — keyingi safar (natijada hisoblanadi).
        v_skipped := v_skipped + 1;
      end;
    end loop;
    v_result := v_result || jsonb_build_object(v_table, jsonb_build_object('deleted', v_deleted, 'skipped', v_skipped));
  end loop;

  delete from public.audit_log
   where at < p_now - make_interval(days => private.audit_retention_days());
  get diagnostics v_count = row_count;
  v_result := v_result || jsonb_build_object('audit_log', v_count);

  delete from public.sync_mutations
   where applied_at < p_now - make_interval(days => private.sync_journal_retention_days());
  get diagnostics v_count = row_count;
  v_result := v_result || jsonb_build_object('sync_mutations', v_count);

  return v_result;
end;
$$;
