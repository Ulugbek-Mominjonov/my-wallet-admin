-- E09-T04: tekshiruv (diagnostika) — muammolar, ogohlantirishlar, holat.
-- Qoidalar: BR-025, BR-085, BR-113, BR-117, BR-170..172, BR-191.
-- Bildirishnoma, rejali ishlar va sinxron tekshiruvlari tegishli jadvallar
-- bilan qo'shiladi (E10, E11).

-- Eskirgan kurs deb hisoblanadigan kunlar (CBU har ish kuni yangilaydi).
create or replace function private.fx_stale_days()
returns integer
language sql
immutable
set search_path = ''
as $$ select 3 $$;

-- Uzoq kechikkan reja (BR-171: 30+ kun).
create or replace function private.long_overdue_days()
returns integer
language sql
immutable
set search_path = ''
as $$ select 30 $$;

-- BR-117: qarz nomiga o'xshash xarajat — pg_trgm o'xshashlik chegarasi.
create or replace function private.similar_name_threshold()
returns real
language sql
immutable
set search_path = ''
as $$ select 0.3::real $$;

grant execute on function
  private.fx_stale_days(), private.long_overdue_days(), private.similar_name_threshold()
to authenticated;

create or replace function public.health_check(p_household uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_today date;
  v_current date;
  v_problems jsonb := '[]'::jsonb;
  v_warnings jsonb := '[]'::jsonb;
  v_item jsonb;
  v_count integer;
  v_info jsonb;
begin
  if p_household not in (select private.my_household_ids()) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  v_today := private.household_today(p_household);
  v_current := date_trunc('month', v_today::timestamp)::date;

  -- ─── Muammolar ───────────────────────────────────────────────────────────
  -- BR-085: joriy oyga ko'chirilmagan aktiv doimiy rejalar ("oyni oching").
  select count(*) into v_count
    from public.recurring_rules r
   where r.household_id = p_household and r.deleted_at is null and r.active
     and (r.start_month is null or r.start_month <= v_current)
     and (r.end_month is null or r.end_month >= v_current)
     and not exists (
       select 1 from public.planned_items p
        where p.recurring_rule_id = r.id and p.budget_month = v_current
     );
  if v_count > 0 then
    v_problems := v_problems || jsonb_build_object('code', 'month_not_opened', 'month', v_current, 'count', v_count);
  end if;

  -- BR-117: bog'langan to'lovi yo'q qarzlar + nomi o'xshash xarajatlar taklifi.
  select coalesce(jsonb_agg(jsonb_build_object(
           'code', 'debt_unlinked', 'debt_id', d.id, 'name', d.name,
           'suggestions', coalesce((
             select jsonb_agg(jsonb_build_object('transaction_id', s.id, 'occurred_on', s.occurred_on,
                                                 'amount', s.amount, 'payee', s.payee) order by s.score desc)
               from (
                 select t.id, t.occurred_on, t.amount, t.payee,
                        extensions.similarity(lower(coalesce(t.payee, t.note, '')), lower(d.name)) as score
                   from public.transactions t
                  where t.household_id = p_household and t.deleted_at is null and t.debt_id is null
                    and t.kind = case d.direction when 'i_owe' then 'expense'::public.transaction_kind
                                                  else 'income'::public.transaction_kind end
                    and extensions.similarity(lower(coalesce(t.payee, t.note, '')), lower(d.name))
                        >= private.similar_name_threshold()
                  order by score desc
                  limit 3
               ) s
           ), '[]'::jsonb)
         ) order by d.name), '[]'::jsonb)
    into v_item
    from public.debts d
    join public.debt_balances b on b.debt_id = d.id
   where d.household_id = p_household and d.archived_at is null and b.status = 'unlinked';
  v_problems := v_problems || v_item;

  -- BR-113: qarzga bog'langan, muddati o'tgan to'lanmagan rejalar.
  select count(*) into v_count
    from public.planned_items p
   where p.household_id = p_household and p.debt_id is not null and p.deleted_at is null
     and p.settled_at is null and p.skipped_at is null and p.due_date < v_today;
  if v_count > 0 then
    v_problems := v_problems || jsonb_build_object('code', 'debt_plans_overdue', 'count', v_count);
  end if;

  -- ─── Ogohlantirishlar ────────────────────────────────────────────────────
  if not exists (
    select 1 from public.recurring_rules r
     where r.household_id = p_household and r.deleted_at is null and r.active
  ) then
    v_warnings := v_warnings || jsonb_build_object('code', 'no_active_rules');
  end if;

  -- BR-025: manfiy naqd qoldiq.
  select coalesce(jsonb_agg(jsonb_build_object('code', 'negative_cash', 'account_id', a.id,
                                               'name', a.name, 'balance', b.balance) order by a.sort_order), '[]'::jsonb)
    into v_item
    from public.accounts a
    join public.account_balances b on b.account_id = a.id
   where a.household_id = p_household and a.type = 'cash' and a.deleted_at is null and b.balance < 0;
  v_warnings := v_warnings || v_item;

  -- Uzoq (30+ kun) kechikkan rejalar.
  select count(*) into v_count
    from public.planned_items p
   where p.household_id = p_household and p.deleted_at is null and p.settled_at is null
     and p.skipped_at is null and p.kind <> 'income'
     and p.due_date < v_today - private.long_overdue_days();
  if v_count > 0 then
    v_warnings := v_warnings || jsonb_build_object('code', 'long_overdue', 'count', v_count,
                                                   'days', private.long_overdue_days());
  end if;

  -- Yopilgandan keyin tahrirlangan amallar (audit jurnalidan). Avval audit
  -- yozuvlari (byudjet + vaqt indeksi), keyin amal — PK bo'yicha.
  with edits as materialized (
    select a.record_id::uuid as id, a.at
      from public.audit_log a
     where a.household_id = p_household and a.table_name = 'transactions'
       and a.at > (select min(mo.closed_at) from public.months mo
                    where mo.household_id = p_household and mo.closed_at is not null)
  )
  select count(distinct e.id) into v_count
    from edits e
    join public.transactions t on t.id = e.id
    join public.months m on m.household_id = t.household_id and m.month = t.budget_month
   where m.closed_at is not null and e.at > m.closed_at;
  if v_count > 0 then
    v_warnings := v_warnings || jsonb_build_object('code', 'edited_after_close', 'count', v_count);
  end if;

  -- BR-191: boshqa valyutadagi hisob bor, lekin kurs eskirgan.
  select coalesce(jsonb_agg(jsonb_build_object('code', 'fx_rate_stale', 'currency', x.currency,
                                               'last_rate_date', x.last_rate_date)), '[]'::jsonb)
    into v_item
    from (
      select distinct a.currency,
             (select max(e.rate_date) from public.exchange_rates e where e.currency = a.currency) as last_rate_date
        from public.accounts a
        join public.households h on h.id = a.household_id
       where a.household_id = p_household and a.deleted_at is null and a.currency <> h.base_currency
    ) x
   where x.last_rate_date is null or x.last_rate_date < v_today - private.fx_stale_days();
  v_warnings := v_warnings || v_item;

  -- ─── Holat (BR-172) ──────────────────────────────────────────────────────
  select jsonb_build_object(
           'transactions', (select count(*) from public.transactions t
                             where t.household_id = p_household and t.deleted_at is null),
           'planned_items', (select count(*) from public.planned_items p
                              where p.household_id = p_household and p.deleted_at is null),
           'first_month', private.first_record_month(p_household),
           'opened_months', coalesce((select jsonb_agg(m.month order by m.month) from public.months m
                                       where m.household_id = p_household and m.opened_at is not null), '[]'::jsonb),
           'closed_months', coalesce((select jsonb_agg(m.month order by m.month) from public.months m
                                       where m.household_id = p_household and m.closed_at is not null), '[]'::jsonb),
           'income_rules', coalesce((select jsonb_agg(jsonb_build_object('category_id', c.id, 'name', c.name,
                                                                        'month_shift', c.month_shift)
                                                       order by c.sort_order, c.name)
                                      from public.categories c
                                     where c.household_id = p_household and c.kind = 'income'
                                       and c.deleted_at is null and c.archived_at is null), '[]'::jsonb)
         )
    into v_info;

  return jsonb_build_object('problems', v_problems, 'warnings', v_warnings, 'info', v_info);
end;
$$;

grant execute on function public.health_check(uuid) to authenticated;
