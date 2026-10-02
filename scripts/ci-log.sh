#!/usr/bin/env bash
# CI ishining logini yuklab, qulagan qadamlarni ko'rsatadi. GitHub Actions
# loglari faqat repo egasiga ochiq, shuning uchun token kerak (`repo` scope
# yoki fine-grained: Actions — Read).
#
#   GITHUB_TOKEN=… scripts/ci-log.sh <run-id>              # admin repo
#   GITHUB_TOKEN=… scripts/ci-log.sh <run-id> --repo mobil
#   GITHUB_TOKEN=… scripts/ci-log.sh <run-id> --lines 120
#
# To'liq log faylga saqlanadi (yo'li chiqishda), ekranga esa faqat qulagan
# ish/qadam va oxirgi satrlar. Sirlar GitHub tomonidan `***` bilan yashiriladi.
set -euo pipefail

owner="${GITHUB_OWNER:-Ulugbek-Mominjonov}"
repo='my-wallet-admin'
lines=60
run=''

while [ $# -gt 0 ]; do
  case "$1" in
    --repo)
      case "${2:?--repo uchun qiymat kerak}" in
        mobil | my-wallet-mobil) repo='my-wallet-mobil' ;;
        *) repo='my-wallet-admin' ;;
      esac
      shift 2
      ;;
    --lines)
      lines="${2:?--lines uchun son kerak}"
      shift 2
      ;;
    -h | --help)
      sed -n '2,10p' "$0"
      exit 0
      ;;
    *)
      run="$1"
      shift
      ;;
  esac
done

if [ -z "$run" ] || [ -z "${GITHUB_TOKEN:-}" ]; then
  echo "Foydalanish: GITHUB_TOKEN=… $0 <run-id> [--repo mobil] [--lines N]" >&2
  exit 2
fi

api="https://api.github.com/repos/$owner/$repo/actions/runs/$run"
out_dir="${TMPDIR:-/tmp}/ci-log-$run"
rm -rf "$out_dir"
mkdir -p "$out_dir"

echo "Qulagan qadamlar:"
curl -sS -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H 'Accept: application/vnd.github+json' "$api/jobs" |
  python3 -c "
import json, sys
jobs = json.load(sys.stdin).get('jobs', [])
for job in jobs:
    if job.get('conclusion') in (None, 'success', 'skipped'):
        continue
    print(f\"  {job['name']}: {job['conclusion']}\")
    for step in job.get('steps', []):
        if step.get('conclusion') not in ('success', 'skipped', None):
            print(f\"    ❌ {step['number']}. {step['name']}\")
"

code="$(curl -sS -L -o "$out_dir/logs.zip" -w '%{http_code}' \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H 'Accept: application/vnd.github+json' "$api/logs")"
if [ "$code" != 200 ]; then
  echo "Log yuklanmadi (HTTP $code) — tokenda Actions o'qish huquqi bormi?" >&2
  exit 1
fi

python3 - "$out_dir" "$lines" <<'PY'
import pathlib
import sys
import zipfile

out_dir = pathlib.Path(sys.argv[1])
tail = int(sys.argv[2])
with zipfile.ZipFile(out_dir / 'logs.zip') as archive:
    archive.extractall(out_dir)

# Xato belgisi bor fayllar: GitHub qadam loglarini alohida yozadi.
marks = ('##[error]', 'Error:', 'error:', 'FAIL', 'failed')
for path in sorted(out_dir.rglob('*.txt')):
    text = path.read_text(encoding='utf-8', errors='replace')
    if not any(mark in text for mark in marks):
        continue
    rows = text.splitlines()
    print(f"\n=== {path.relative_to(out_dir)} (oxirgi {tail} satr) ===")
    print('\n'.join(rows[-tail:]))
print(f"\nTo'liq log: {out_dir}")
PY
