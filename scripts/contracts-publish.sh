#!/usr/bin/env bash
# contracts/ ni yangilaydi yoki tekshiradi (ADR-14).
#
#   scripts/contracts-publish.sh          — BIZNES-QOIDALAR.md nusxasini yangilash
#   scripts/contracts-publish.sh --check  — nusxa eskirmagan va schema-version
#                                           migratsiyadagi qiymat bilan mos (CI)
set -euo pipefail
cd "$(dirname "$0")/.."

cp docs/BIZNES-QOIDALAR.md contracts/BIZNES-QOIDALAR.md

# Oxirgi migratsiyadagi private.api_schema_version() qiymati.
sql_version="$(grep -h -A8 'function private.api_schema_version' supabase/migrations/*.sql \
  | grep -oE 'select [0-9]+' | tail -1 | grep -oE '[0-9]+')"
contract_version="$(tr -d '[:space:]' < contracts/schema-version)"
if [ "$sql_version" != "$contract_version" ]; then
  echo "::error::contracts/schema-version ($contract_version) ≠ private.api_schema_version() ($sql_version)"
  exit 1
fi

if [ "${1:-}" = "--check" ]; then
  git diff --exit-code -- contracts || {
    echo "::error::contracts/ eskirgan — scripts/contracts-publish.sh ni ishga tushirib commit qiling"
    exit 1
  }
fi
echo "contracts/ tayyor (schema-version $contract_version)"
