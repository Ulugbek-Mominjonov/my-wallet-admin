-- E14-T02: app_bootstrap valyutalariga `allocation_rounding` (BR-060) —
-- mobil fond ajratmasini oldindan ko'rsatishi uchun birlik kerak
-- (domendagi `Currency.allocationUnit` shundan). Qo'shimcha maydon:
-- eski klientlar ta'sirlanmaydi.
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
                 'exponent', c.exponent,
                 'allocation_rounding', c.allocation_rounding
               ) order by c.sort_order
             )
        from public.currencies c
       where c.active
    ), '[]'::jsonb),
    'app_config', coalesce((select jsonb_object_agg(c.key, c.value) from public.app_config c), '{}'::jsonb)
  )
$$;
