-- E11-T03: bildirishnomalarni navbatga qo'yish — kunlik eslatma (BR-160),
-- oylik hisobot (BR-161, BR-162, BR-167), kechikkan daromad (BR-165), limit
-- ogohlantirishi (BR-133). Hammasi set-based; takror — dedupe_key (BR-166).

-- BR-162: shubhali oy — daromad boshqa oylar o'rtachasining shu ulushidan kam.
create or replace function private.suspicious_income_ratio()
returns numeric language sql immutable set search_path = '' as $$ select 0.6 $$;
-- BR-165: kutilayotgan daromad shuncha kundan ko'p kechiksa.
create or replace function private.income_missing_days()
returns integer language sql immutable set search_path = '' as $$ select 2 $$;
-- BR-161: oylik hisobotdagi eng ko'p sarflangan kategoriyalar soni.
create or replace function private.report_top_categories()
returns integer language sql immutable set search_path = '' as $$ select 5 $$;

-- Email kanali ixtiyoriy (SMTP sozlangan bo'lsa, app_config.email_notifications = true).
create or replace function private.email_notifications_enabled()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select c.value = 'true'::jsonb from public.app_config c where c.key = 'email_notifications'), false)
$$;

-- Yetkazib bo'ladigan manzillar: kanal yoqilgan VA manzil bor (push — qurilma,
-- Telegram — ulangan). Yetkazib bo'lmaydigan xabar navbatga qo'yilmaydi.
create or replace view private.notification_targets as
select np.user_id, np.household_id, ch.channel, pr.locale, h.timezone,
       np.reminder_hour, np.days_ahead, np.monthly_report, np.report_day, np.limit_alerts, np.income_missing
  from public.notification_prefs np
  join public.household_members m on m.user_id = np.user_id and m.household_id = np.household_id
  join public.households h on h.id = np.household_id
  join public.profiles pr on pr.user_id = np.user_id
  cross join lateral (values ('push'), ('telegram'), ('email')) as ch (channel)
 where (ch.channel = 'push' and np.push
        and exists (select 1 from public.device_tokens d where d.user_id = np.user_id))
    or (ch.channel = 'telegram' and np.telegram
        and exists (select 1 from public.telegram_links t where t.user_id = np.user_id))
    or (ch.channel = 'email' and np.email and private.email_notifications_enabled());

-- ─── Kunlik eslatma (BR-160) ───────────────────────────────────────────────
-- Har a'zoning o'z soatida: muddati o'tgan, bugungi, yaqin N kundagi to'lovlar
-- + joriy oy qoldig'i. Eslatadigan narsa bo'lmasa — yuborilmaydi.
create or replace function jobs.enqueue_reminders(p_now timestamptz default now())
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  with due as (
    select t.user_id, t.household_id, t.channel, t.locale,
           (p_now at time zone t.timezone)::date as today, t.days_ahead
      from private.notification_targets t
     where extract(hour from p_now at time zone t.timezone) = t.reminder_hour
  ),
  items as (
    select d.user_id, d.household_id, d.channel, d.locale, d.today,
           jsonb_agg(jsonb_build_object('name', p.name, 'amount', p.planned_amount - p.paid_amount,
                                        'due_date', p.due_date, 'kind', p.kind) order by p.due_date, p.name)
             filter (where p.due_date < d.today) as overdue,
           jsonb_agg(jsonb_build_object('name', p.name, 'amount', p.planned_amount - p.paid_amount,
                                        'due_date', p.due_date, 'kind', p.kind) order by p.name)
             filter (where p.due_date = d.today) as today_items,
           jsonb_agg(jsonb_build_object('name', p.name, 'amount', p.planned_amount - p.paid_amount,
                                        'due_date', p.due_date, 'kind', p.kind) order by p.due_date, p.name)
             filter (where p.due_date > d.today) as upcoming
      from due d
      join public.planned_items p
        on p.household_id = d.household_id and p.settled_at is null and p.skipped_at is null
       and p.deleted_at is null and p.kind <> 'income' and p.due_date <= d.today + d.days_ahead
     group by d.user_id, d.household_id, d.channel, d.locale, d.today
  )
  insert into public.notification_outbox (user_id, household_id, channel, type, payload, dedupe_key)
  select i.user_id, i.household_id, i.channel, 'daily_reminder',
         jsonb_build_object(
           'locale', i.locale, 'date', i.today,
           'overdue', coalesce(i.overdue, '[]'::jsonb), 'today', coalesce(i.today_items, '[]'::jsonb),
           'upcoming', coalesce(i.upcoming, '[]'::jsonb),
           'balance', (select f.income - f.expense
                         from private.month_facts(i.household_id, date_trunc('month', i.today::timestamp)::date,
                                                  date_trunc('month', i.today::timestamp)::date) f)
         ),
         format('daily_reminder:%s:%s:%s:%s', i.household_id, i.user_id, i.today, i.channel)
    from items i
  on conflict (dedupe_key) do nothing;
  get diagnostics v_count = row_count;
  return jsonb_build_object('queued', v_count);
end;
$$;

-- ─── Oylik hisobot (BR-161, BR-162, BR-167) ────────────────────────────────
-- Hisobotlar yadrosidan (month_facts, budget_lines) — ekrandagi hisobot bilan
-- bir xil raqamlar.
create or replace function private.monthly_report_payload(p_household uuid, p_month date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with f as (
    select * from private.month_facts(
      p_household, least(coalesce(private.first_record_month(p_household), p_month), p_month), p_month)
  ),
  m as (select * from f where f.month = p_month),
  other as (
    select avg(f.income) as avg_income from f where f.month < p_month and f.has_records
  ),
  lines as (
    select l.category_id, sum(l.amount)::bigint as actual
      from private.budget_lines(p_household, p_month, p_month) l
     where l.line in ('expense', 'allocation')
     group by l.category_id
  ),
  totals as (
    select c.id, c.name, c.sort_order,
           coalesce(la.actual, 0) + coalesce((
             select sum(lc.actual) from lines lc join public.categories cc on cc.id = lc.category_id
              where cc.parent_id = c.id
           ), 0)::bigint as actual_total,
           li.amount as limit_amount
      from public.categories c
      left join lines la on la.category_id = c.id
      left join public.category_limits li on li.category_id = c.id and li.household_id = c.household_id and li.deleted_at is null
     where c.household_id = p_household and c.kind = 'expense'
  )
  select jsonb_build_object(
           'month', p_month,
           'income', m.income, 'expense', m.expense, 'balance', m.income - m.expense,
           'saved', m.income - m.expense + m.allocated - m.fund_spent,
           'saved_ratio', case when m.income > 0
                               then round((m.income - m.expense + m.allocated - m.fund_spent)::numeric / m.income, 4)
                               else 0 end,
           'fund_balance', (select private.account_balance(a.id) from public.accounts a
                             where a.household_id = p_household and a.type = 'personal_fund'),
           'savings_total', (select coalesce(sum(x.income - x.expense), 0) from f x),
           'debts_remaining', (select coalesce(sum(b.remaining), 0) from public.debt_balances b
                                 join public.debts d on d.id = b.debt_id
                                 join public.households h on h.id = d.household_id
                                where b.household_id = p_household and d.direction = 'i_owe'
                                  and d.archived_at is null and d.currency = h.base_currency),
           'top_categories', coalesce((
             select jsonb_agg(jsonb_build_object('name', c.name, 'actual', l.actual) order by l.actual desc)
               from (select * from lines order by actual desc limit private.report_top_categories()) l
               join public.categories c on c.id = l.category_id
           ), '[]'::jsonb),
           'limits_exceeded', coalesce((
             select jsonb_agg(jsonb_build_object('name', t.name, 'actual', t.actual_total, 'limit', t.limit_amount)
                              order by t.sort_order, t.name)
               from totals t where t.limit_amount is not null and t.actual_total > t.limit_amount
           ), '[]'::jsonb),
           -- BR-162: boshqa oylar bo'lsa va daromad ularning 60% idan kam bo'lsa.
           'suspicious', coalesce((select m.income < o.avg_income * private.suspicious_income_ratio() from other o), false)
         )
    from m
$$;

create or replace function jobs.enqueue_monthly_reports(p_now timestamptz default now())
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reports integer;
  v_count integer;
begin
  -- O'tgan oy hisoboti — egasining (yoki a'zoning) hisobot kuni va soatida.
  with due as (
    select distinct t.household_id,
           (date_trunc('month', p_now at time zone t.timezone) - interval '1 month')::date as month
      from private.notification_targets t
     where t.monthly_report
       and extract(day from p_now at time zone t.timezone) = t.report_day
       and extract(hour from p_now at time zone t.timezone) = t.reminder_hour
  )
  insert into public.monthly_reports (household_id, month, payload)
  select d.household_id, d.month, private.monthly_report_payload(d.household_id, d.month)
    from due d
  on conflict (household_id, month) do update set payload = excluded.payload, generated_at = now();
  get diagnostics v_reports = row_count;

  insert into public.notification_outbox (user_id, household_id, channel, type, payload, dedupe_key)
  select t.user_id, t.household_id, t.channel, 'monthly_report',
         r.payload || jsonb_build_object('locale', t.locale),
         format('monthly_report:%s:%s:%s:%s', t.household_id, t.user_id, r.month, t.channel)
    from private.notification_targets t
    join public.monthly_reports r
      on r.household_id = t.household_id
     and r.month = (date_trunc('month', p_now at time zone t.timezone) - interval '1 month')::date
   where t.monthly_report
     and extract(day from p_now at time zone t.timezone) = t.report_day
     and extract(hour from p_now at time zone t.timezone) = t.reminder_hour
  on conflict (dedupe_key) do nothing;
  get diagnostics v_count = row_count;
  return jsonb_build_object('reports', v_reports, 'queued', v_count);
end;
$$;

-- ─── Kechikkan daromad (BR-165) ────────────────────────────────────────────
-- Har reja uchun bir marta, a'zoning eslatma soatida.
create or replace function jobs.enqueue_income_missing(p_now timestamptz default now())
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.notification_outbox (user_id, household_id, channel, type, payload, dedupe_key)
  select t.user_id, t.household_id, t.channel, 'income_missing',
         jsonb_build_object('locale', t.locale, 'name', p.name, 'amount', p.planned_amount, 'due_date', p.due_date),
         format('income_missing:%s:%s:%s', p.id, t.user_id, t.channel)
    from private.notification_targets t
    join public.planned_items p
      on p.household_id = t.household_id and p.kind = 'income'
     and p.settled_at is null and p.skipped_at is null and p.deleted_at is null
     and p.due_date < (p_now at time zone t.timezone)::date - private.income_missing_days()
   where t.income_missing
     and extract(hour from p_now at time zone t.timezone) = t.reminder_hour
  on conflict (dedupe_key) do nothing;
  get diagnostics v_count = row_count;
  return jsonb_build_object('queued', v_count);
end;
$$;

-- ─── Limit ogohlantirishi (BR-133) ─────────────────────────────────────────
-- Joriy oy xarajatlari o'zgarganda: limitli kategoriyalar (ota — bolalari
-- bilan, BR-132) 80% / 100% ga yetgan bo'lsa — yoqilgan (`alert_80`,
-- `alert_100`) eng katta chegara bo'yicha, oyda har chegara uchun bir marta.
create or replace function private.enqueue_limit_alerts(p_households uuid[])
returns void
language sql
security definer
set search_path = ''
as $$
  with hh as (
    select h.id, date_trunc('month', private.household_today(h.id)::timestamp)::date as month
      from public.households h
     where h.id = any (p_households)
       and exists (select 1 from public.category_limits l where l.household_id = h.id and l.deleted_at is null)
  ),
  lines as (
    select hh.id as household_id, hh.month, l.category_id, sum(l.amount)::bigint as actual
      from hh
      cross join lateral private.budget_lines(hh.id, hh.month, hh.month) l
     where l.line in ('expense', 'allocation')
     group by hh.id, hh.month, l.category_id
  ),
  status as (
    select li.household_id, hh.month, c.id as category_id, c.name, li.amount as limit_amount,
           li.alert_80, li.alert_100,
           coalesce((select sum(x.actual) from lines x
                      join public.categories cc on cc.id = x.category_id
                     where x.household_id = li.household_id and (cc.id = c.id or cc.parent_id = c.id)), 0)::bigint
             as actual_total
      from public.category_limits li
      join hh on hh.id = li.household_id
      join public.categories c on c.id = li.category_id
     where li.deleted_at is null
  ),
  crossed as (
    select s.*, (select max(th.pct) from (values (80, s.alert_80), (100, s.alert_100)) as th (pct, enabled)
                  where th.enabled and s.actual_total * 100 >= s.limit_amount * th.pct) as threshold
      from status s
  )
  insert into public.notification_outbox (user_id, household_id, channel, type, payload, dedupe_key)
  select t.user_id, t.household_id, t.channel, 'limit_alert',
         jsonb_build_object('locale', t.locale, 'category', x.name, 'limit', x.limit_amount,
                            'actual', x.actual_total, 'threshold', x.threshold, 'month', x.month),
         format('limit_alert:%s:%s:%s:%s:%s:%s', x.household_id, x.category_id, x.month, x.threshold, t.user_id, t.channel)
    from crossed x
    join private.notification_targets t on t.household_id = x.household_id and t.limit_alerts
   where x.threshold is not null
  on conflict (dedupe_key) do nothing
$$;

-- Amallardan keyingi statement trigger (E07-T05) — endi limit ogohlantirishi ham.
create or replace function private.sync_after_transactions(
  p_plans uuid[],
  p_households uuid[],
  p_months date[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_plans is not null then
    with totals as (
      select x.id, coalesce(sum(t.amount_base) filter (where t.deleted_at is null), 0)::bigint as paid
        from unnest(p_plans) as x (id)
        left join public.transactions t on t.planned_item_id = x.id
       group by x.id
    )
    update public.planned_items p
       set paid_amount = totals.paid
      from totals
     where p.id = totals.id and p.paid_amount <> totals.paid;
  end if;
  if p_households is not null then
    perform private.recalc_fund_plans(p_households, p_months, true);
  end if;
end;
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
begin
  if tg_op = 'INSERT' then
    select array_agg(distinct r.planned_item_id) filter (where r.planned_item_id is not null),
           array_agg(distinct r.household_id) filter (where r.kind <> 'income')
      into v_plans, v_expense_households
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
  return null;
end;
$$;
