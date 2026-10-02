#!/usr/bin/env bash
# E03-T08: remote Supabase loyihasining auth sozlamalarini ilovaga moslaydi
# (DEPLOY.md 2.4 va 4): Site URL va redirect ro'yxati, 6 xonali kirish kodi,
# kod shabloni, hamda SMTP (berilgan bo'lsa).
#
#   scripts/auth-config.sh staging
#   scripts/auth-config.sh production
#   scripts/auth-config.sh staging --dry-run     # faqat farqlarni ko'rsatadi
#
# Qiymatlar `.env.deploy` dan olinadi (SUPABASE_ACCESS_TOKEN,
# SUPABASE_PROJECT_REF_*, ADMIN_URL_*). Ixtiyoriy: SMTP_HOST, SMTP_PORT,
# SMTP_USER, SMTP_PASSWORD, SMTP_SENDER — bo'lsa custom SMTP ham yoqiladi.
#
# `supabase config push` ishlatilmaydi: u lokal manzillarni ham yuborardi
# (config.toml — lokal muhit uchun). Shuning uchun faqat kerakli maydonlar.
set -euo pipefail

cd "$(dirname "$0")/.."
env_file="${OUT_FILE:-.env.deploy}"
dry_run=false
env_name=''

for arg in "$@"; do
  case "$arg" in
    --dry-run) dry_run=true ;;
    staging | production) env_name="$arg" ;;
    -h | --help)
      sed -n '2,16p' "$0"
      exit 0
      ;;
    *)
      echo "Noma'lum argument: $arg" >&2
      exit 2
      ;;
  esac
done

if [ -z "$env_name" ]; then
  echo "Muhit kerak: staging yoki production" >&2
  exit 2
fi

value_of() { sed -n "s/^$1=//p" "$env_file" | tail -1; }

suffix="$(tr '[:lower:]' '[:upper:]' <<<"$env_name")"
token="$(value_of SUPABASE_ACCESS_TOKEN)"
ref="$(value_of "SUPABASE_PROJECT_REF_$suffix")"
admin_url="$(value_of "ADMIN_URL_$suffix")"
# Xabarlarda apostrof ishlatilmaydi: `${var:?...}` ichida u qo'shtirnoq ochadi.
for pair in "token:SUPABASE_ACCESS_TOKEN" "ref:SUPABASE_PROJECT_REF_$suffix" \
  "admin_url:ADMIN_URL_$suffix"; do
  name="${pair##*:}"
  case "${pair%%:*}" in
    token) current="$token" ;;
    ref) current="$ref" ;;
    *) current="$admin_url" ;;
  esac
  if [ -z "$current" ]; then
    echo "$env_file da $name topilmadi" >&2
    exit 2
  fi
done

# Mobil ilovaning deep-link sxemasi — flavor bo'yicha (ARXITEKTURA 9).
case "$env_name" in
  staging) scheme='mywallet-stg' ;;
  *) scheme='mywallet' ;;
esac

export AUTH_TOKEN="$token" AUTH_REF="$ref" AUTH_URL="$admin_url" \
  AUTH_SCHEME="$scheme" AUTH_DRY="$dry_run" \
  AUTH_SMTP_HOST="$(value_of SMTP_HOST)" AUTH_SMTP_PORT="$(value_of SMTP_PORT)" \
  AUTH_SMTP_USER="$(value_of SMTP_USER)" AUTH_SMTP_PASSWORD="$(value_of SMTP_PASSWORD)" \
  AUTH_SMTP_SENDER="$(value_of SMTP_SENDER)"

python3 -c "$(
  cat <<'PYAUTH'
import json
import os
import pathlib
import sys
import urllib.error
import urllib.request

API = 'https://api.supabase.com/v1/projects/%s/config/auth' % os.environ['AUTH_REF']
TOKEN = os.environ['AUTH_TOKEN']
ADMIN = os.environ['AUTH_URL'].rstrip('/')
SCHEME = os.environ['AUTH_SCHEME']
DRY = os.environ['AUTH_DRY'] == 'true'
SUBJECT = 'My Wallet — kirish kodi'


def request(method, body=None):
    data = json.dumps(body).encode() if body else None
    headers = {'authorization': 'Bearer ' + TOKEN}
    if data:
        headers['content-type'] = 'application/json'
    req = urllib.request.Request(API, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        detail = error.read().decode()[:200]
        raise SystemExit(f'  ❌ HTTP {error.code}: {detail}')


template = pathlib.Path('supabase/templates/sign-in-code.html').read_text(encoding='utf-8')

# Ilova kutgan sozlamalar. Rate limit'lar tegilmaydi — ular Supabase'ning
# himoya chegaralari (lokal config.toml dagi yuqori qiymatlar testlar uchun).
wanted = {
    'site_url': ADMIN,
    'uri_allow_list': f'{ADMIN}/**,{SCHEME}://auth-callback',
    # Kirish kodi: 6 xona (EMAIL_CODE_LENGTH) va 10 daqiqa (config.toml).
    'mailer_otp_length': 6,
    'mailer_otp_exp': 600,
    # Tasdiq xati emas, kirish kodi — kodni kiritish egalikni isbotlaydi.
    'mailer_autoconfirm': True,
    'password_min_length': 8,
}

# Ikkala shablon ham kod yuboradi (standart shablonda havola bo'ladi). Bepul
# rejada bularni o'zgartirish faqat custom SMTP bilan mumkin — shuning uchun
# alohida guruh.
mail_templates = {
    'mailer_subjects_magic_link': SUBJECT,
    'mailer_templates_magic_link_content': template,
    'mailer_subjects_confirmation': SUBJECT,
    'mailer_templates_confirmation_content': template,
}

smtp_host = os.environ.get('AUTH_SMTP_HOST') or ''
if smtp_host:
    sender = os.environ.get('AUTH_SMTP_SENDER') or os.environ['AUTH_SMTP_USER']
    wanted.update({
        'smtp_host': smtp_host,
        'smtp_port': os.environ.get('AUTH_SMTP_PORT') or '587',
        'smtp_user': os.environ['AUTH_SMTP_USER'],
        'smtp_pass': os.environ['AUTH_SMTP_PASSWORD'],
        'smtp_admin_email': sender,
        'smtp_sender_name': 'My Wallet',
        # Gmail: soatiga 30 xat (kunlik ~500 chegarasi ichida).
        'rate_limit_email_sent': 30,
    })

current = request('GET')
if smtp_host or current.get('smtp_host'):
    wanted.update(mail_templates)
else:
    print("  ·  SMTP yo'q — xat shabloni o'zgartirilmaydi (bepul rejada ruxsat yo'q)")
changes = {k: v for k, v in wanted.items() if current.get(k) != v}
if not changes:
    print('  ✅ sozlamalar allaqachon joyida')
    raise SystemExit(0)

for name in sorted(changes):
    old, new = current.get(name), changes[name]
    if name in ('smtp_pass',) or 'templates' in name:
        print(f'  · {name}: yangilanadi')
    else:
        print(f'  · {name}: {old!r} → {new!r}')

if DRY:
    print('  (sinov ishi — yuborilmadi)')
    raise SystemExit(0)

request('PATCH', changes)
check = request('GET')
failed = [k for k, v in changes.items() if check.get(k) != v]
if failed:
    print('  ❌ qabul qilinmadi:', ', '.join(failed))
    raise SystemExit(1)
print(f'  ✅ {len(changes)} sozlama yangilandi')
if not (smtp_host or current.get('smtp_host')):
    print("  ·  Email kodi hali ishlamaydi: SMTP va shablon kerak (DEPLOY.md 4)")
PYAUTH
)"
