#!/usr/bin/env bash
# E00-T08: GitHub repo sozlamalari — `main` himoyasi, Environments va
# Actions ruxsatlari (DEPLOY.md 1-bo'lim). Bir marta ishlatiladi; qayta
# ishga tushirish xavfsiz (hammasi PUT — bir xil natija).
#
#   GITHUB_TOKEN=ghp_… scripts/github-setup.sh                 # ikkala repo
#   GITHUB_TOKEN=ghp_… scripts/github-setup.sh my-wallet-admin # bittasi
#
# Token: "Fine-grained" (shu ikki repoga) yoki klassik `repo` huquqi bilan;
# qo'shimcha: Administration (read/write) — himoya va muhitlar uchun.
# Token faqat env orqali keladi — kodga yozilmaydi va logga chiqmaydi.
#
# Nima qiladi:
#   1. `main` himoyasi: PR majburiy, CI yashil bo'lmaguncha merge yo'q,
#      force-push va o'chirish taqiq (egasi — admin — shoshilinch holatda
#      chetlab o'tadi; `--enforce-admins` bilan u ham qamrab olinadi).
#   2. Environments: `staging` (tasdiqsiz) va `production` (egasining
#      tasdig'i bilan, faqat himoyalangan branchdan).
#   3. Actions: workflow'lar PR yarata olsin (release-please).
set -euo pipefail

owner="${GITHUB_OWNER:-Ulugbek-Mominjonov}"
api='https://api.github.com'
enforce_admins=false
repos=()

for arg in "$@"; do
  case "$arg" in
    --enforce-admins) enforce_admins=true ;;
    -h | --help)
      sed -n '2,20p' "$0"
      exit 0
      ;;
    *) repos+=("$arg") ;;
  esac
done
[ ${#repos[@]} -gt 0 ] || repos=(my-wallet-admin my-wallet-mobil)

if [ -z "${GITHUB_TOKEN:-}" ]; then
  echo "GITHUB_TOKEN kerak (env orqali): DEPLOY.md 1-bo'lim" >&2
  exit 2
fi

body_file="$(mktemp)"
trap 'rm -f "$body_file"' EXIT

# `curl` chaqiruvi: javob tanasi faylga, HTTP kodi chiqishga; token faqat
# sarlavhada (logga tushmaydi).
api_call() {
  local method="$1" path="$2" body="${3:-}"
  local args=(-sS -o "$body_file" -w '%{http_code}'
    -X "$method" -H "Accept: application/vnd.github+json"
    -H "Authorization: Bearer $GITHUB_TOKEN"
    -H 'X-GitHub-Api-Version: 2022-11-28' "$api$path")
  [ -n "$body" ] && args+=(-H 'Content-Type: application/json' -d "$body")
  curl "${args[@]}"
}

# Natijani bir qatorda ko'rsatadi; xato bo'lsa — sababi bilan to'xtaydi.
step() {
  local title="$1" method="$2" path="$3" body="${4:-}"
  local code
  code="$(api_call "$method" "$path" "$body")"
  if [ "$code" -ge 200 ] && [ "$code" -lt 300 ]; then
    echo "  ✅ $title"
    return 0
  fi
  echo "  ❌ $title (HTTP $code)" >&2
  # Javobdan faqat GitHub xabari (sir emas).
  python3 -c "import json; print('     ', json.load(open('$body_file')).get('message', ''))" \
    2>/dev/null || true
  exit 1
}

# Egasining user ID si — production muhitiga tasdiqlovchi sifatida.
code="$(api_call GET "/users/$owner")"
if [ "$code" != 200 ]; then
  echo "Token yaroqsiz yoki '$owner' topilmadi (HTTP $code)" >&2
  exit 1
fi
owner_id="$(python3 -c "import json; print(json.load(open('$body_file'))['id'])")"

# CI ishlari (`ci.yml` dagi job nomlari) — shular yashil bo'lishi shart.
admin_checks='"sirlar — gitleaks","web — lint, test, build","functions — Deno lint, testlar","db — migratsiyalar, lint, pgTAP, tiplar"'
mobil_checks='"sirlar — gitleaks","dart — format, generatsiya, analiz, test, qoplama","android — dev APK build"'

for repo in "${repos[@]}"; do
  echo "$owner/$repo:"
  case "$repo" in
    *admin) checks="$admin_checks" ;;
    *) checks="$mobil_checks" ;;
  esac

  step "main himoyasi (PR + CI)" PUT "/repos/$owner/$repo/branches/main/protection" "$(
    cat <<JSON
{
  "required_status_checks": { "strict": true, "contexts": [$checks] },
  "enforce_admins": $enforce_admins,
  "required_pull_request_reviews": {
    "required_approving_review_count": 0,
    "dismiss_stale_reviews": true
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_linear_history": true,
  "required_conversation_resolution": true
}
JSON
  )"

  step "staging muhiti" PUT "/repos/$owner/$repo/environments/staging" '{}'
  step "production muhiti (tasdiq bilan)" PUT "/repos/$owner/$repo/environments/production" "$(
    cat <<JSON
{
  "wait_timer": 0,
  "prevent_self_review": false,

  "reviewers": [{ "type": "User", "id": $owner_id }],
  "deployment_branch_policy": { "protected_branches": true, "custom_branch_policies": false }
}
JSON
  )"

  step "Actions PR yarata oladi (release-please)" PUT \
    "/repos/$owner/$repo/actions/permissions/workflow" \
    '{"default_workflow_permissions":"read","can_approve_pull_request_reviews":true}'
done

echo
echo "Tayyor. Tekshirish: Settings → Branches / Environments / Actions."
