#!/usr/bin/env bash
# Supabase bazasining to'liq zaxirasi (ADR-12): rollar, sxema, ma'lumot.
# Supabase rasmiy tartibi: https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
#
#   SUPABASE_DB_URL=postgresql://... scripts/backup-dump.sh <papka>
#
# SUPABASE_DB_URL — session pooler satri (IPv4; GitHub runner'lari uchun).
# SUPABASE_PROJECT_REF (+ SUPABASE_ACCESS_TOKEN) berilsa — chek rasmlari
# (receipts bucket) ham <papka>/storage ga yuklab olinadi.
set -euo pipefail

if [ $# -ne 1 ] || [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "Foydalanish: SUPABASE_DB_URL=... $0 <papka>" >&2
  exit 2
fi
out="$1"

# Supabase'ning biz ishlatmaydigan ichki storage jadvallari (vektor, iceberg,
# analytics): ularga yangi loyihada postgres yozolmaydi va ma'lumot yo'q.
# storage.objects — fayl metama'lumoti: tiklashda fayllar Storage API orqali
# qayta yuklanadi va u o'zi yaratadi (dump'dagi qator yuklashni bloklardi).
EXCLUDE="storage.objects,storage.buckets_vectors,storage.vector_indexes,storage.iceberg_tables,storage.iceberg_namespaces,storage.buckets_analytics"
RECEIPTS_BUCKET="receipts"

mkdir -p "$out"
pnpm exec supabase db dump --db-url "$SUPABASE_DB_URL" -f "$out/roles.sql" --role-only
pnpm exec supabase db dump --db-url "$SUPABASE_DB_URL" -f "$out/schema.sql"
pnpm exec supabase db dump --db-url "$SUPABASE_DB_URL" -f "$out/data.sql" --use-copy --data-only \
  -x "$EXCLUDE"

# Storage RLS siyosatlari: `db dump` storage sxemasini olmaydi, ularsiz
# tiklangan loyihada chek yuklab/ko'rib bo'lmaydi — alohida SQL sifatida.
psql "$SUPABASE_DB_URL" --no-psqlrc --tuples-only --no-align --quiet --output "$out/storage-policies.sql" --command "
  select format(
           'drop policy if exists %I on storage.objects; create policy %I on storage.objects as %s for %s to %s%s%s;',
           policyname, policyname, permissive, cmd, array_to_string(roles, ', '),
           coalesce(' using (' || qual || ')', ''),
           coalesce(' with check (' || with_check || ')', ''))
    from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
   order by policyname"

# Chek rasmlari (E07-T10): DB dump faqat metama'lumotni (storage.objects)
# oladi, fayllarning o'zi — Storage API orqali. Loglar public repoda ochiq,
# shuning uchun fayl yo'llari chiqarilmaydi — faqat natija.
if [ -n "${SUPABASE_PROJECT_REF:-}" ]; then
  if ! pnpm exec supabase storage cp -r "ss:///$RECEIPTS_BUCKET" "$out/storage" \
      --experimental --project-ref "$SUPABASE_PROJECT_REF" --jobs 4 > /dev/null 2>&1; then
    echo "::error::chek rasmlarini yuklab bo'lmadi" >&2
    exit 1
  fi
  expected="$(psql "$SUPABASE_DB_URL" --no-psqlrc --tuples-only --no-align \
    --command "select count(*) from storage.objects where bucket_id = '$RECEIPTS_BUCKET'")"
  actual="$(find "$out/storage" -type f | wc -l)"
  if [ "$expected" != "$actual" ]; then
    echo "::error::chek rasmlari soni bazadagi yozuvlar bilan mos emas" >&2
    exit 1
  fi
fi
echo "Zaxira tayyor: $out (roles, schema, data, storage siyosatlari${SUPABASE_PROJECT_REF:+, chek rasmlari})"
