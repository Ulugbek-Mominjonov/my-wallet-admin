-- E01-T04: pgTAP test yordamchilari.
--
-- Bu fayl ATAYLAB tranzaksiyasiz: `tests` sxemasi keyingi test fayllari
-- uchun saqlanib qoladi (pg_prove fayllarni alifbo tartibida ishga tushiradi).
-- Faqat lokal/CI bazasida mavjud — migratsiyalarda emas, prod'ga tushmaydi.

create extension if not exists pgtap with schema extensions;

create schema if not exists tests;
grant usage on schema tests to anon, authenticated;

-- Test foydalanuvchisi: auth.users ga yozadi, id qaytaradi.
-- auth triggerlari (E05: profil + shaxsiy byudjet) ham ishlaydi.
create or replace function tests.create_user(p_email text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  )
  values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
    p_email, '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()
  );
  return v_id;
end;
$$;

-- Joriy tranzaksiyada `authenticated` roli va JWT claim'lari bilan ishlash
-- (PostgREST so'rovi bilan bir xil sharoit — RLS amal qiladi).
create or replace function tests.authenticate_as(p_user uuid, p_aal text default 'aal1')
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated', 'aal', p_aal)::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

-- Anonim (publishable kalit bilan kelgan) so'rov sharoiti.
create or replace function tests.authenticate_as_anon()
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  perform set_config('role', 'anon', true);
end;
$$;

-- Test egasiga (postgres) qaytish.
create or replace function tests.clear_authentication()
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform set_config('request.jwt.claims', '', true);
  reset role;
end;
$$;

grant execute on all functions in schema tests to anon, authenticated;

select plan(1);
select has_schema('tests', 'test yordamchilari o''rnatildi');
select * from finish();
