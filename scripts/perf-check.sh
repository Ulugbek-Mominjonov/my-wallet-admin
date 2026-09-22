#!/usr/bin/env bash
# E09-T07: hisobotlar (va E23 amallar jadvali) ishlashi — 10 yillik sintetik
# yukda (25 000 amal) vaqt va reja tekshiruvi. Faqat lokal/CI Supabase (Docker).
#
#   scripts/perf-check.sh
#
# 1) Katta jadvallarda (transactions, planned_items) Seq Scan — xato.
#    Rejalar auto_explain bilan: funksiya ichidagi har so'rov ko'rinadi.
# 2) Vaqt: bitta sessiyada 1 ta qizdirish + 5 ta o'lchov, mediana (PostgREST
#    ulanishlari pool'da — plpgsql rejalari keshlangan holat). Maqsaddan oshsa —
#    ogohlantirish, ikki baravardan oshsa — xato (CI runner'lari sekinroq).
set -euo pipefail

DB_URL="${DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
# auto_explain'ni yuklash superuser huquqini talab qiladi (faqat lokal stek).
ADMIN_URL="${ADMIN_URL:-postgresql://supabase_admin:postgres@127.0.0.1:54322/postgres}"
RUNS=5
# Hisobot → maqsad (ms): docs/PERF.md
declare -A TARGET_MS=([report_month]=50 [report_year]=150 [report_savings]=150 [health_check]=100
  [tx_first_page]=20 [tx_deep_page]=20 [tx_search]=50 [tx_summary]=30 [payee_suggest]=30)

out="$(psql "$ADMIN_URL" --no-psqlrc --quiet --file scripts/gen-load.sql)"
household="$(sed -n 's/^perf_household=//p' <<< "$out")"
user="$(sed -n 's/^perf_user=//p' <<< "$out")"
noise_households="$(sed -n 's/^perf_noise_households=//p' <<< "$out")"
noise_users="$(sed -n 's/^perf_noise_users=//p' <<< "$out")"

cleanup() {
  psql "$ADMIN_URL" --no-psqlrc --quiet --command "
    delete from public.households
     where id = any (string_to_array('$household,$noise_households', ',')::uuid[]);
    delete from auth.users
     where id = any (string_to_array('$user,$noise_users', ',')::uuid[]);" > /dev/null
}
trap cleanup EXIT

# Hisobot chaqiruvi — byudjet egasi sifatida (RLS amal qiladi).
call_sql() {
  local call="$1"
  cat <<SQL
select set_config('request.jwt.claims', '{"sub": "$user", "role": "authenticated"}', false);
set role authenticated;
select $call;
reset role;
SQL
}

declare -A CALLS=(
  [report_month]="public.report_month('$household', '2026-09-01')"
  [report_year]="public.report_year('$household', 2025)"
  [report_savings]="public.report_savings('$household')"
  [health_check]="public.health_check('$household')"
  # E23: birinchi va chuqur (keyset) sahifa, mos kelmaydigan qidiruv (eng
  # yomon holat — sahifa to'lmaydi), oy jami.
  [tx_first_page]="(select count(*) from public.transactions_list('$household'))"
  [tx_deep_page]="(select count(*) from public.transactions_list('$household', '{}', '2019-06-15', null, 50))"
  [tx_search]="(select count(*) from public.transactions_list('$household', '{\"q\": \"qwxzv\"}'))"
  [tx_summary]="public.transactions_summary('$household', '{\"month\": \"2026-09-01\"}')"
  # BR-056: joy nomi takliflari (10% qator mos keladi — eng og'ir holat).
  [payee_suggest]="(select count(*) from public.payee_suggestions('$household', 'kor'))"
)

failed=0
printf '%-16s %10s %10s\n' "hisobot" "mediana" "maqsad"
for report in report_month report_year report_savings health_check \
  tx_first_page tx_deep_page tx_search tx_summary payee_suggest; do
  # Rejalar: auto_explain NOTICE sifatida mijozga chiqaradi.
  plans="$(psql "$ADMIN_URL" --no-psqlrc --quiet 2>&1 <<SQL
load 'auto_explain';
set auto_explain.log_min_duration = 0;
set auto_explain.log_nested_statements = on;
set auto_explain.log_level = 'notice';
set client_min_messages = notice;
$(call_sql "${CALLS[$report]}")
SQL
)"
  if grep -Eq 'Seq Scan on (transactions|planned_items)' <<< "$plans"; then
    echo "::error::$report: katta jadvalda Seq Scan"
    grep -E 'Seq Scan on (transactions|planned_items)' <<< "$plans" | sort -u
    failed=1
  fi

  # Vaqt: bitta sessiyada; birinchi (qizdirish) chaqiruv hisobga olinmaydi.
  timed="$(psql "$DB_URL" --no-psqlrc --quiet --tuples-only 2>&1 <<SQL
$(call_sql "1")
set role authenticated;
\\timing on
$(for _ in $(seq $((RUNS + 1))); do echo "select ${CALLS[$report]} is not null;"; done)
SQL
)"
  median="$(sed -n 's/^Time: \([0-9.]*\) ms.*/\1/p' <<< "$timed" | tail -n "$RUNS" | sort -n | sed -n "$(( (RUNS + 1) / 2 ))p")"
  target="${TARGET_MS[$report]}"
  printf '%-16s %8s ms %7s ms\n' "$report" "$median" "$target"
  if awk -v m="$median" -v t="$target" 'BEGIN { exit !(m > 2 * t) }'; then
    echo "::error::$report: ${median} ms — maqsaddan ikki baravar ko'p"
    failed=1
  elif awk -v m="$median" -v t="$target" 'BEGIN { exit !(m > t) }'; then
    echo "::warning::$report: ${median} ms — maqsad ${target} ms"
  fi
done

exit "$failed"
