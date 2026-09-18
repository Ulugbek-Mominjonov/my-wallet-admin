-- E03-T05: health() — keep-alive (ADR-13), deploy smoke testlari va
-- monitoring uchun. anon ham chaqira oladigan YAGONA funksiya
-- (900_security_invariants testi buni kafolatlaydi).

-- API shartnomasi versiyasi (contracts/schema-version bilan bir xil).
-- Shartnoma buziladigan o'zgarishda shu yerda ham oshiriladi.
create or replace function private.api_schema_version()
returns integer
language sql
immutable
parallel safe
set search_path = ''
as $$ select 1 $$;

-- security definer: anon private sxemaga kirmasdan versiyani oladi
-- (private anon uchun yopiq qoladi). Funksiya faqat doimiy va vaqt qaytaradi.
create or replace function public.health()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'ok', true,
    'time', now(),
    'schema_version', private.api_schema_version()
  );
$$;

comment on function public.health() is
  'Keep-alive va smoke test: {ok, time, schema_version}. anon uchun ochiq.';

grant execute on function private.api_schema_version() to authenticated;
grant execute on function public.health() to anon, authenticated;
