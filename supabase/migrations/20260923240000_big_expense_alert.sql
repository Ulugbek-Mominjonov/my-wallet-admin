-- E30-T03 (BR-011, BR-163): oilaviy byudjetda katta xarajat haqida xabar.
--
-- Har a'zo o'zi uchun chegara qo'yadi ("shu summadan katta xarajat bo'lsa
-- menga xabar ber"); xabar xarajatni yozgan a'zoning o'ziga ketmaydi.
-- Sozlama bo'sh (`null`) — o'chiq.
alter table public.notification_prefs
  add column big_expense bigint check (big_expense is null or big_expense > 0);

-- Navbat turlariga yangi xabar turi (BR-166).
alter table public.notification_outbox drop constraint notification_outbox_type_check;
alter table public.notification_outbox
  add constraint notification_outbox_type_check
  check (type in ('daily_reminder', 'monthly_report', 'limit_alert', 'income_missing',
                  'test', 'announcement', 'big_expense')) not valid;
alter table public.notification_outbox validate constraint notification_outbox_type_check;

comment on column public.notification_prefs.big_expense is
  'E30-T03: boshqa a''zoning shu summadan katta xarajati haqida xabar (asosiy valyutada).';

grant update (big_expense) on public.notification_prefs to authenticated;

-- Yangi xarajatlar bo'yicha xabar navbati: faqat chegara qo'ygan va kanali
-- bor a'zolarga, xarajat egasidan tashqari.
create or replace function private.enqueue_big_expense(p_ids uuid[])
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notification_outbox (user_id, household_id, channel, type, payload, dedupe_key)
  select np.user_id, t.household_id, ch.channel, 'big_expense',
         jsonb_build_object('locale', pr.locale, 'amount', t.amount_base,
                            'payee', t.payee, 'category', c.name,
                            'actor', coalesce(ap.display_name, '—'),
                            'date', t.occurred_on),
         format('big_expense:%s:%s:%s', t.id, np.user_id, ch.channel)
    from public.transactions t
    join public.notification_prefs np
      on np.household_id = t.household_id
     and np.user_id <> coalesce(t.created_by, np.user_id)
     and np.big_expense is not null and t.amount_base >= np.big_expense
    join public.household_members m on m.user_id = np.user_id and m.household_id = np.household_id
    join public.profiles pr on pr.user_id = np.user_id
    left join public.profiles ap on ap.user_id = t.created_by
    left join public.categories c on c.id = t.category_id
    cross join lateral (values ('push'), ('telegram'), ('email')) as ch (channel)
   where t.id = any (p_ids) and t.deleted_at is null and t.kind = 'expense'
     and ((ch.channel = 'push' and np.push
           and exists (select 1 from public.device_tokens d where d.user_id = np.user_id))
       or (ch.channel = 'telegram' and np.telegram
           and exists (select 1 from public.telegram_links tl where tl.user_id = np.user_id))
       or (ch.channel = 'email' and np.email and private.email_notifications_enabled()))
  on conflict (dedupe_key) do nothing
$$;
create or replace function private.transactions_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plans uuid[];
  v_households uuid[];
  v_months date[];
  v_expense_households uuid[];
  v_new_expenses uuid[];
begin
  if tg_op = 'INSERT' then
    select array_agg(distinct r.planned_item_id) filter (where r.planned_item_id is not null),
           array_agg(distinct r.household_id) filter (where r.kind <> 'income'),
           array_agg(r.id) filter (where r.kind = 'expense')
      into v_plans, v_expense_households, v_new_expenses
      from new_rows r;
    select array_agg(m.household_id), array_agg(m.budget_month)
      into v_households, v_months
      from (select distinct r.household_id, r.budget_month from new_rows r where r.kind = 'income') m;
  elsif tg_op = 'UPDATE' then
    select array_agg(distinct r.planned_item_id) filter (where r.planned_item_id is not null),
           array_agg(distinct r.household_id) filter (where r.kind <> 'income')
      into v_plans, v_expense_households
      from (select o.planned_item_id, o.household_id, o.kind from old_rows o
            union all
            select n.planned_item_id, n.household_id, n.kind from new_rows n) r;
    select array_agg(m.household_id), array_agg(m.budget_month)
      into v_households, v_months
      from (
        select distinct r.household_id, r.budget_month
          from (
            select o.household_id, o.budget_month, o.kind from old_rows o
            union all
            select n.household_id, n.budget_month, n.kind from new_rows n
          ) r
         where r.kind = 'income'
      ) m;
  else
    select array_agg(distinct r.planned_item_id) filter (where r.planned_item_id is not null)
      into v_plans
      from old_rows r;
    select array_agg(m.household_id), array_agg(m.budget_month)
      into v_households, v_months
      from (select distinct r.household_id, r.budget_month from old_rows r where r.kind = 'income') m;
  end if;

  perform private.sync_after_transactions(v_plans, v_households, v_months);
  -- BR-133: xarajat qo'shilgan/o'zgargan byudjetlarda limit chegaralari.
  if v_expense_households is not null then
    perform private.enqueue_limit_alerts(v_expense_households);
  end if;
  -- E30-T03: yangi katta xarajat — byudjetdagi boshqa a'zolarga xabar.
  if tg_op = 'INSERT' and v_new_expenses is not null then
    perform private.enqueue_big_expense(v_new_expenses);
  end if;
  return null;
end;
$$;
