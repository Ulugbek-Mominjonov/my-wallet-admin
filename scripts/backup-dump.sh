#!/usr/bin/env bash
# Supabase bazasining to'liq zaxirasi (ADR-12): rollar, sxema, ma'lumot.
# Supabase rasmiy tartibi: https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
#
#   SUPABASE_DB_URL=postgresql://... scripts/backup-dump.sh <papka>
#
# SUPABASE_DB_URL — session pooler satri (IPv4; GitHub runner'lari uchun).
set -euo pipefail

if [ $# -ne 1 ] || [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "Foydalanish: SUPABASE_DB_URL=... $0 <papka>" >&2
  exit 2
fi
out="$1"

# Supabase'ning biz ishlatmaydigan ichki storage jadvallari (vektor, iceberg,
# analytics): ularga yangi loyihada postgres yozolmaydi va ma'lumot yo'q.
# Chek rasmlari (storage fayllari) DB dump'iga kirmaydi — E07-T10.
EXCLUDE="storage.buckets_vectors,storage.vector_indexes,storage.iceberg_tables,storage.iceberg_namespaces,storage.buckets_analytics"

mkdir -p "$out"
pnpm exec supabase db dump --db-url "$SUPABASE_DB_URL" -f "$out/roles.sql" --role-only
pnpm exec supabase db dump --db-url "$SUPABASE_DB_URL" -f "$out/schema.sql"
pnpm exec supabase db dump --db-url "$SUPABASE_DB_URL" -f "$out/data.sql" --use-copy --data-only \
  -x "$EXCLUDE"
echo "Zaxira tayyor: $out (roles, schema, data)"
