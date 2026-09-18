#!/usr/bin/env bash
# Zaxirani tiklash (ADR-12, DEPLOY.md 8-bo'lim).
#
#   scripts/restore.sh <papka> <db-url>   — berilgan bazaga (staging yoki lokal)
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
    --dbname "$1"
}

# public jadvallardagi qatorlar soni: "jadval|son" qatorlari.
row_counts() {
  psql --no-psqlrc --tuples-only --no-align --dbname "$1" --command "
    select format('%s|%s', table_name,
      (xpath('/row/c/text()', query_to_xml(
        format('select count(*) as c from public.%I', table_name), false, true, '')))[1]::text)
      from information_schema.tables
     where table_schema = 'public' and table_type = 'BASE TABLE'
     order by table_name"
}

if [ "$target" != "--verify" ]; then
  restore_into "$target"
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
  echo "✅ Tiklash tekshiruvi: barcha public jadvallar qatorlari soni mos."
else
  echo "::error::Tiklangan bazada qatorlar soni mos emas. Jadvallar:"
  diff <(row_counts "$SUPABASE_DB_URL" | cut -d'|' -f1,2) <(row_counts "$local_url" | cut -d'|' -f1,2) \
    | grep '^[<>]' | cut -d'|' -f1 | sed 's/^[<>] //' | sort -u
  exit 1
fi
