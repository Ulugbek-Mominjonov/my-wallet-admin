#!/usr/bin/env bash
# Deploy (E11): Edge Function sirlari va pg_cron uchun Vault yozuvlari.
# Qiymatlar faqat muhitdan (GitHub Environment secrets) — repoda yo'q.
#
#   SUPABASE_PROJECT_REF=... SUPABASE_URL=https://<ref>.supabase.co CRON_SECRET=... \
#   [FCM_SERVICE_ACCOUNT=... TELEGRAM_BOT_TOKEN=... TELEGRAM_WEBHOOK_SECRET=...] \
#   scripts/deploy-secrets.sh
#
# SUPABASE_ACCESS_TOKEN — CLI uchun (Management API). Loyiha `supabase link`
# qilingan bo'lishi kerak (Vault yozuvi `db query --linked` bilan).
set -euo pipefail

: "${SUPABASE_PROJECT_REF:?}" "${SUPABASE_URL:?}" "${CRON_SECRET:?}"
# SQL satri va HTTP sarlavhasida xavfsiz belgilar (openssl rand -hex 32).
if ! [[ "$CRON_SECRET" =~ ^[A-Za-z0-9_-]{32,}$ ]]; then
  echo "CRON_SECRET: kamida 32 ta [A-Za-z0-9_-] belgi bo'lishi kerak" >&2
  exit 1
fi

env_file=$(mktemp)
sql_file=$(mktemp)
trap 'rm -f "$env_file" "$sql_file"' EXIT
chmod 600 "$env_file" "$sql_file"

# Edge Function muhiti. Ixtiyoriylari bo'sh bo'lsa — kanal "sozlanmagan".
{
  echo "CRON_SECRET=$CRON_SECRET"
  for name in FCM_SERVICE_ACCOUNT TELEGRAM_BOT_TOKEN TELEGRAM_WEBHOOK_SECRET; do
    if [ -n "${!name:-}" ]; then echo "$name=${!name}"; fi
  done
} > "$env_file"
pnpm exec supabase secrets set --project-ref "$SUPABASE_PROJECT_REF" --env-file "$env_file"

# pg_cron → Edge Function: manzil va sir Vault'da (jobs.call_edge_function).
# Bitta so'rov (`db query` bir nechta buyruqni qabul qilmaydi).
cat > "$sql_file" <<SQL
select private.upsert_vault_secret(v.name, v.value)
  from (values ('edge_functions_url', '${SUPABASE_URL%/}/functions/v1'), ('cron_secret', '${CRON_SECRET}')) as v (name, value);
SQL
pnpm exec supabase db query --linked -f "$sql_file" > /dev/null
echo "Edge Function sirlari va Vault yangilandi"
