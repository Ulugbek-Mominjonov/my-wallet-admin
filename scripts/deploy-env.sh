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

# --- Telegram: bot nomlari va ops chat ID (DEPLOY.md 7) ----------------------
# Tokenlar @BotFather dan qo'lda yoziladi; nomni va chat ID ni Bot API beradi.
tg_pairs="$(
  TG_PROD="$(sed -n 's/^TELEGRAM_BOT_TOKEN_PRODUCTION=//p' "$out_file" | tail -1)" \
    TG_STG="$(sed -n 's/^TELEGRAM_BOT_TOKEN_STAGING=//p' "$out_file" | tail -1)" \
    TG_OPS="$(sed -n 's/^OPS_TELEGRAM_BOT_TOKEN=//p' "$out_file" | tail -1)" \
    TG_OPS_CHAT="$(sed -n 's/^OPS_TELEGRAM_CHAT_ID=//p' "$out_file" | tail -1)" \
    python3 -c "$(
    cat <<'PY'
import json, os, sys, urllib.error, urllib.request

api = os.environ.get('TG_API', 'https://api.telegram.org')


def call(token, method):
    try:
        with urllib.request.urlopen(f'{api}/bot{token}/{method}', timeout=20) as response:
            body = json.load(response)
    except urllib.error.HTTPError as error:
        return None, f'HTTP {error.code}'
    except (OSError, json.JSONDecodeError) as error:
        return None, str(error)
    return (body.get('result'), None) if body.get('ok') else (None, body.get('description', '?'))


pairs = []
notes = []

for env_var, names in (('TG_PROD', ('TELEGRAM_BOT', 'TELEGRAM_BOT_USERNAME_PRODUCTION')),
                       ('TG_STG', ('TELEGRAM_BOT_USERNAME_STAGING',))):
    token = os.environ.get(env_var) or ''
    if not token:
        continue
    result, error = call(token, 'getMe')
    if error:
        notes.append(f'·  Telegram ({env_var}): {error}')
        continue
    pairs += [f'{name}={result["username"]}' for name in names]

ops = os.environ.get('TG_OPS') or ''
if ops and not (os.environ.get('TG_OPS_CHAT') or ''):
    result, error = call(ops, 'getUpdates')
    chats = {
        update[key]['chat']['id']
        for update in (result or [])
        for key in ('message', 'channel_post')
        if key in update
    } if not error else set()
    if error:
        notes.append(f'·  Ops boti: {error}')
    elif len(chats) == 1:
        pairs.append(f'OPS_TELEGRAM_CHAT_ID={chats.pop()}')
    elif chats:
        notes.append(f'·  Ops botiga bir nechta chat yozgan ({sorted(chats)}) — birini qo\'lda yozing')
    else:
        notes.append("·  Ops botiga Telegram'da `/start` yozing — chat ID keyin olinadi")

if notes:
    print('\n'.join(notes), file=sys.stderr)
print('\n'.join(pairs))
PY
  )"
)"
if [ -n "$tg_pairs" ]; then
  tg_lines=()
  while IFS= read -r line; do
    [ -n "$line" ] && tg_lines+=("$line")
  done <<<"$tg_pairs"
  merge_into_env "${tg_lines[@]}"
  echo "✅ Telegram: ${#tg_lines[@]} qiymat olindi (bot nomlari, ops chat ID)"
fi

# --- Firebase: ilova kaliti, app ID va sender ID (DEPLOY.md 6) ---------------
# `FIREBASE_PROJECT_ID_<MUHIT>` yozilgan bo'lsa qolganini `firebase` CLI topadi:
# shu loyihadagi Android ilovalardan flavor paketiga mos keladigani. Paketlar —
# my-wallet-mobil/android/app/build.gradle.kts dagi applicationId va suffikslar.
fb_pairs=()
for env_pair in "STAGING uz.mywallet.app.stg" "PRODUCTION uz.mywallet.app"; do
  fb_env="${env_pair%% *}"
  fb_package="${env_pair##* }"
  fb_project="$(sed -n "s/^FIREBASE_PROJECT_ID_$fb_env=//p" "$out_file" | tail -1)"
  fb_key="$(sed -n "s/^FIREBASE_API_KEY_$fb_env=//p" "$out_file" | tail -1)"
  # Loyiha ko'rsatilmagan yoki qiymatlar allaqachon bor — o'tkazamiz.
  if [ -z "$fb_project" ] || [ -n "$fb_key" ]; then
    continue
  fi
  if ! command -v firebase >/dev/null; then
    echo "·  Firebase CLI yo'q — $fb_env o'tkazildi (npm i -g firebase-tools)"
    continue
  fi
  # Ilova ID kerak: ID siz `apps:sdkconfig` interaktiv so'raydi. Har qanday
  # Android ilova ID si yetarli — javobda loyihaning hamma mijozi bo'ladi.
  fb_app="$(
    firebase apps:list ANDROID --project "$fb_project" --json 2>/dev/null |
      python3 -c "import json,sys; rows=json.load(sys.stdin).get('result') or []; print(rows[0]['appId'] if rows else '')"
  )"
  if [ -z "$fb_app" ]; then
    echo "·  Firebase: $fb_project da Android ilova yo'q"
    continue
  fi
  fb_out="$(
    firebase apps:sdkconfig ANDROID "$fb_app" --project "$fb_project" 2>/dev/null |
      FB_ENV="$fb_env" FB_PACKAGE="$fb_package" python3 -c "$(
        cat <<'PYFB'
import json, os, sys

raw = sys.stdin.read()
start = raw.find('{')
if start < 0:
    print("·  Firebase: javob bo'sh (loyiha ID to'g'rimi?)", file=sys.stderr)
    raise SystemExit(0)
config = json.loads(raw[start:])
package = os.environ['FB_PACKAGE']
env = os.environ['FB_ENV']
number = config['project_info']['project_number']
for client in config.get('client', []):
    info = client['client_info']
    if info['android_client_info']['package_name'] != package:
        continue
    print('FIREBASE_API_KEY_%s=%s' % (env, client['api_key'][0]['current_key']))
    print('FIREBASE_APP_ID_ANDROID_%s=%s' % (env, info['mobilesdk_app_id']))
    print('FIREBASE_MESSAGING_SENDER_ID_%s=%s' % (env, number))
    break
else:
    print("·  Firebase: %s paketli ilova topilmadi" % package, file=sys.stderr)
PYFB
      )"
  )"
  while IFS= read -r line; do
    [ -n "$line" ] && fb_pairs+=("$line")
  done <<<"$fb_out"
done
if [ ${#fb_pairs[@]} -gt 0 ]; then
  merge_into_env "${fb_pairs[@]}"
  echo "✅ Firebase: ${#fb_pairs[@]} qiymat olindi (kalit, app ID, sender ID)"
fi

chmod 600 "$out_file"
echo "✅ $out_file yangilandi (Supabase qiymatlari)"

# --- mobil env/<flavor>.json -------------------------------------------------
# CI `tool/ci_release_files.sh` bilan bir xil maydonlar — lokal imzolangan
# build ham CI bilan bir xil sozlamada ishlaydi. Faqat `.env.deploy` da bor
# qiymatlar yoziladi; fayldagi boshqa maydonlar saqlanadi.
if [ -d "$mobil_root/env" ]; then
  for pair in "STAGING staging" "PRODUCTION prod"; do
    suffix="${pair%% *}"
    flavor="${pair##* }"
    target="$mobil_root/env/$flavor.json"
    python3 -c "$(
      cat <<'PYENV'
import json, os, pathlib, sys

env_file, target, example, suffix = sys.argv[1:5]
# `.env.deploy` → mobil json maydoni (CI dagi nomlar bilan bir xil).
mapping = {
    'SUPABASE_URL': 'SUPABASE_URL_%s',
    'SUPABASE_PUBLISHABLE_KEY': 'SUPABASE_PUBLISHABLE_KEY_%s',
    'TELEGRAM_BOT_USERNAME': 'TELEGRAM_BOT_USERNAME_%s',
    'FIREBASE_API_KEY': 'FIREBASE_API_KEY_%s',
    'FIREBASE_APP_ID': 'FIREBASE_APP_ID_ANDROID_%s',
    'FIREBASE_MESSAGING_SENDER_ID': 'FIREBASE_MESSAGING_SENDER_ID_%s',
    'FIREBASE_PROJECT_ID': 'FIREBASE_PROJECT_ID_%s',
    'GOOGLE_WEB_CLIENT_ID': 'GOOGLE_WEB_CLIENT_ID',
}

values = {}
for line in pathlib.Path(env_file).read_text(encoding='utf-8').splitlines():
    text = line.strip()
    if not text or text.startswith('#') or '=' not in text:
        continue
    name, value = text.split('=', 1)
    values[name.strip()] = value.strip()

source = target if os.path.exists(target) else example
data = json.loads(pathlib.Path(source).read_text(encoding='utf-8'))
written = []
for field, pattern in mapping.items():
    value = values.get(pattern % suffix if '%s' in pattern else pattern, '')
    if value and data.get(field) != value:
        data[field] = value
        written.append(field)
pathlib.Path(target).write_text(
    json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8'
)
print(','.join(written))
PYENV
    )" "$out_file" "$target" "$mobil_root/env/$flavor.example.json" "$suffix" |
      while IFS= read -r changed; do
        if [ -n "$changed" ]; then
          echo "✅ env/$flavor.json: $changed"
        else
          echo "·  env/$flavor.json: o'zgarish yo'q"
        fi
      done
  done
else
  echo "⚠️  Mobil repo topilmadi ($mobil_root) — env fayllari o'tkazib yuborildi" >&2
fi

cat <<'MSG'

Keyingi qadamlar:
  1. node scripts/github-secrets.mjs --template >> .env.deploy   # bo'sh nomlar
  2. .env.deploy ni to'ldiring (DB parollari, pooler satri, tokenlar — DEPLOY.md)
  3. GITHUB_TOKEN=... make github-secrets                        # GitHub'ga yuklash
MSG
