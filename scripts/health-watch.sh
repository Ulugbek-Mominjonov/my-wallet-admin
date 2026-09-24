#!/usr/bin/env bash
# E28-T07: kundalik nazorat — rejali ishlar (`job_runs`), bildirishnoma
# navbati va valyuta kurslari. CI (health-watch.yml) va qo'lda ishlatiladi:
#
#   PGURL="postgresql://…" scripts/health-watch.sh
#
# Chiqishda faqat sonlar va ish nomlari — foydalanuvchi ma'lumoti yo'q
# (loglar public repoda ochiq). Muammo topilsa — 1 bilan tugaydi va
# `summary` chiqishiga qisqa sabab yoziladi (ops boti shuni yuboradi).
set -euo pipefail

: "${PGURL:?PGURL kerak (prod baza ulanish satri)}"

# Bitta so'rov — har tekshiruv bitta qator: belgi, nom, son.
readonly QUERY=$(
  cat <<'SQL'
with expected(job, max_age) as (
  values ('daily_sweep', interval '3 hours'),
         ('enqueue_reminders', interval '3 hours'),
         ('dispatch_notifications', interval '1 hour'),
         ('fx_sync', interval '30 hours'),
         ('purge', interval '30 hours'),
         ('platform_stats', interval '30 hours')
),
last_run as (
  select e.job, e.max_age,
         (select max(r.finished_at) from public.job_runs r
           where r.job = e.job and r.status = 'ok') as ok_at
    from expected e
)
-- 1. Xato bilan tugagan ishlar (oxirgi sutka).
select 'failed_job' as kind, r.job as name, count(*)::text as value
  from public.job_runs r
 where r.status = 'failed' and r.started_at > now() - interval '1 day'
 group by r.job
union all
-- 2. Kutilgan vaqtda ishlamagan rejali ishlar.
select 'stale_job', l.job,
       coalesce(to_char(l.ok_at, 'YYYY-MM-DD HH24:MI'), 'hech qachon')
  from last_run l
 where l.ok_at is null or l.ok_at < now() - l.max_age
union all
-- 3. Navbatda qotib qolgan bildirishnomalar (2 soatdan ortiq).
select 'stuck_outbox', o.status, count(*)::text
  from public.notification_outbox o
 where o.status in ('pending', 'sending')
   and o.created_at < now() - interval '2 hours'
 group by o.status
union all
-- 4. Kurslar eskirgan (CBU ish kunlari — 4 kun chidamli).
select 'stale_fx', e.currency, to_char(max(e.rate_date), 'YYYY-MM-DD')
  from public.exchange_rates e
 group by e.currency
having max(e.rate_date) < current_date - 4
SQL
)

rows="$(psql "$PGURL" --no-psqlrc --quiet --tuples-only --no-align \
  --field-separator='|' --variable ON_ERROR_STOP=1 --command "$QUERY")"

if [ -z "$rows" ]; then
  echo "✅ Muammo yo'q: rejali ishlar, navbat va kurslar joyida."
  exit 0
fi

echo "Topilgan muammolar:"
summary=''
while IFS='|' read -r kind name value; do
  [ -n "$kind" ] || continue
  case "$kind" in
    failed_job) text="$name — $value marta xato (sutkada)" ;;
    stale_job) text="$name — oxirgi muvaffaqiyatli ish: $value" ;;
    stuck_outbox) text="navbatda $value ta xabar ($name, 2 soatdan ortiq)" ;;
    stale_fx) text="$name kursi eskirgan (oxirgi sana $value)" ;;
    *) text="$kind $name $value" ;;
  esac
  echo "  • $text"
  summary="${summary:+$summary; }$text"
done <<< "$rows"

# Ogohlantirish matni uchun (workflow ops botga yuboradi).
if [ -n "${GITHUB_OUTPUT:-}" ]; then
  echo "summary=$summary" >> "$GITHUB_OUTPUT"
fi
echo "::error::Kundalik nazorat: $summary"
exit 1
