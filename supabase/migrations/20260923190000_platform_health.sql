-- E26-T05: tizim salomatligi sahifasi — rejali ishlar, bepul reja
-- chegaralari (ARXITEKTURA 1) va bildirishnoma navbati bir so'rovda.
--
-- Chegaralar `private.db_size_limit_bytes()` / `storage_size_limit_bytes()`
-- dan; ogohlantirish chegarasi — `private.stats_warn_pct()` (70%).
create or replace function private.stats_warn_pct()
returns numeric language sql immutable set search_path = '' as $$ select 70::numeric $$;

create or replace function public.platform_health()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not (select private.is_platform_admin()) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;

  select jsonb_build_object(
    'stats', jobs.platform_stats(),
    'limits', jsonb_build_object(
      'db_bytes', private.db_size_limit_bytes(),
      'storage_bytes', private.storage_size_limit_bytes(),
      'warn_pct', private.stats_warn_pct()),
    'jobs', (
      select coalesce(jsonb_agg(to_jsonb(j) order by j.job), '[]'::jsonb)
        from (
          select distinct on (r.job)
                 r.job, r.started_at, r.finished_at, r.status,
                 -- Xatoda sabab; muvaffaqiyatda natija (qisqa jsonb).
                 r.details
            from public.job_runs r
           order by r.job, r.started_at desc
        ) j
    ),
    'outbox', (
      select jsonb_build_object(
               'pending', count(*) filter (where o.status = 'pending'),
               'sending', count(*) filter (where o.status = 'sending'),
               'failed', count(*) filter (where o.status = 'failed'),
               'sent', count(*) filter (where o.status = 'sent'),
               'oldest_pending', min(o.created_at) filter (where o.status = 'pending'))
        from public.notification_outbox o
    )
  ) into v_result;
  return v_result;
end;
$$;

grant execute on function public.platform_health() to authenticated;
