-- E11-T07: rejali ishlar (pg_cron, ARXITEKTURA 7) — Edge Function chaqiruvlari,
-- tozalash, jadval. Har ish `jobs.run` orqali `job_runs` ga yoziladi.
--
-- Sirlar repoda yo'q: Edge Function manzili va umumiy sir — Supabase Vault'da
-- (`edge_functions_url`, `cron_secret`; deploy yozadi — DEPLOY.md 9). Vault bo'sh
-- bo'lsa (lokal/CI) chaqiruvlar "sozlanmagan" deb o'tkaziladi.

-- Deploy Vault'ga yozadi (qayta deployda yangilanadi). Faqat postgres
-- (Management API) chaqiradi — ilova rollariga grant yo'q.
create or replace function private.upsert_vault_secret(p_name text, p_value text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select s.id into v_id from vault.secrets s where s.name = p_name;
  if v_id is null then
    perform vault.create_secret(p_value, p_name);
  else
    perform vault.update_secret(v_id, p_value);
  end if;
end;
$$;

-- Edge Function chaqiruvi pg_net orqali (asinxron), manzil va sir — Vault'da.
create or replace function jobs.call_edge_function(p_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
  v_request bigint;
begin
  select max(s.decrypted_secret) filter (where s.name = 'edge_functions_url'),
         max(s.decrypted_secret) filter (where s.name = 'cron_secret')
    into v_url, v_secret
    from vault.decrypted_secrets s
   where s.name in ('edge_functions_url', 'cron_secret');
  if v_url is null or v_secret is null then
    return jsonb_build_object('skipped', 'not_configured');
  end if;
  select net.http_post(
           url := rtrim(v_url, '/') || '/' || p_name,
           body := '{}'::jsonb,
           headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret)
         ) into v_request;
  return jsonb_build_object('request_id', v_request);
end;
$$;

-- ADR-11: navbat bo'sh bo'lsa HTTP chaqiruv yo'q (bepul limitlar tejaladi).
create or replace function jobs.dispatch_notifications()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.notification_outbox o where o.status = 'pending' and o.next_attempt_at <= now()
  ) then
    return jsonb_build_object('pending', 0);
  end if;
  return jobs.call_edge_function('notify-dispatch');
end;
$$;

-- Navbat tarixi 90 kun (BR-166), keyin o'chiriladi (tozalash ishi bilan).
create or replace function private.outbox_retention_days()
returns integer language sql immutable set search_path = '' as $$ select 90 $$;

create or replace function jobs.purge_outbox(p_now timestamptz default now())
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  delete from public.notification_outbox
   where created_at < p_now - make_interval(days => private.outbox_retention_days())
     and status in ('sent', 'failed', 'skipped');
  get diagnostics v_count = row_count;
  return jsonb_build_object('notification_outbox', v_count);
end;
$$;

-- Chek fayllari (200400): o'chiriladigan fayl bo'lmasa HTTP chaqiruv yo'q.
create or replace function jobs.purge_files()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if cardinality(public.receipt_files_to_delete(1)) = 0 then
    return jsonb_build_object('pending', 0);
  end if;
  return jobs.call_edge_function('purge-files');
end;
$$;

-- Bepul reja chegaralari monitoringi (ARXITEKTURA 1): kunlik tarix job_runs da,
-- E26-T05 "Tizim salomatligi" sahifasi shundan oladi. Qatorlar soni — statistika
-- bahosi (to'liq COUNT emas).
create or replace function private.db_size_limit_bytes()
returns bigint language sql immutable set search_path = '' as $$ select 500::bigint * 1024 * 1024 $$;
create or replace function private.storage_size_limit_bytes()
returns bigint language sql immutable set search_path = '' as $$ select 1024::bigint * 1024 * 1024 $$;
create or replace function private.stats_top_tables()
returns integer language sql immutable set search_path = '' as $$ select 10 $$;

create or replace function jobs.platform_stats()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with sizes as (
    select pg_database_size(current_database()) as db_bytes,
           (select coalesce(sum((o.metadata ->> 'size')::bigint), 0) from storage.objects o) as storage_bytes
  )
  select jsonb_build_object(
           'db_bytes', s.db_bytes,
           'db_limit_pct', round(100.0 * s.db_bytes / private.db_size_limit_bytes(), 1),
           'storage_bytes', s.storage_bytes,
           'storage_limit_pct', round(100.0 * s.storage_bytes / private.storage_size_limit_bytes(), 1),
           'users', (select count(*) from auth.users),
           'households', (select count(*) from public.households),
           'largest_tables', (
             select jsonb_agg(jsonb_build_object('table', t.relname, 'bytes', t.bytes, 'rows', t.estimated_rows)
                              order by t.bytes desc)
               from (select c.relname::text, pg_total_relation_size(c.oid) as bytes,
                            greatest(c.reltuples, 0)::bigint as estimated_rows
                       from pg_catalog.pg_class c
                       join pg_catalog.pg_namespace n on n.oid = c.relnamespace
                      where n.nspname = 'public' and c.relkind = 'r'
                      order by 2 desc
                      limit private.stats_top_tables()) t
           )
         )
    from sizes s
$$;

-- Har ish job_runs ga: boshlanish, tugash, natija yoki xato.
create or replace function jobs.run(p_job text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
  v_details jsonb;
begin
  insert into public.job_runs (job) values (p_job) returning id into v_id;
  begin
    v_details := case p_job
      when 'daily_sweep' then jobs.daily_sweep()
      when 'enqueue_reminders' then jobs.enqueue_reminders()
      when 'enqueue_monthly_reports' then jobs.enqueue_monthly_reports()
      when 'enqueue_income_missing' then jobs.enqueue_income_missing()
      when 'dispatch_notifications' then jobs.dispatch_notifications()
      when 'fx_sync' then jobs.call_edge_function('fx-sync')
      when 'purge' then jobs.purge() || jobs.purge_outbox()
      when 'purge_files' then jobs.purge_files()
      when 'platform_stats' then jobs.platform_stats()
    end;
    if v_details is null then
      raise exception 'unknown_job: %', p_job;
    end if;
    update public.job_runs set finished_at = now(), status = 'ok', details = v_details where id = v_id;
  exception when others then
    update public.job_runs
       set finished_at = now(), status = 'failed',
           details = jsonb_build_object('error', sqlerrm, 'sqlstate', sqlstate)
     where id = v_id;
  end;
end;
$$;

-- Jadval (UTC). Vaqt zonasi bo'yicha tanlov funksiyalarning o'zida.
select cron.schedule('daily_sweep', '5 * * * *', $$select jobs.run('daily_sweep')$$);
select cron.schedule('enqueue_reminders', '0 * * * *', $$select jobs.run('enqueue_reminders')$$);
select cron.schedule('enqueue_monthly_reports', '0 * * * *', $$select jobs.run('enqueue_monthly_reports')$$);
select cron.schedule('enqueue_income_missing', '0 * * * *', $$select jobs.run('enqueue_income_missing')$$);
select cron.schedule('notify_dispatch', '*/5 * * * *', $$select jobs.run('dispatch_notifications')$$);
select cron.schedule('fx_sync', '30 5 * * *', $$select jobs.run('fx_sync')$$);
select cron.schedule('purge', '30 22 * * *', $$select jobs.run('purge')$$);
select cron.schedule('purge_files', '45 22 * * *', $$select jobs.run('purge_files')$$);
select cron.schedule('platform_stats', '0 23 * * *', $$select jobs.run('platform_stats')$$);

