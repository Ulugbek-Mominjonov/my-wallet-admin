-- Supabase Performance Advisor: "Multiple Permissive Policies" — spravochnik
-- jadvallarida o'qish uchun ikkita permissive siyosat bor edi: hamma uchun
-- `*_select` va platforma admini uchun `for all`. `for all` SELECT'ni ham
-- qamragani uchun har o'qishda ikkala shart baholanardi.
--
-- Admin siyosati endi faqat yozishni qamraydi (insert/update/delete); o'qishni
-- avvalgidek `*_select` beradi — adminlar ham shu orqali o'qiydi. Huquqlar
-- o'zgarmaydi: 020_system_directories testi buni tekshiradi.

-- currencies
drop policy if exists currencies_admin on public.currencies;

create policy currencies_admin_insert on public.currencies for insert to authenticated
  with check ((select private.is_platform_admin()));

create policy currencies_admin_update on public.currencies for update to authenticated
  using ((select private.is_platform_admin()))
  with check ((select private.is_platform_admin()));

create policy currencies_admin_delete on public.currencies for delete to authenticated
  using ((select private.is_platform_admin()));

-- category_templates
drop policy if exists category_templates_admin on public.category_templates;

create policy category_templates_admin_insert on public.category_templates for insert to authenticated
  with check ((select private.is_platform_admin()));

create policy category_templates_admin_update on public.category_templates for update to authenticated
  using ((select private.is_platform_admin()))
  with check ((select private.is_platform_admin()));

create policy category_templates_admin_delete on public.category_templates for delete to authenticated
  using ((select private.is_platform_admin()));

-- exchange_rates
drop policy if exists exchange_rates_admin on public.exchange_rates;

create policy exchange_rates_admin_insert on public.exchange_rates for insert to authenticated
  with check ((select private.is_platform_admin()));

create policy exchange_rates_admin_update on public.exchange_rates for update to authenticated
  using ((select private.is_platform_admin()))
  with check ((select private.is_platform_admin()));

create policy exchange_rates_admin_delete on public.exchange_rates for delete to authenticated
  using ((select private.is_platform_admin()));

-- app_config
drop policy if exists app_config_admin on public.app_config;

create policy app_config_admin_insert on public.app_config for insert to authenticated
  with check ((select private.is_platform_admin()));

create policy app_config_admin_update on public.app_config for update to authenticated
  using ((select private.is_platform_admin()))
  with check ((select private.is_platform_admin()));

create policy app_config_admin_delete on public.app_config for delete to authenticated
  using ((select private.is_platform_admin()));
