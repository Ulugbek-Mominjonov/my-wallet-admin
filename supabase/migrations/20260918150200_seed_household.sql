-- E06-T08: yangi byudjetga standart to'plam — kategoriyalar (shablondan,
-- foydalanuvchi tilida), hisoblar (Naqd, Karta, 👤 Shaxsiy fond) va fond
-- qoidasi manbai. Qoidalar: BR-010, BR-031, BR-032, BR-033, BR-060.

create or replace function private.seed_household(
  p_household uuid,
  p_locale text,
  p_user uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_locale text := case when p_locale in ('uz', 'ru', 'en') then p_locale else 'uz' end;
  v_skip_audit text := current_setting('app.skip_audit', true);
begin
  -- Tizim yaratgan standart yozuvlar audit jurnalida shovqin bo'lmasin.
  perform set_config('app.skip_audit', 'on', true);

  insert into public.categories (
    household_id, kind, name, month_shift, system_code, icon, color, sort_order, created_by
  )
  select p_household, t.kind, t.name_i18n ->> v_locale, t.month_shift, t.system_code,
         t.icon, t.color, t.sort_order, p_user
    from public.category_templates t;

  insert into public.accounts (
    household_id, name, type, currency, opening_date, icon, color, sort_order, created_by
  )
  select p_household, a.name_i18n ->> v_locale, a.type, h.base_currency,
         (now() at time zone h.timezone)::date, a.icon, a.color, a.sort_order, p_user
    from public.households h
   cross join (values
     ('{"uz": "Naqd", "ru": "Наличные", "en": "Cash"}'::jsonb, 'cash'::public.account_type, 'banknote', '#16A34A', 1),
     ('{"uz": "Karta", "ru": "Карта", "en": "Card"}', 'card', 'credit-card', '#4F46E5', 2),
     ('{"uz": "Shaxsiy fond", "ru": "Личный фонд", "en": "Personal fund"}', 'personal_fund', 'user', '#8B5CF6', 3)
   ) as a (name_i18n, type, icon, color, sort_order)
   where h.id = p_household;

  -- BR-060 standarti: 10%, 5-kun (households default'lari), manba — naqd.
  update public.households h
     set personal_fund_source_account_id = a.id
    from public.accounts a
   where h.id = p_household
     and a.household_id = p_household
     and a.type = 'cash';

  perform set_config('app.skip_audit', coalesce(v_skip_audit, ''), true);
end;
$$;

-- Ro'yxatdan o'tish (handle_new_user) va create_household ikkalasi shu
-- funksiya orqali — standart to'plam har yangi byudjetga tushadi.
create or replace function private.create_household_for(
  p_user uuid,
  p_name text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_household uuid;
begin
  insert into public.households (name, created_by)
  values (btrim(p_name), p_user)
  returning id into v_household;

  insert into public.household_members (household_id, user_id, role)
  values (v_household, p_user, 'owner');

  perform private.seed_household(
    v_household,
    (select p.locale from public.profiles p where p.user_id = p_user),
    p_user
  );

  return v_household;
end;
$$;

-- Standart to'plamsiz qolgan mavjud byudjetlar (shu migratsiyadan oldin
-- yaratilganlar) ham uni oladi.
select private.seed_household(h.id, p.locale, h.created_by)
  from public.households h
  left join public.profiles p on p.user_id = h.created_by
 where not exists (select 1 from public.accounts a where a.household_id = h.id);
