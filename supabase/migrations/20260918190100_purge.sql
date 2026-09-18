-- E10-T05: tozalash — 90 kunlik tombstone'lar, 180 kunlik audit (BR-008),
-- 30 kunlik sinxron jurnali. pg_cron jadvali — E11-T07; natija job_runs ga — E11.
--
-- Tombstone'lar bolalardan otalarga o'chiriladi. Hali havola qilinayotgan
-- qator (masalan, yaqinda o'chirilgan amal hali eski rejaga havola qiladi)
-- o'tkazib yuboriladi va natijada `skipped` sifatida ko'rinadi — keyingi
-- ishga tushishda o'chadi. Cheklar (attachments) — fayl bilan birga E11 ishida.

-- Saqlash muddatlari (kun).
create or replace function private.tombstone_retention_days()
returns integer language sql immutable set search_path = '' as $$ select 90 $$;
create or replace function private.audit_retention_days()
returns integer language sql immutable set search_path = '' as $$ select 180 $$;
create or replace function private.sync_journal_retention_days()
returns integer language sql immutable set search_path = '' as $$ select 30 $$;
-- Bitta ishga tushishda jadval boshiga eng ko'p o'chiriladigan tombstone.
create or replace function private.purge_batch_size()
returns integer language sql immutable set search_path = '' as $$ select 5000 $$;

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
    'transaction_tags', 'transactions', 'planned_items', 'category_limits', 'quick_actions',
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

-- Qidiruv indeksi: tozalash faqat eski tombstone'larni ko'radi.
create index transactions_tombstone_idx on public.transactions (deleted_at) where deleted_at is not null;
create index planned_items_tombstone_idx on public.planned_items (deleted_at) where deleted_at is not null;
create index sync_mutations_applied_idx on public.sync_mutations (applied_at);
create index audit_log_at_idx on public.audit_log (at);
