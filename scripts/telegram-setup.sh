#!/usr/bin/env bash
# Deploy (E11): Telegram webhook (secret_token bilan) va buyruqlar menyusi
# (uz — standart, ru, en). Token bo'lmasa — o'tkaziladi (bot ixtiyoriy).
#
#   SUPABASE_URL=... TELEGRAM_BOT_TOKEN=... TELEGRAM_WEBHOOK_SECRET=... scripts/telegram-setup.sh
set -euo pipefail

if [ -z "${TELEGRAM_BOT_TOKEN:-}" ]; then
  echo "TELEGRAM_BOT_TOKEN yo'q — Telegram sozlanmadi (o'tkazildi)"
  exit 0
fi
: "${SUPABASE_URL:?}" "${TELEGRAM_WEBHOOK_SECRET:?}"
api="https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}"

# Javoblar chiqarilmaydi (-o /dev/null); xatoda curl faqat HTTP kodini yozadi.
curl -fsS --max-time 15 -o /dev/null "$api/setWebhook" \
  --data-urlencode "url=${SUPABASE_URL%/}/functions/v1/telegram-webhook" \
  --data-urlencode "secret_token=${TELEGRAM_WEBHOOK_SECRET}" \
  --data-urlencode 'allowed_updates=["message"]'

# $1 — til kodi (bo'sh = standart), keyin "buyruq|tavsif" juftliklari.
set_commands() {
  local lang=$1
  shift
  local commands
  commands=$(printf '%s\n' "$@" | jq -R 'split("|") | {command: .[0], description: .[1]}' | jq -sc .)
  curl -fsS --max-time 15 -o /dev/null "$api/setMyCommands" \
    --data-urlencode "commands=${commands}" ${lang:+--data-urlencode "language_code=${lang}"}
}
set_commands "" "balans|Joriy oy qoldig'i" "bugun|Bugungi va kechikkan to'lovlar" "stop|Botni uzish"
set_commands ru "balans|Остаток за месяц" "bugun|Платежи на сегодня и просроченные" "stop|Отключить бота"
set_commands en "balans|This month's balance" "bugun|Payments due today and overdue" "stop|Disconnect the bot"
echo "Telegram webhook va buyruqlar yangilandi"
