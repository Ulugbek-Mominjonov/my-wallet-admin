#!/usr/bin/env bash
# E03-T08 / E28-T01: deploy qiymatlarini yig'adi (DEPLOY.md 2 va 9-bo'limlar):
#   1. Supabase loyihalaridan — ref, URL, publishable va secret kalitlar;
#   2. mahalliy tasodifiy sirlar (`CRON_SECRET`, `TELEGRAM_WEBHOOK_SECRET`) —
#      faqat bo'sh bo'lsa yaratiladi.
# Qayta ishga tushirish xavfsiz: faqat o'z kalitlari yangilanadi, faylning
# boshqa satrlariga tegilmaydi.
#
#   pnpm exec supabase login         # bir marta (sessiya ~/.supabase da)
#   make deploy-env                  # loyihalarni nomi bo'yicha topadi
#   scripts/deploy-env.sh --staging <ref> --prod <ref>
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
      sed -n '2,19p' "$0"
      exit 0
      ;;
    *)
      echo "Noma'lum argument: $1" >&2
      exit 2
      ;;
  esac
done

# CLI chaqiruvi — repodagi devDependency; global o'rnatilgan bo'lsa:
#   SUPABASE_CLI=supabase scripts/deploy-env.sh
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
pairs=()
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
  values["URL_$suffix"]="https://$ref.supabase.co"
  values["PUB_$suffix"]="$publishable"
  pairs+=(
    "SUPABASE_PROJECT_REF_$suffix=$ref"
    "SUPABASE_URL_$suffix=https://$ref.supabase.co"
    "SUPABASE_PUBLISHABLE_KEY_$suffix=$publishable"
    "SUPABASE_SECRET_KEY_$suffix=$secret"
  )
  echo "✅ $env_name: $ref — URL, publishable va secret kalit olindi"
done

# --- .env.deploy: faqat o'z kalitlarini yangilaydi, boshqa satrlarga tegmaydi
# (qolgan nomlarni `scripts/github-secrets.mjs --template` qo'shadi).
if [ ! -f "$out_file" ]; then
  umask 077
  {
    echo "# Deploy qiymatlari — DEPLOY.md 9-bo'lim."
    echo "# Repoga tushmaydi (.gitignore: .env.*); huquqlar 600."
    echo "# Qolgan nomlarni qo'shish:"
    echo "#   node scripts/github-secrets.mjs --template >> .env.deploy"
    echo "# GitHub'ga yuklash: GITHUB_TOKEN=... make github-secrets"
    echo
    echo "# --- Supabase (scripts/deploy-env.sh yozadi) ---"
  } >"$out_file"
fi

# Juftliklarni faylga birlashtiradi: mavjud `NOM=` satri yangilanadi, yo'q
# bo'lsa oxiriga qo'shiladi. Qiymatlar stdin orqali — sir `ps` chiqishida
# ko'rinmasin.
merge_into_env() {
  printf '%s\n' "$@" | python3 -c "$(
    cat <<'PY'
import pathlib, sys


def name_of(line):
    text = line.lstrip()
    return line.split('=', 1)[0].strip() if '=' in line and not text.startswith('#') else None


path = pathlib.Path(sys.argv[1])
lines = path.read_text(encoding='utf-8').splitlines()
# Qo'lda `>>` bilan qo'shilgan takroriy kalit bo'lishi mumkin: oxirgisi
# yutadi (`github-secrets.mjs` ham shunday o'qiydi), avvalgilari olib
# tashlanadi — ikki joyda turgan qiymat chalkashmasin.
last = {}
for i, line in enumerate(lines):
    name = name_of(line)
    if name:
        last[name] = i
lines = [l for i, l in enumerate(lines) if name_of(l) is None or last[name_of(l)] == i]
last = {name_of(l): i for i, l in enumerate(lines) if name_of(l)}

for pair in sys.stdin.read().splitlines():
    if '=' not in pair:
        continue
    name = pair.split('=', 1)[0]
    if name in last:
        lines[last[name]] = pair
    else:
        last[name] = len(lines)
        lines.append(pair)
path.write_text('\n'.join(lines) + '\n', encoding='utf-8')
PY
  )" "$out_file"
}

merge_into_env "${pairs[@]}"

# Mahalliy sirlar (DEPLOY.md 7.3): mavjudi almashtirilmaydi — deploy ularni
# Supabase muhitiga va Vault'ga yozadi, almashtirish = qayta deploy.
generated=()
for name in CRON_SECRET_STAGING CRON_SECRET_PRODUCTION \
  TELEGRAM_WEBHOOK_SECRET_STAGING TELEGRAM_WEBHOOK_SECRET_PRODUCTION; do
  if [ -z "$(sed -n "s/^$name=//p" "$out_file" | tail -1)" ]; then
    generated+=("$name=$(openssl rand -hex 32)")
  fi
done
if [ ${#generated[@]} -gt 0 ]; then
  merge_into_env "${generated[@]}"
  echo "✅ ${#generated[@]} ta tasodifiy sir yaratildi (CRON_SECRET, TELEGRAM_WEBHOOK_SECRET)"
fi

# --- Cloudflare: akkaunt ID va workers.dev manzillari (DEPLOY.md 5) ----------
# Faqat API tokeni kerak (dashboardda yaratiladi); qolganini API beradi.
cf_token="$(sed -n 's/^CLOUDFLARE_API_TOKEN=//p' "$out_file" | tail -1)"
if [ -z "$cf_token" ]; then
  echo "·  Cloudflare: CLOUDFLARE_API_TOKEN bo'sh — akkaunt ID va manzillar o'tkazildi"
else
  cf_pairs="$(
    CF_TOKEN="$cf_token" \
      CF_ACCOUNT="$(sed -n 's/^CLOUDFLARE_ACCOUNT_ID=//p' "$out_file" | tail -1)" \
      python3 -c "$(
      cat <<'PY'
import json, os, pathlib, re, sys, urllib.error, urllib.request

api = os.environ.get('CF_API', 'https://api.cloudflare.com/client/v4')
token = os.environ['CF_TOKEN']


def get(path):
    request = urllib.request.Request(
        api + path, headers={'Authorization': 'Bearer ' + token}
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.load(response)


def fail(message):
    print(message, file=sys.stderr)
    raise SystemExit(0)


# Worker nomlari — wrangler.jsonc dan (manzil shundan quriladi).
def worker_names():
    default = ('my-wallet-admin', 'my-wallet-admin-staging')
    try:
        text = pathlib.Path('web/wrangler.jsonc').read_text(encoding='utf-8')
        text = re.sub(r'//[^"\n]*$', '', text, flags=re.M)
        text = re.sub(r',(\s*[}\]])', r'\1', text)
        config = json.loads(text)
        return config['name'], config['env']['staging']['name']
    except Exception:
        print("·  wrangler.jsonc o'qilmadi — nomlar standart deb olindi", file=sys.stderr)
        return default


try:
    accounts = get('/accounts')['result']
except urllib.error.HTTPError as error:
    fail(f'·  Cloudflare tokeni ishlamadi (HTTP {error.code}) — DEPLOY.md 5.3')
except OSError as error:
    fail(f'·  Cloudflare API ga ulanilmadi: {error}')

chosen = os.environ.get('CF_ACCOUNT') or ''
if not chosen:
    if len(accounts) == 1:
        chosen = accounts[0]['id']
    else:
        names = ', '.join(a.get('name', '?') for a in accounts)
        fail(f'·  Cloudflare akkauntlari bir nechta ({names}) — CLOUDFLARE_ACCOUNT_ID ni qo\'lda yozing')

pairs = [f'CLOUDFLARE_ACCOUNT_ID={chosen}']
try:
    subdomain = get(f'/accounts/{chosen}/workers/subdomain')['result']['subdomain']
except (urllib.error.HTTPError, KeyError, OSError):
    subdomain = ''
if subdomain:
    prod, staging = worker_names()
    pairs += [
        f'ADMIN_URL_PRODUCTION=https://{prod}.{subdomain}.workers.dev',
        f'ADMIN_URL_STAGING=https://{staging}.{subdomain}.workers.dev',
    ]
else:
    print("·  workers.dev subdomeni hali yo'q — manzillar birinchi deploydan keyin", file=sys.stderr)
print('\n'.join(pairs))
PY
    )"
  )"
  if [ -n "$cf_pairs" ]; then
    cf_lines=()
    while IFS= read -r line; do
      [ -n "$line" ] && cf_lines+=("$line")
    done <<<"$cf_pairs"
    merge_into_env "${cf_lines[@]}"
    echo "✅ Cloudflare: ${#cf_lines[@]} qiymat olindi (akkaunt ID, manzillar)"
  fi
fi

chmod 600 "$out_file"
echo "✅ $out_file yangilandi (Supabase qiymatlari)"

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

Keyingi qadamlar:
  1. node scripts/github-secrets.mjs --template >> .env.deploy   # bo'sh nomlar
  2. .env.deploy ni to'ldiring (DB parollari, pooler satri, tokenlar — DEPLOY.md)
  3. GITHUB_TOKEN=... make github-secrets                        # GitHub'ga yuklash
MSG
