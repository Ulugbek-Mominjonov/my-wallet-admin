-- E26-T03: platforma e'loni — hamma yoki tanlangan foydalanuvchilarga.
--
-- Yuborishning o'zi — mavjud navbat (outbox → notify-dispatch), shuning
-- uchun alohida Edge Function shart emas: bu yerda faqat navbatga qo'yiladi.
-- Kanal foydalanuvchining sozlamasi bo'yicha (BR-163): o'chiq kanalga yoki
-- qurilmasi yo'qqa yozilmaydi.
create or replace function public.send_announcement(
  p_message jsonb,
  p_title jsonb default null,
  p_users uuid[] default null,
  p_channels text[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_channels text[] := coalesce(p_channels, array['push', 'telegram']);
  v_batch uuid := gen_random_uuid();
  v_queued integer;
  v_users integer;
begin
  if not (select private.is_platform_admin()) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  if p_message is null or not (p_message ?& array['uz', 'ru', 'en']) then
    raise exception 'invalid_message' using errcode = 'P0001';
  end if;
  if not (v_channels <@ array['push', 'telegram', 'email']) then
    raise exception 'invalid_channel' using errcode = 'P0001';
  end if;

  insert into public.notification_outbox (user_id, household_id, channel, type, payload, dedupe_key)
  select p.user_id, null, c.channel, 'announcement',
         jsonb_build_object('batch', v_batch, 'message', p_message,
                            'title', p_title, 'locale', p.locale),
         format('announcement:%s:%s:%s', v_batch, p.user_id, c.channel)
    from public.profiles p
    cross join unnest(v_channels) as c (channel)
   where (p_users is null or p.user_id = any (p_users))
     and private.channel_status(p.user_id, p.last_household_id, c.channel) = 'ok';
  get diagnostics v_queued = row_count;

  select count(distinct o.user_id) into v_users
    from public.notification_outbox o
   where o.payload ->> 'batch' = v_batch::text;

  return jsonb_build_object('batch', v_batch, 'queued', v_queued, 'users', v_users);
end;
$$;

-- E'lonlar jurnali: paket bo'yicha (yuborildi/xato/navbatda).
create or replace function public.announcement_log(p_limit integer default 20)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 100);
  v_result jsonb;
begin
  if not (select private.is_platform_admin()) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;

  select jsonb_build_object('items', coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb))
    into v_result
    from (
      select o.payload ->> 'batch' as batch,
             min(o.created_at) as created_at,
             count(distinct o.user_id) as users,
             count(*) as total,
             count(*) filter (where o.status = 'sent') as sent,
             count(*) filter (where o.status = 'failed') as failed,
             count(*) filter (where o.status in ('pending', 'sending')) as pending,
             min(o.payload -> 'message' ->> 'uz') as message
        from public.notification_outbox o
       where o.type = 'announcement'
       group by o.payload ->> 'batch'
       order by min(o.created_at) desc
       limit v_limit
    ) x;
  return v_result;
end;
$$;

-- Jurnal so'rovi faqat e'lon qatorlarini o'qisin (navbat 90 kun saqlanadi).
create index notification_outbox_announcement_idx
  on public.notification_outbox (created_at desc)
  where type = 'announcement';

grant execute on function
  public.send_announcement(jsonb, jsonb, uuid[], text[]),
  public.announcement_log(integer)
to authenticated;
