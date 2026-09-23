-- E09-T06: kontrakt testlari uchun fixture yuklovchi (faqat test sessiyasida;
-- migratsiyaga kirmaydi). Fixture formati — contracts/fixtures/README.md.
--
-- Yangi foydalanuvchi ro'yxatdan o'tadi (standart to'plam bilan), so'ng
-- `setup` bo'limi normal jadvallarga yoziladi — triggerlar va cheklovlar
-- ishlaydi, ya'ni fixture haqiqiy yozuv yo'li bilan tekshiriladi.
create or replace function pg_temp.load_fixture(p_case jsonb)
returns table (household_id uuid, user_id uuid)
language plpgsql
as $$
declare
  v_user uuid := gen_random_uuid();
  v_household uuid;
  v_setup jsonb := coalesce(p_case -> 'setup', '{}'::jsonb);
  v_item jsonb;
  v_id uuid;
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                          email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', v_user, 'authenticated', 'authenticated',
          v_user || '@fixture.test', '', now(), '{}', '{}', now(), now());
  select p.last_household_id into v_household from public.profiles p where p.user_id = v_user;

  -- Kalitlar: hisoblar (standart: cash, card, fund), kategoriyalar (nom), rejalar, qarzlar.
  create temporary table if not exists fx_keys (key text primary key, id uuid) on commit drop;
  delete from fx_keys;
  insert into fx_keys
  select case a.type when 'personal_fund' then 'account:fund' else 'account:' || a.type::text end, a.id
    from public.accounts a where a.household_id = v_household;
  insert into fx_keys
  select 'category:' || c.name, c.id from public.categories c where c.household_id = v_household;

  update public.households h
     set personal_fund_mode = coalesce((v_setup #>> '{household,fund,mode}')::public.personal_fund_mode, h.personal_fund_mode),
         personal_fund_percent = coalesce((v_setup #>> '{household,fund,percent}')::numeric, h.personal_fund_percent),
         personal_fund_fixed_amount = coalesce((v_setup #>> '{household,fund,fixed_amount}')::bigint, h.personal_fund_fixed_amount),
         personal_fund_day = coalesce((v_setup #>> '{household,fund,day}')::smallint, h.personal_fund_day)
   where h.id = v_household;

  for v_item in select * from jsonb_array_elements(coalesce(v_setup -> 'categories', '[]')) loop
    insert into public.categories (household_id, kind, name, month_shift, parent_id)
    values (v_household, (v_item ->> 'kind')::public.category_kind, v_item ->> 'name',
            coalesce((v_item ->> 'month_shift')::smallint, 0),
            (select k.id from fx_keys k where k.key = 'category:' || (v_item ->> 'parent')))
    returning id into v_id;
    insert into fx_keys values ('category:' || (v_item ->> 'name'), v_id);
  end loop;

  for v_item in select * from jsonb_array_elements(coalesce(v_setup -> 'accounts', '[]')) loop
    insert into public.accounts (household_id, name, type, currency, opening_balance, opening_date)
    values (v_household, v_item ->> 'name', (v_item ->> 'type')::public.account_type,
            coalesce(v_item ->> 'currency', 'UZS'), coalesce((v_item ->> 'opening_balance')::bigint, 0),
            coalesce((v_item ->> 'opening_date')::date, (p_case ->> 'today')::date))
    returning id into v_id;
    insert into fx_keys values ('account:' || (v_item ->> 'key'), v_id);
  end loop;
  -- Standart hisoblarning boshlang'ich qoldig'i (ixtiyoriy).
  update public.accounts a
     set opening_balance = (o.value)::bigint
    from jsonb_each_text(coalesce(v_setup -> 'opening_balances', '{}')) as o (key, value)
    join fx_keys k on k.key = 'account:' || o.key
   where a.id = k.id;

  -- E29-T05: ko'p valyutali holatlar uchun kurslar (BR-191).
  for v_item in select * from jsonb_array_elements(coalesce(v_setup -> 'rates', '[]')) loop
    insert into public.exchange_rates (currency, rate_date, rate_to_base, source)
    values (v_item ->> 'currency', (v_item ->> 'date')::date,
            (v_item ->> 'rate')::numeric, coalesce(v_item ->> 'source', 'CBU'))
    on conflict (currency, rate_date) do update set rate_to_base = excluded.rate_to_base;
  end loop;

  for v_item in select * from jsonb_array_elements(coalesce(v_setup -> 'limits', '[]')) loop
    insert into public.category_limits (household_id, category_id, amount, rollover, rollover_negative)
    values (v_household, (select k.id from fx_keys k where k.key = 'category:' || (v_item ->> 'category')),
            (v_item ->> 'amount')::bigint,
            coalesce((v_item ->> 'rollover')::boolean, false),
            coalesce((v_item ->> 'rollover_negative')::boolean, false));
  end loop;

  for v_item in select * from jsonb_array_elements(coalesce(v_setup -> 'debts', '[]')) loop
    insert into public.debts (household_id, name, direction, currency, total, paid_before, monthly_payment)
    values (v_household, v_item ->> 'name', (v_item ->> 'direction')::public.debt_direction,
            coalesce(v_item ->> 'currency', 'UZS'),
            (v_item ->> 'total')::bigint, coalesce((v_item ->> 'paid_before')::bigint, 0),
            (v_item ->> 'monthly_payment')::bigint)
    returning id into v_id;
    insert into fx_keys values ('debt:' || (v_item ->> 'key'), v_id);
  end loop;

  for v_item in select * from jsonb_array_elements(coalesce(v_setup -> 'goals', '[]')) loop
    insert into public.goals (household_id, name, currency, target, saved_manual, monthly_contribution, deadline, account_id)
    values (v_household, v_item ->> 'name', 'UZS', (v_item ->> 'target')::bigint,
            coalesce((v_item ->> 'saved')::bigint, 0), (v_item ->> 'monthly')::bigint,
            (v_item ->> 'deadline')::date,
            (select k.id from fx_keys k where k.key = 'account:' || (v_item ->> 'account')));
  end loop;

  for v_item in select * from jsonb_array_elements(coalesce(v_setup -> 'plans', '[]')) loop
    insert into public.planned_items (household_id, kind, name, category_id, account_id, planned_amount,
                                      due_date, budget_month, debt_id, system_code)
    values (v_household, (v_item ->> 'kind')::public.plan_kind, v_item ->> 'name',
            (select k.id from fx_keys k where k.key = 'category:' || (v_item ->> 'category')),
            (select k.id from fx_keys k where k.key = 'account:' || (v_item ->> 'account')),
            (v_item ->> 'planned')::bigint, (v_item ->> 'due')::date, (v_item ->> 'month')::date,
            (select k.id from fx_keys k where k.key = 'debt:' || (v_item ->> 'debt')),
            case when (v_item ->> 'system')::boolean then 'personal_allocation'::public.plan_system_code end)
    returning id into v_id;
    insert into fx_keys values ('plan:' || (v_item ->> 'key'), v_id);
  end loop;

  for v_item in select * from jsonb_array_elements(coalesce(v_setup -> 'transactions', '[]')) loop
    insert into public.transactions (household_id, kind, account_id, to_account_id, amount, to_amount,
                                     category_id, occurred_on, budget_month, budget_month_source,
                                     planned_item_id, debt_id, payee, fx_rate)
    values (v_household, (v_item ->> 'kind')::public.transaction_kind,
            (select k.id from fx_keys k where k.key = 'account:' || (v_item ->> 'account')),
            (select k.id from fx_keys k where k.key = 'account:' || (v_item ->> 'to')),
            (v_item ->> 'amount')::bigint, (v_item ->> 'to_amount')::bigint,
            (select k.id from fx_keys k where k.key = 'category:' || (v_item ->> 'category')),
            (v_item ->> 'date')::date,
            coalesce((v_item ->> 'month')::date, date_trunc('month', (v_item ->> 'date')::timestamp)::date),
            case when v_item ? 'month' then 'manual' else 'auto' end::public.budget_month_source,
            (select k.id from fx_keys k where k.key = 'plan:' || (v_item ->> 'plan')),
            (select k.id from fx_keys k where k.key = 'debt:' || (v_item ->> 'debt')),
            v_item ->> 'payee', (v_item ->> 'fx_rate')::numeric);
    -- Eski tizimda istalgan to'lov rejani yopardi — "settle" shu xulqni beradi.
    if (v_item ->> 'settle')::boolean then
      update public.planned_items p set closed_at = now()
       where p.id = (select k.id from fx_keys k where k.key = 'plan:' || (v_item ->> 'plan'));
    end if;
  end loop;

  household_id := v_household;
  user_id := v_user;
  return next;
end;
$$;
