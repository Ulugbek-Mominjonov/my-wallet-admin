-- E25-T07: byudjet a'zolarining qurilmalari va sinxron holati.
--
-- `device_tokens` RLS'da faqat o'ziniki (push tokeni — shaxsiy), shuning
-- uchun owner/admin uchun alohida funksiya: token qaytmaydi, faqat platforma,
-- ilova versiyasi va oxirgi ko'rinish vaqti.
--
-- Sinxron holati `sync_mutations` dan (qurilma bo'yicha): oxirgi sinxron va
-- to'qnashuv/rad etish sonlari — `sync_mutations_household_idx` bo'yicha.
create or replace function public.household_devices(p_household uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if p_household not in (select private.my_admin_household_ids()) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;

  select jsonb_build_object(
    'devices', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'user_id', d.user_id,
               'platform', d.platform,
               'app_version', d.app_version,
               'last_seen_at', d.last_seen_at)
             order by d.last_seen_at desc), '[]'::jsonb)
        from public.device_tokens d
        join public.household_members m
          on m.user_id = d.user_id and m.household_id = p_household
    ),
    'sync', (
      select coalesce(jsonb_agg(to_jsonb(s) order by s.last_sync_at desc), '[]'::jsonb)
        from (
          select x.user_id, x.device_id,
                 max(x.applied_at) as last_sync_at,
                 count(*) filter (where x.status = 'ok') as ok,
                 count(*) filter (where x.status = 'conflict') as conflicts,
                 count(*) filter (where x.status = 'rejected') as rejected
            from public.sync_mutations x
           where x.household_id = p_household
           group by x.user_id, x.device_id
        ) s
    )
  ) into v_result;
  return v_result;
end;
$$;

grant execute on function public.household_devices(uuid) to authenticated;
