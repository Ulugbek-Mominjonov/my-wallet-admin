-- E26-T02: ilova konfiguratsiyasini (BR-214 minimal versiya, texnik ishlar
-- banneri, flaglar) platforma admini admin paneldan boshqaradi.
--
-- Qiymatlar hamma klientga `app_bootstrap` orqali boradi, shuning uchun
-- ma'lum kalitlar shakli bazada tekshiriladi: xato qiymat mobil ilovani
-- to'xtatib qo'yishi mumkin.
alter table public.app_config
  add constraint app_config_known_values check (
    case key
      when 'min_android_version' then
        jsonb_typeof(value) = 'string' and (value #>> '{}') ~ '^\d+\.\d+\.\d+$'
      when 'maintenance' then
        value = 'null'::jsonb
        or (jsonb_typeof(value) = 'object'
            and jsonb_typeof(value -> 'message') = 'object'
            and value -> 'message' ?& array['uz', 'ru', 'en'])
      else true
    end
  ) not valid;

alter table public.app_config validate constraint app_config_known_values;

create policy app_config_admin on public.app_config for all to authenticated
  using ((select private.is_platform_admin()))
  with check ((select private.is_platform_admin()));

-- Standart grant'lar o'rniga aniq ro'yxat (E01 xavfsizlik standarti).
revoke all on public.app_config from authenticated;
grant select, insert, update, delete on public.app_config to authenticated;
