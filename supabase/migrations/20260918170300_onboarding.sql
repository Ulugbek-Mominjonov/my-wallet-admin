-- E08-T06: onboarding — mobil ilovaning birinchi sozlash oynasi natijasi bitta
-- tranzaksiyada: hisoblar (joriy qoldiq), daromad turlari va oy qoidalari
-- (+ kutilayotgan daromad rejasi, BR-077), doimiy rejalar, fond qoidasi.
-- Bir marta: qayta chaqirilsa hech narsani ustiga yozmaydi. Eslatma
-- sozlamalari — E11 (notification_prefs) bilan qo'shiladi.

alter table public.households add column onboarded_at timestamptz;

comment on column public.households.onboarded_at is
  'onboarding_apply bajarilgan vaqt; NULL — ilova sozlash oynasini ko''rsatadi.';

-- app_bootstrap: byudjet ro'yxatida onboarding holati ham.
create or replace function public.app_bootstrap()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'schema_version', private.api_schema_version(),
    'is_platform_admin', private.is_platform_admin(),
    'profile', (
      select jsonb_build_object(
        'user_id', p.user_id,
        'display_name', p.display_name,
        'locale', p.locale,
        'last_household_id', p.last_household_id
      )
        from public.profiles p where p.user_id = (select auth.uid())
    ),
    'households', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'id', h.id,
                 'name', h.name,
                 'role', m.role,
                 'base_currency', h.base_currency,
                 'timezone', h.timezone,
                 'onboarded', h.onboarded_at is not null
               ) order by h.created_at
             )
        from public.household_members m
        join public.households h on h.id = m.household_id
       where m.user_id = (select auth.uid())
    ), '[]'::jsonb),
    'currencies', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'code', c.code,
                 'name', c.name_i18n,
                 'symbol', c.symbol,
                 'exponent', c.exponent
               ) order by c.sort_order
             )
        from public.currencies c
       where c.active
    ), '[]'::jsonb),
    'app_config', coalesce((select jsonb_object_agg(c.key, c.value) from public.app_config c), '{}'::jsonb)
  )
$$;

-- Payload bo'limlari — tiplangan qatorlar (nomlar trim qilinadi).
create or replace function private.onboarding_accounts(p_payload jsonb)
returns table (name text, type public.account_type, opening_balance bigint)
language sql
stable
set search_path = ''
as $$
  select btrim(a.name), a.type, coalesce(a.opening_balance, 0)
    from jsonb_to_recordset(coalesce(p_payload -> 'accounts', '[]'::jsonb))
         as a (name text, type public.account_type, opening_balance bigint)
$$;

create or replace function private.onboarding_income(p_payload jsonb)
returns table (name text, month_shift smallint, expected_day smallint, expected_amount bigint, account text)
language sql
stable
set search_path = ''
as $$
  select btrim(x.name), coalesce(x.month_shift, 0)::smallint, x.expected_day, x.expected_amount, btrim(x.account)
    from jsonb_to_recordset(coalesce(p_payload -> 'income_types', '[]'::jsonb))
         as x (name text, month_shift smallint, expected_day smallint, expected_amount bigint, account text)
$$;

create or replace function private.onboarding_rules(p_payload jsonb)
returns table (
  kind public.plan_kind, name text, category text, account text, amount bigint,
  day_of_month smallint, auto_pay boolean, n bigint
)
language sql
stable
set search_path = ''
as $$
  select r.kind, btrim(r.name), btrim(r.category), btrim(r.account), r.amount, r.day_of_month,
         coalesce(r.auto_pay, false), e.n
    from jsonb_array_elements(coalesce(p_payload -> 'recurring', '[]'::jsonb)) with ordinality as e (item, n)
    cross join lateral jsonb_to_record(e.item)
         as r (kind public.plan_kind, name text, category text, account text, amount bigint,
               day_of_month smallint, auto_pay boolean)
$$;

create or replace function private.onboarding_fund(p_payload jsonb)
returns table (mode public.personal_fund_mode, percent numeric, fixed_amount bigint, day smallint, source_account text)
language sql
stable
set search_path = ''
as $$
  select f.mode, f.percent, f.fixed_amount, f.day, btrim(f.source_account)
    from jsonb_to_record(coalesce(p_payload -> 'fund', '{}'::jsonb))
         as f (mode public.personal_fund_mode, percent numeric, fixed_amount bigint, day smallint, source_account text)
$$;

-- Payload (nomlar byudjet ichida registrsiz qidiriladi, contracts/api.md):
--   accounts:     [{name, type, opening_balance}]  — bor bo'lsa joriy qoldiq,
--                                                     yo'q bo'lsa yangi hisob
--   income_types: [{name, month_shift, expected_day?, expected_amount?, account?}]
--   recurring:    [{kind, name, category?, account?, amount?, day_of_month, auto_pay?}]
--   fund:         {mode?, percent?, fixed_amount?, day?, source_account?}
create or replace function public.onboarding_apply(p_household uuid, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_base text;
  v_today date;
  v_missing text;
  v_accounts integer;
  v_income_types integer;
  v_rules integer;
begin
  perform private.require_household_role(p_household, array['owner', 'admin']::public.member_role[]);
  if exists (select 1 from public.households h where h.id = p_household and h.onboarded_at is not null) then
    return jsonb_build_object('applied', false);
  end if;
  select h.base_currency, (now() at time zone h.timezone)::date into v_base, v_today
    from public.households h where h.id = p_household;

  -- ─ 1. Hisoblar: nom (fond — turi) bo'yicha mavjudiga joriy qoldiq ─
  update public.accounts acc
     set opening_balance = i.opening_balance, opening_date = v_today
    from private.onboarding_accounts(p_payload) i
   where acc.household_id = p_household and acc.deleted_at is null
     and (lower(acc.name) = lower(i.name) or (acc.type = 'personal_fund' and i.type = 'personal_fund'));
  insert into public.accounts (household_id, name, type, currency, opening_balance, opening_date, created_by)
  select p_household, i.name, i.type, v_base, i.opening_balance, v_today, v_user
    from private.onboarding_accounts(p_payload) i
   where i.type <> 'personal_fund'
     and not exists (
       select 1 from public.accounts acc
        where acc.household_id = p_household and acc.deleted_at is null and lower(acc.name) = lower(i.name)
     );
  select count(*) into v_accounts from private.onboarding_accounts(p_payload);

  -- Nomlar bo'yicha havolalar tekshiruvi (hisoblar yaratilgandan keyin).
  select n.account into v_missing
    from (select r.account from private.onboarding_rules(p_payload) r
          union all select i.account from private.onboarding_income(p_payload) i
          union all select f.source_account from private.onboarding_fund(p_payload) f) as n (account)
   where n.account is not null
     and not exists (
       select 1 from public.accounts acc
        where acc.household_id = p_household and acc.deleted_at is null and lower(acc.name) = lower(n.account)
     )
   limit 1;
  if v_missing is not null then
    raise exception 'account_not_found' using errcode = 'P0001', detail = v_missing;
  end if;

  -- ─ 2. Daromad turlari va oy qoidalari (BR-031, BR-040) ─
  update public.categories c
     set month_shift = i.month_shift
    from private.onboarding_income(p_payload) i
   where c.household_id = p_household and c.kind = 'income' and c.deleted_at is null
     and lower(c.name) = lower(i.name);
  insert into public.categories (household_id, kind, name, month_shift, created_by)
  select p_household, 'income', i.name, i.month_shift, v_user
    from private.onboarding_income(p_payload) i
   where not exists (
     select 1 from public.categories c
      where c.household_id = p_household and c.kind = 'income' and c.deleted_at is null
        and lower(c.name) = lower(i.name)
   );
  select count(*) into v_income_types from private.onboarding_income(p_payload);

  select r.category into v_missing
    from private.onboarding_rules(p_payload) r
   where r.kind <> 'allocation'
     and not exists (
       select 1 from public.categories c
        where c.household_id = p_household and c.deleted_at is null
          and c.kind::text = r.kind::text and lower(c.name) = lower(r.category)
     )
   limit 1;
  if found then
    raise exception 'category_not_found' using errcode = 'P0001', detail = coalesce(v_missing, '');
  end if;

  -- ─ 3. Doimiy rejalar + kutilayotgan daromad rejalari (BR-077, BR-080) ─
  -- Shu nomli tirik doimiy reja bo'lsa — o'tkaziladi (ustiga yozilmaydi).
  insert into public.recurring_rules (
    household_id, kind, name, category_id, account_id, amount, day_of_month, auto_pay, sort_order, created_by
  )
  select p_household, s.kind, s.name, c.id, acc.id, s.amount, s.day_of_month, s.auto_pay, s.n, v_user
    from (
      select r.kind, r.name, r.category, r.account, r.amount, r.day_of_month, r.auto_pay, r.n
        from private.onboarding_rules(p_payload) r
      union all
      select 'income', i.name, i.name, i.account, i.expected_amount, i.expected_day, false,
             1000 + row_number() over ()
        from private.onboarding_income(p_payload) i
       where i.expected_day is not null
    ) s
    left join public.categories c
      on c.household_id = p_household and c.deleted_at is null
     and c.kind::text = s.kind::text and lower(c.name) = lower(s.category)
    left join public.accounts acc
      on acc.household_id = p_household and acc.deleted_at is null and lower(acc.name) = lower(s.account)
   where not exists (
     select 1 from public.recurring_rules x
      where x.household_id = p_household and x.deleted_at is null and lower(x.name) = lower(s.name)
   );
  get diagnostics v_rules = row_count;

  -- ─ 4. Fond qoidasi (BR-060) va yakun ─
  update public.households h
     set personal_fund_mode = coalesce(f.mode, h.personal_fund_mode),
         personal_fund_percent = coalesce(f.percent, h.personal_fund_percent),
         personal_fund_fixed_amount = coalesce(f.fixed_amount, h.personal_fund_fixed_amount),
         personal_fund_day = coalesce(f.day, h.personal_fund_day),
         personal_fund_source_account_id = coalesce(acc.id, h.personal_fund_source_account_id),
         onboarded_at = now()
    from private.onboarding_fund(p_payload) f
    left join public.accounts acc
      on acc.household_id = p_household and acc.deleted_at is null and lower(acc.name) = lower(f.source_account)
   where h.id = p_household;

  return jsonb_build_object(
    'applied', true,
    'accounts', v_accounts,
    'income_types', v_income_types,
    'recurring_rules', v_rules
  );
end;
$$;

grant execute on function public.onboarding_apply(uuid, jsonb) to authenticated;
