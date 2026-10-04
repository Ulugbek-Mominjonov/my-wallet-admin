-- E25-T06 / BR-164: "Sinov xabari" va "Hisobotni hozir yuborish" bosilganda
-- xabar navbatga tushardi, yuborish esa keyingi rejali ishni (5 daqiqa)
-- kutardi — tekshirish uchun bu juda sekin. Endi shu ikki amal navbatni
-- darhol jo'natadi: `jobs.dispatch_notifications()` navbat bo'sh bo'lsa
-- HTTP chaqiruv qilmaydi (ADR-11), ya'ni ortiqcha yuk yo'q.
--
-- Qolgan xabarlar (eslatma, oylik hisobot, ogohlantirish) avvalgidek rejali
-- ish bilan ketadi — ular vaqtga bog'liq emas.

create or replace function public.test_notification(p_household uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_result jsonb;
begin
  perform private.require_household_role(p_household, array['owner', 'admin', 'member', 'viewer']::public.member_role[]);

  insert into public.notification_outbox (user_id, household_id, channel, type, payload, dedupe_key)
  select v_user, p_household, c.channel, 'test',
         jsonb_build_object('locale', (select p.locale from public.profiles p where p.user_id = v_user)),
         format('test:%s:%s:%s', v_user, c.channel, gen_random_uuid())
    from unnest(array['push', 'telegram', 'email']) as c (channel)
   where private.channel_status(v_user, p_household, c.channel) = 'ok';

  v_result := (
    select jsonb_agg(jsonb_build_object('channel', c.channel,
                                        'queued', private.channel_status(v_user, p_household, c.channel) = 'ok',
                                        'reason', nullif(private.channel_status(v_user, p_household, c.channel), 'ok')))
      from unnest(array['push', 'telegram', 'email']) as c (channel)
  );
  perform jobs.dispatch_notifications();
  return v_result;
end;
$$;

create or replace function public.send_monthly_report_now(p_household uuid, p_month public.month_start)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_payload jsonb;
  v_result jsonb;
begin
  perform private.require_household_role(p_household, array['owner', 'admin', 'member', 'viewer']::public.member_role[]);
  v_payload := private.monthly_report_payload(p_household, p_month);
  if v_payload is null then
    raise exception 'no_data' using errcode = 'P0001';
  end if;
  insert into public.monthly_reports (household_id, month, payload)
  values (p_household, p_month, v_payload)
  on conflict (household_id, month) do update set payload = excluded.payload, generated_at = now();

  insert into public.notification_outbox (user_id, household_id, channel, type, payload, dedupe_key)
  select v_user, p_household, c.channel, 'monthly_report',
         v_payload || jsonb_build_object('locale', (select p.locale from public.profiles p where p.user_id = v_user)),
         format('monthly_report_now:%s:%s:%s:%s', p_household, v_user, c.channel, gen_random_uuid())
    from unnest(array['push', 'telegram', 'email']) as c (channel)
   where private.channel_status(v_user, p_household, c.channel) = 'ok';

  v_result := jsonb_build_object(
    'report', v_payload,
    'channels', (
      select jsonb_agg(jsonb_build_object('channel', c.channel,
                                          'queued', private.channel_status(v_user, p_household, c.channel) = 'ok',
                                          'reason', nullif(private.channel_status(v_user, p_household, c.channel), 'ok')))
        from unnest(array['push', 'telegram', 'email']) as c (channel)
    )
  );
  perform jobs.dispatch_notifications();
  return v_result;
end;
$$;

grant execute on function public.test_notification(uuid), public.send_monthly_report_now(uuid, public.month_start)
  to authenticated;
