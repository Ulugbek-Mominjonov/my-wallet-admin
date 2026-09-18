-- E01-T02: asoslar — kengaytmalar, sxemalar, UUIDv7, umumiy triggerlar,
-- sinxron sequence. (ADR-02, ADR-07, ARXITEKTURA 6-bo'lim)

-- ─── Kengaytmalar ──────────────────────────────────────────────────────────
-- pg_trgm — xatoga chidamli qidiruv va o'xshash nom taklifi (BR-117, BR-202).
create extension if not exists pg_trgm with schema extensions;
-- pg_cron + pg_net — rejali ishlar va Edge Function chaqiruvlari (E11).
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- ─── Sxemalar ──────────────────────────────────────────────────────────────
-- private — RLS yordamchilari va trigger funksiyalari; PostgREST'da ochiq emas.
create schema if not exists private;
revoke all on schema private from public;
-- RLS siyosatlari va ustun default'lari private funksiyalarni chaqiradi.
grant usage on schema private to authenticated, service_role;

-- jobs — pg_cron chaqiradigan funksiyalar; faqat postgres/service_role.
create schema if not exists jobs;
revoke all on schema jobs from public;

-- Xavfsiz standart: Supabase `public` dagi yangi obyektlarga anon va
-- authenticated rollarga avtomatik huquq beradi. Biz buni yopamiz —
-- har RPC ga kerakli rol ALOHIDA grant bilan beriladi, anon esa jadvallarni
-- umuman ko'rmaydi (RLS'dan tashqari ikkinchi himoya qatlami).
--
-- Postgres har yangi funksiyaga PUBLIC ga EXECUTE beradi; bu GLOBAL standart
-- va uni faqat sxemasiz ALTER DEFAULT PRIVILEGES bilan olib tashlash mumkin
-- (IN SCHEMA ... REVOKE unga ta'sir qilmaydi). Trigger funksiyalari EXECUTE
-- huquqisiz ham ishlaydi, shuning uchun ularga grant kerak emas.
alter default privileges revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;

-- ─── UUIDv7 ────────────────────────────────────────────────────────────────
-- Postgres 17 da uuidv7() yo'q. Birinchi 48 bit — millisekund vaqt, qolgani
-- tasodifiy: vaqt bo'yicha tartiblangan, B-tree indeks lokalligi yaxshi
-- (ADR-07). Asosiy manba — klient (offline yaratish); bu — server default.
create or replace function private.uuid_v7()
returns uuid
language sql
volatile
parallel safe
set search_path = ''
as $$
  select encode(
    set_bit(
      set_bit(
        overlay(
          uuid_send(gen_random_uuid())
          placing substring(int8send((extract(epoch from clock_timestamp()) * 1000)::bigint) from 3)
          from 1 for 6
        ),
        52, 1
      ),
      53, 1
    ),
    'hex'
  )::uuid;
$$;

comment on function private.uuid_v7() is
  'UUID v7 (RFC 9562): 48 bit ms vaqt + tasodifiy qism. Jadvallarda id default.';

-- ─── Sinxron kursori ───────────────────────────────────────────────────────
-- Barcha sinxron jadvallar uchun BITTA global sequence (ARXITEKTURA 6).
create sequence if not exists private.sync_seq as bigint;

-- Advisory lock nomlar fazosi: boshqa lock'lar bilan to'qnashmasligi uchun.
-- Qiymat — ixtiyoriy doimiy, faqat sinxron uchun band.
create or replace function private.sync_lock_namespace()
returns integer
language sql
immutable
parallel safe
set search_path = ''
as $$ select 7201 $$;

-- BEFORE INSERT OR UPDATE: row_version va updated_at.
--
-- Nega advisory lock: bitta byudjetning yozuvlari ketma-ket commit
-- qilinishi kerak. Aks holda kichik row_version olgan tranzaksiya kattasidan
-- keyin commit bo'lib, klient kursori uni o'tkazib yuborishi mumkin edi.
-- Lock tranzaksiya oxirigacha turadi, nextval esa lock ichida olinadi —
-- shuning uchun row_version bitta byudjet ichida commit tartibida o'sadi.
-- Boshqa byudjetlar bir-birini bloklamaydi.
create or replace function private.touch_synced_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(
    private.sync_lock_namespace(),
    hashtext(new.household_id::text)
  );
  new.row_version := nextval('private.sync_seq');
  new.updated_at := now();
  return new;
end;
$$;

comment on function private.touch_synced_row() is
  'Sinxron jadvallar uchun: byudjet bo''yicha advisory lock, row_version, updated_at.';

-- BEFORE UPDATE: sinxron bo'lmagan jadvallar uchun updated_at.
create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Kafolat: bu sxemalardagi funksiyalarda PUBLIC EXECUTE yo'q. uuid_v7 —
-- jadval ustunlari default'i bo'lgani uchun authenticated'ga ochiq.
revoke execute on all functions in schema private, jobs from public;
grant execute on function private.uuid_v7() to authenticated, service_role;
