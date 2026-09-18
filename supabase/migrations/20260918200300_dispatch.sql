-- E11-T04 (server qismi), T05, T07, T08: navbatni yuborish RPC'lari,
-- test/hozir yuborish (BR-164), Telegram, kurslar, akkauntni o'chirish
-- (BR-015). Edge Function'lar — supabase/functions; rejali ishlar — 200500.

-- ─── Navbat parametrlari ───────────────────────────────────────────────────
create or replace function private.outbox_max_attempts()
returns integer language sql immutable set search_path = '' as $$ select 3 $$;
-- Qayta urinish oralig'i: 1-urinishdan keyin 5 daqiqa, 2-dan keyin 30 daqiqa.
create or replace function private.outbox_backoff(p_attempts integer)
returns interval language sql immutable set search_path = '' as $$
  select case when p_attempts <= 1 then interval '5 minutes' else interval '30 minutes' end
$$;
create or replace function private.outbox_batch_max()
returns integer language sql immutable set search_path = '' as $$ select 500 $$;

-- ─── Dispatch (faqat service_role — notify-dispatch Edge Function) ─────────
-- Navbatdan olish: FOR UPDATE SKIP LOCKED — parallel chaqiruvlar bir xabarni
-- ikki marta olmaydi. Manzillar (tokenlar, chat, email) va til bilan.
create or replace function public.outbox_claim(p_limit integer default 100)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  with claimed as (
    update public.notification_outbox o
       set status = 'sending', attempts = o.attempts + 1
     where o.id in (
       select x.id from public.notification_outbox x
        where x.status = 'pending' and x.next_attempt_at <= now()
        order by x.id
        limit least(greatest(p_limit, 1), private.outbox_batch_max())
        for update skip locked
     )
    returning o.id, o.user_id, o.channel, o.type, o.payload
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', c.id, 'channel', c.channel, 'type', c.type, 'payload', c.payload,
           'locale', coalesce(c.payload ->> 'locale', pr.locale, 'uz'),
           'tokens', case when c.channel = 'push' then
             coalesce((select jsonb_agg(d.token) from public.device_tokens d where d.user_id = c.user_id), '[]'::jsonb) end,
           'chat_id', case when c.channel = 'telegram' then
             (select t.chat_id from public.telegram_links t where t.user_id = c.user_id) end,
           'email', case when c.channel = 'email' then
             (select u.email from auth.users u where u.id = c.user_id) end
         ) order by c.id), '[]'::jsonb)
    from claimed c
    left join public.profiles pr on pr.user_id = c.user_id
$$;

-- Natija: sent | skipped | xato (retry bo'lsa — keyinroq qayta, urinishlar
-- tugasa — failed). Eskirgan FCM tokenlari o'chiriladi.
create or replace function public.outbox_complete(p_results jsonb, p_stale_tokens text[] default '{}')
returns void
language sql
security definer
set search_path = ''
as $$
  update public.notification_outbox o
     set status = case
                    when r.status in ('sent', 'skipped') then r.status
                    when coalesce(r.retry, false) and o.attempts < private.outbox_max_attempts() then 'pending'
                    else 'failed'
                  end,
         sent_at = case when r.status = 'sent' then now() end,
         error = left(r.error, 1000),
         next_attempt_at = case
                             when r.status not in ('sent', 'skipped') and coalesce(r.retry, false)
                               then now() + private.outbox_backoff(o.attempts)
                             else o.next_attempt_at
                           end
    from jsonb_to_recordset(p_results) as r (id bigint, status text, error text, retry boolean)
   where o.id = r.id and o.status = 'sending';

  delete from public.device_tokens where token = any (p_stale_tokens);
$$;

-- ─── Telegram webhook (faqat service_role) ─────────────────────────────────
create or replace function public.telegram_link_consume(p_token text, p_chat_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_expires timestamptz;
  v_used timestamptz;
begin
  select t.user_id, t.expires_at, t.used_at into v_user, v_expires, v_used
    from public.telegram_link_tokens t where t.token = p_token
   for update;
  if v_user is null then
    return jsonb_build_object('ok', false, 'code', 'token_invalid');
  end if;
  if v_used is not null then
    return jsonb_build_object('ok', false, 'code', 'token_used');
  end if;
  if v_expires <= now() then
    return jsonb_build_object('ok', false, 'code', 'token_expired');
  end if;

  update public.telegram_link_tokens set used_at = now() where token = p_token;
  -- Chat boshqa akkauntga ulangan bo'lsa — yangisiga o'tadi.
  delete from public.telegram_links where chat_id = p_chat_id and user_id <> v_user;
  insert into public.telegram_links (user_id, chat_id) values (v_user, p_chat_id)
  on conflict (user_id) do update set chat_id = excluded.chat_id, linked_at = now();
  -- Ulangan kanal barcha byudjetlarda yoqiladi (foydalanuvchi keyin o'zgartiradi).
  update public.notification_prefs set telegram = true where user_id = v_user;

  return jsonb_build_object('ok', true, 'locale',
                            (select p.locale from public.profiles p where p.user_id = v_user));
end;
$$;

create or replace function public.telegram_unlink_chat(p_chat_id bigint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.telegram_links where chat_id = p_chat_id;
  return found;
end;
$$;

-- /balans va /bugun (BR-221) — foydalanuvchining oxirgi tanlangan byudjeti.
create or replace function public.telegram_summary(p_chat_id bigint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with target as (
    select l.user_id, pr.locale, pr.last_household_id as household_id,
           private.household_today(pr.last_household_id) as today
      from public.telegram_links l
      join public.profiles pr on pr.user_id = l.user_id
     where l.chat_id = p_chat_id and pr.last_household_id is not null
  )
  select jsonb_build_object(
           'locale', t.locale,
           'household', (select h.name from public.households h where h.id = t.household_id),
           'month', f.month, 'income', f.income, 'expense', f.expense,
           'balance', f.income - f.expense, 'forecast', f.income - f.expense - f.unpaid,
           'today', coalesce((
             select jsonb_agg(jsonb_build_object('name', p.name, 'amount', p.planned_amount - p.paid_amount,
                                                 'due_date', p.due_date) order by p.due_date, p.name)
               from public.planned_items p
              where p.household_id = t.household_id and p.kind <> 'income' and p.due_date <= t.today
                and p.settled_at is null and p.skipped_at is null and p.deleted_at is null
           ), '[]'::jsonb)
         )
    from target t
    cross join lateral private.month_facts(t.household_id, date_trunc('month', t.today::timestamp)::date,
                                           date_trunc('month', t.today::timestamp)::date) f
$$;

-- ─── Valyuta kurslari (fx-sync, faqat service_role) ────────────────────────
create or replace function public.fx_upsert(p_rates jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.exchange_rates (currency, rate_date, rate_to_base, source)
  select r.currency, r.rate_date, r.rate_to_base, 'CBU'
    from jsonb_to_recordset(p_rates) as r (currency text, rate_date date, rate_to_base numeric)
    join public.currencies c on c.code = r.currency
  on conflict (currency, rate_date) do update
    set rate_to_base = excluded.rate_to_base
    where public.exchange_rates.source = 'CBU';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function
  public.outbox_claim(integer), public.outbox_complete(jsonb, text[]),
  public.telegram_link_consume(text, bigint), public.telegram_unlink_chat(bigint),
  public.telegram_summary(bigint), public.fx_upsert(jsonb)
from authenticated, anon;
grant execute on function
  public.outbox_claim(integer), public.outbox_complete(jsonb, text[]),
  public.telegram_link_consume(text, bigint), public.telegram_unlink_chat(bigint),
  public.telegram_summary(bigint), public.fx_upsert(jsonb)
to service_role;

-- ─── Test va "hozir yuborish" (BR-164) ─────────────────────────────────────
-- Har kanal uchun aniq natija: navbatga qo'yildi yoki nega yo'q.
create or replace function private.channel_status(p_user uuid, p_household uuid, p_channel text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_channel = 'push' and not coalesce(np.push, false) then 'disabled'
    when p_channel = 'push' and not exists (select 1 from public.device_tokens d where d.user_id = p_user) then 'no_device'
    when p_channel = 'telegram' and not exists (select 1 from public.telegram_links t where t.user_id = p_user) then 'not_linked'
    when p_channel = 'telegram' and not coalesce(np.telegram, false) then 'disabled'
    when p_channel = 'email' and not private.email_notifications_enabled() then 'not_configured'
    when p_channel = 'email' and not coalesce(np.email, false) then 'disabled'
    else 'ok'
  end
    from (select 1) one
    left join public.notification_prefs np on np.user_id = p_user and np.household_id = p_household
$$;

create or replace function public.test_notification(p_household uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  perform private.require_household_role(p_household, array['owner', 'admin', 'member', 'viewer']::public.member_role[]);

  insert into public.notification_outbox (user_id, household_id, channel, type, payload, dedupe_key)
  select v_user, p_household, c.channel, 'test',
         jsonb_build_object('locale', (select p.locale from public.profiles p where p.user_id = v_user)),
         format('test:%s:%s:%s', v_user, c.channel, gen_random_uuid())
    from unnest(array['push', 'telegram', 'email']) as c (channel)
   where private.channel_status(v_user, p_household, c.channel) = 'ok';

  return (
    select jsonb_agg(jsonb_build_object('channel', c.channel,
                                        'queued', private.channel_status(v_user, p_household, c.channel) = 'ok',
                                        'reason', nullif(private.channel_status(v_user, p_household, c.channel), 'ok')))
      from unnest(array['push', 'telegram', 'email']) as c (channel)
  );
end;
$$;

-- E25-T06: tanlangan oy hisobotini hozir yaratib, o'ziga yuborish.
create or replace function public.send_monthly_report_now(p_household uuid, p_month public.month_start)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_payload jsonb;
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

  return jsonb_build_object(
    'report', v_payload,
    'channels', (
      select jsonb_agg(jsonb_build_object('channel', c.channel,
                                          'queued', private.channel_status(v_user, p_household, c.channel) = 'ok',
                                          'reason', nullif(private.channel_status(v_user, p_household, c.channel), 'ok')))
        from unnest(array['push', 'telegram', 'email']) as c (channel)
    )
  );
end;
$$;

grant execute on function public.test_notification(uuid), public.send_monthly_report_now(uuid, public.month_start)
  to authenticated;

-- ─── Akkauntni o'chirish (BR-015) — delete-account Edge Function ───────────
-- Foydalanuvchi JWT'i bilan: yolg'iz a'zo bo'lgan byudjetlar o'chiriladi,
-- boshqa a'zolari borlaridan chiqadi (oxirgi owner bo'lsa — avval egalikni
-- o'tkazishi kerak). Natija — o'chirilgan byudjetlar (fayllarini tozalash uchun).
-- auth foydalanuvchisini Edge Function service kaliti bilan o'chiradi.
create or replace function public.prepare_account_deletion()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_deleted uuid[];
begin
  if v_user is null then
    raise exception 'unauthorized' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.household_members m
     where m.user_id = v_user and m.role = 'owner'
       and exists (select 1 from public.household_members o where o.household_id = m.household_id and o.user_id <> v_user)
       and not exists (select 1 from public.household_members o
                        where o.household_id = m.household_id and o.user_id <> v_user and o.role = 'owner')
  ) then
    raise exception 'last_owner' using errcode = 'P0001';
  end if;

  with solo as (
    select m.household_id from public.household_members m
     where m.user_id = v_user
       and not exists (select 1 from public.household_members o where o.household_id = m.household_id and o.user_id <> v_user)
  ),
  removed as (
    delete from public.households h using solo s where h.id = s.household_id returning h.id
  )
  select array_agg(r.id) into v_deleted from removed r;

  delete from public.household_members where user_id = v_user;
  return jsonb_build_object('deleted_households', coalesce(to_jsonb(v_deleted), '[]'::jsonb));
end;
$$;

grant execute on function public.prepare_account_deletion() to authenticated;
