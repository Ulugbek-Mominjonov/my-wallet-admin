#!/usr/bin/env bash
# Zaxirani tiklash (ADR-12, DEPLOY.md 8-bo'lim).
#
#   scripts/restore.sh <papka> <db-url>   — berilgan bazaga (staging yoki lokal);
#                                           SUPABASE_PROJECT_REF (+ SUPABASE_ACCESS_TOKEN)
#                                           berilsa — chek rasmlari ham o'sha loyihaga
#   scripts/restore.sh <papka> --verify   — vaqtinchalik toza Supabase'ga tiklab,
#                                           qatorlar sonini manba bilan solishtiradi
#                                           (SUPABASE_DB_URL = manba; CI kechki ishi)
#
# Loglar public repoda ochiq: bu skript raqam yoki ma'lumot chiqarmaydi,
# faqat natija (mos / mos emas jadvallar nomi).
set -euo pipefail

usage() {
  echo "Foydalanish: $0 <papka> <db-url | --verify>" >&2
  exit 2
}
[ $# -eq 2 ] || usage
dir="$1"
target="$2"

restore_into() {
  psql --single-transaction --variable ON_ERROR_STOP=1 --quiet --output /dev/null \
    --file "$dir/roles.sql" \
    --file "$dir/schema.sql" \
    --command 'SET session_replication_role = replica' \
    --file "$dir/data.sql" \
    --command 'SET client_min_messages = warning' \
    --file "$dir/storage-policies.sql" \
    --dbname "$1"
}

# Chek rasmlari: <papka>/storage/<byudjet>/... → receipts/<byudjet>/...
# (`cp -r` papka nomini ham yo'lga qo'shadi — shuning uchun har byudjet alohida).
restore_storage() {
  [ -d "$dir/storage" ] || return 0
  if [ -z "${SUPABASE_PROJECT_REF:-}" ]; then
    echo "Chek rasmlari tiklanmadi: SUPABASE_PROJECT_REF va SUPABASE_ACCESS_TOKEN bilan qayta ishga tushiring." >&2
    return 0
  fi
  local household_dir
  for household_dir in "$dir"/storage/*/; do
    [ -d "$household_dir" ] || continue
    pnpm exec supabase storage cp -r "${household_dir%/}" "ss:///receipts" \
      --experimental --project-ref "$SUPABASE_PROJECT_REF" --jobs 4 > /dev/null
  done
}

# public jadvallardagi qatorlar soni: "jadval|son" qatorlari (+ storage
# siyosatlari soni — chek rasmlariga huquqlar ham tiklanganini tekshirish).
row_counts() {
  psql --no-psqlrc --tuples-only --no-align --dbname "$1" --command "
    select format('%s|%s', table_name,
      (xpath('/row/c/text()', query_to_xml(
        format('select count(*) as c from public.%I', table_name), false, true, '')))[1]::text)
      from information_schema.tables
     where table_schema = 'public' and table_type = 'BASE TABLE'
    union all
    select format('storage.objects siyosatlari|%s', count(*))
      from pg_policies where schemaname = 'storage' and tablename = 'objects'
     order by 1"
}

if [ "$target" != "--verify" ]; then
  restore_into "$target"
  restore_storage
  echo "Tiklandi. Migratsiya tarixi uchun: supabase migration repair (DEPLOY.md 8)."
  exit 0
fi

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "--verify uchun manba baza SUPABASE_DB_URL kerak" >&2
  exit 2
fi
workdir="$(mktemp -d)"
cleanup() {
  pnpm exec supabase stop --workdir "$workdir" --no-backup > /dev/null 2>&1 || true
  rm -rf "$workdir"
}
trap cleanup EXIT

pnpm exec supabase init --workdir "$workdir" > /dev/null
# Asosiy lokal stek (543xx) bilan to'qnashmasligi uchun portlar 553xx ga suriladi.
sed -i 's/= 543\([0-9][0-9]\)/= 553\1/' "$workdir/supabase/config.toml"
pnpm exec supabase start --workdir "$workdir" \
  -x studio,imgproxy,edge-runtime,logflare,vector,supavisor,realtime,mailpit,postgres-meta > /dev/null
local_url="postgresql://postgres:postgres@127.0.0.1:55322/postgres"

restore_into "$local_url"

if diff <(row_counts "$SUPABASE_DB_URL") <(row_counts "$local_url") > /dev/null; then
  echo "✅ Tiklash tekshiruvi: public jadvallar qatorlari va storage siyosatlari soni mos."
else
  echo "::error::Tiklangan bazada qatorlar soni mos emas. Jadvallar:"
  diff <(row_counts "$SUPABASE_DB_URL" | cut -d'|' -f1,2) <(row_counts "$local_url" | cut -d'|' -f1,2) \
    | grep '^[<>]' | cut -d'|' -f1 | sed 's/^[<>] //' | sort -u
  exit 1
fi
