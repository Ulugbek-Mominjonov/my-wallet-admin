#!/usr/bin/env bash
# E03-T08 / E28-T01: Supabase loyihalaridan deploy qiymatlarini olib fayllarga
# yozadi (DEPLOY.md 2 va 9-bo'limlar). Qayta ishga tushirish xavfsiz — qo'lda
# to'ldirilgan qiymatlar saqlanadi.
#
#   pnpm exec supabase login            # bir marta (sessiya ~/.supabase da)
#   scripts/supabase-env.sh             # loyihalarni nomi bo'yicha topadi
#   scripts/supabase-env.sh --staging <ref> --prod <ref>
#
# Nima yozadi:
#   .env.deploy                   — GitHub variables/secrets uchun yig'ma ro'yxat
#   ../my-wallet-mobil/env/staging.json, env/prod.json — SUPABASE_URL va kalit
#
# Ikkalasi ham .gitignore'da. Sirlar chiqishga (logga) chiqarilmaydi — faqat
# faylga yoziladi; terminalda niqoblangan xulosa ko'rinadi.
set -euo pipefail

cd "$(dirname "$0")/.."
admin_root="$PWD"
mobil_root="${MOBIL_ROOT:-$admin_root/../my-wallet-mobil}"
out_file="${OUT_FILE:-$admin_root/.env.deploy}"

staging_ref=''
prod_ref=''
while [ $# -gt 0 ]; do
  case "$1" in
    --staging)
      staging_ref="${2:?--staging uchun ref kerak}"
      shift 2
      ;;
    --prod | --production)
      prod_ref="${2:?--prod uchun ref kerak}"
      shift 2
      ;;
    -h | --help)
      sed -n '2,15p' "$0"
      exit 0
      ;;
    *)
      echo "Noma'lum argument: $1" >&2
      exit 2
      ;;
  esac
done

# CLI chaqiruvi — repodagi devDependency; global o'rnatilgan bo'lsa:
#   SUPABASE_CLI=supabase scripts/supabase-env.sh
read -ra supabase_cli <<<"${SUPABASE_CLI:-pnpm exec supabase}"
cli() { "${supabase_cli[@]}" "$@"; }

if ! projects_json="$(cli projects list -o json 2>/dev/null)"; then
  cat >&2 <<'MSG'
Supabase CLI sessiyasi yo'q. Bir marta kiring (token faylga saqlanadi):

    pnpm exec supabase login

So'ng shu skriptni qayta ishga tushiring.
MSG
  exit 2
fi

# Loyihalarni nomi bo'yicha topish: "...staging..." va "...prod...".
if [ -z "$staging_ref" ] || [ -z "$prod_ref" ]; then
  found="$(python3 -c "$(
    cat <<'PY'
import json, sys
raw = json.load(sys.stdin)
projects = raw['projects'] if isinstance(raw, dict) else raw
def pick(*needles):
    for p in projects:
        name = (p.get('name') or '').lower()
        if any(n in name for n in needles):
            return p.get('ref') or p.get('id') or ''
    return ''
print(pick('staging', 'stg'))
print(pick('prod'))
PY
  )" <<<"$projects_json")"
  [ -n "$staging_ref" ] || staging_ref="$(sed -n 1p <<<"$found")"
  [ -n "$prod_ref" ] || prod_ref="$(sed -n 2p <<<"$found")"
fi

if [ -z "$staging_ref" ] && [ -z "$prod_ref" ]; then
  echo "Loyiha topilmadi. Mavjudlari:" >&2
  cli projects list >&2
  echo "Ref'ni qo'lda bering: --staging <ref> --prod <ref>" >&2
  exit 1
fi

# API kalitlari: yangi `sb_publishable_` / `sb_secret_` (eski JWT kalitlar
# 2026 oxirida o'chiriladi — ularni ishlatmaymiz).
keys_of() {
  local ref="$1" kind="$2"
  cli projects api-keys --project-ref "$ref" --reveal -o json 2>/dev/null |
    python3 -c "$(
      cat <<'PY'
import json, re, sys
kind = sys.argv[1]
prefix = f'sb_{kind}_'
rows = json.load(sys.stdin)
for row in rows:
    value = row.get('api_key') or row.get('apiKey') or ''
    if row.get('type') != kind and not value.startswith(prefix):
        continue
    # Niqoblangan qiymat (`sb_secret_6Xv8x·...`) — faylga yozilmaydi.
    if not re.fullmatch(r'sb_(publishable|secret)_[A-Za-z0-9_-]+', value):
        sys.exit(4)
    print(value)
    break
else:
    sys.exit(3)
PY
    )" "$kind"
}

declare -A values
for env_name in staging production; do
  case "$env_name" in
    staging) ref="$staging_ref" ;;
    *) ref="$prod_ref" ;;
  esac
  [ -n "$ref" ] || continue

  suffix="$(tr '[:lower:]' '[:upper:]' <<<"$env_name")"
  for kind in publishable secret; do
    status=0
    value="$(keys_of "$ref" "$kind")" || status=$?
    if [ "$status" -ne 0 ]; then
      case "$status" in
        4) echo "❌ $env_name ($ref): $kind kaliti niqoblangan keldi — CLI'ni yangilang" >&2 ;;
        *) echo "❌ $env_name ($ref): $kind kaliti topilmadi (token huquqi yoki ref?)" >&2 ;;
      esac
      exit 1
    fi
    case "$kind" in
      publishable) publishable="$value" ;;
      *) secret="$value" ;;
    esac
  done
  values["REF_$suffix"]="$ref"
  values["URL_$suffix"]="https://$ref.supabase.co"
  values["PUB_$suffix"]="$publishable"
  values["SECRET_$suffix"]="$secret"
  echo "✅ $env_name: $ref — URL, publishable va secret kalit olindi"
done

# Qo'lda to'ldirilgan qiymatlar — fayl qayta yozilganda ham qolishi kerak,
# shuning uchun oldin o'qib olinadi (`>` fayl tanasini darhol bo'shatadi).
declare -A manual
for name in SUPABASE_DB_PASSWORD_STAGING SUPABASE_DB_PASSWORD_PRODUCTION \
  SUPABASE_DB_URL_PRODUCTION SUPABASE_ACCESS_TOKEN; do
  if [ -f "$out_file" ]; then
    manual["$name"]="$(sed -n "s/^$name=//p" "$out_file" | tail -1)"
  else
    manual["$name"]=''
  fi
done

# --- .env.deploy -------------------------------------------------------------
umask 077
{
  echo "# Supabase deploy qiymatlari — $(date +%F) da scripts/supabase-env.sh yozdi."
  echo "# Repoga tushmaydi (.gitignore: .env.*). GitHub'ga kiritish: docs/DEPLOY.md 9."
  echo
  echo "# --- Repo variables (ochiq qiymatlar) ---"
  for suffix in STAGING PRODUCTION; do
    [ -n "${values[REF_$suffix]:-}" ] || continue
    echo "SUPABASE_PROJECT_REF_$suffix=${values[REF_$suffix]}"
    echo "SUPABASE_URL_$suffix=${values[URL_$suffix]}"
    echo "SUPABASE_PUBLISHABLE_KEY_$suffix=${values[PUB_$suffix]}"
  done
  echo
  echo "# --- Environment secrets: GitHub'da nomi SUPABASE_SECRET_KEY,"
  echo "#     qiymati esa muhitiga mos (staging / production) ---"
  for suffix in STAGING PRODUCTION; do
    if [ -n "${values[SECRET_$suffix]:-}" ]; then
      echo "SUPABASE_SECRET_KEY_$suffix=${values[SECRET_$suffix]}"
    fi
  done
  echo
  echo "# --- API bermaydi: qo'lda to'ldiriladi (bir marta) ---"
  echo "# Loyiha yaratilganda belgilangan DB paroli (DEPLOY.md 2.1):"
  echo "SUPABASE_DB_PASSWORD_STAGING=${manual[SUPABASE_DB_PASSWORD_STAGING]}"
  echo "SUPABASE_DB_PASSWORD_PRODUCTION=${manual[SUPABASE_DB_PASSWORD_PRODUCTION]}"
  echo "# Dashboard → Connect → Session pooler (IPv4) — zaxira ishi uchun:"
  echo "SUPABASE_DB_URL_PRODUCTION=${manual[SUPABASE_DB_URL_PRODUCTION]}"
  echo "# Account → Access Tokens — CI uchun alohida token (DEPLOY.md 2.3):"
  echo "SUPABASE_ACCESS_TOKEN=${manual[SUPABASE_ACCESS_TOKEN]}"
} >"$out_file"
chmod 600 "$out_file"
echo "✅ $out_file yozildi (faqat o'qish huquqi sizda)"

# --- mobil env/<flavor>.json -------------------------------------------------
# Mavjud fayl bo'lsa — faqat Supabase maydonlari yangilanadi (Firebase va
# Google qiymatlari saqlanadi); bo'lmasa namunadan boshlanadi.
for pair in "staging:staging" "production:prod"; do
  env_name="${pair%%:*}"
  flavor="${pair##*:}"
  suffix="$(tr '[:lower:]' '[:upper:]' <<<"$env_name")"
  [ -n "${values[URL_$suffix]:-}" ] || continue
  target="$mobil_root/env/$flavor.json"
  [ -d "$mobil_root/env" ] || {
    echo "⚠️  Mobil repo topilmadi ($mobil_root) — env fayllari o'tkazib yuborildi" >&2
    break
  }
  python3 -c "$(
    cat <<'PY'
import json, os, sys
target, example, url, key = sys.argv[1:5]
source = target if os.path.exists(target) else example
with open(source, encoding='utf-8') as fh:
    data = json.load(fh)
data['SUPABASE_URL'] = url
data['SUPABASE_PUBLISHABLE_KEY'] = key
with open(target, 'w', encoding='utf-8') as fh:
    json.dump(data, fh, ensure_ascii=False, indent=2)
    fh.write('\n')
PY
  )" "$target" "$mobil_root/env/$flavor.example.json" \
    "${values[URL_$suffix]}" "${values[PUB_$suffix]}"
  echo "✅ $target yangilandi (SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)"
done

cat <<'MSG'

Keyingi qadam: .env.deploy dagi bo'sh 4 qatorni to'ldiring (DB paroli,
pooler satri, access token), so'ng qiymatlarni GitHub'ga kiriting —
DEPLOY.md 9-bo'lim.
MSG
