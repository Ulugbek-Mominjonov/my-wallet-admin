# CI/CD — platforma repo

> Qarorlar: [`ARXITEKTURA.md`](ARXITEKTURA.md) ADR-11..14 · sozlash:
> [`DEPLOY.md`](DEPLOY.md) · vazifalar: [`PLAN.md`](PLAN.md) E03.

## Workflow'lar

| Fayl | Qachon | Nima qiladi | Yoqilishi |
|---|---|---|---|
| `ci.yml` | har PR, `main` push | web (format, ESLint, tiplar, Vitest, build), functions (Deno fmt/lint/check, unit + snapshot testlari), db (lokal Supabase edge runtime bilan, squawk + db lint, pgTAP, kontrakt testlari — golden fixture'lar, sinxron, Edge Functions uchidan-uchiga — `make fn-smoke`, ishlash — `make perf`, TS tiplari eskirmaganmi), e2e (lokal Supabase — Auth, RPC, Mailpit; Playwright desktop + mobil; deploy smoke — `public` loyiha, kirmagan holat) | doim |
| `deploy.yml` → `deploy-env.yml` | `main` push → **staging**; qo'lda → istalgan muhit | `supabase db push` → Edge Function sirlari + Vault → Edge Functions → Telegram webhook → admin build → Cloudflare deploy → smoke (`health` RPC, Edge Function 403, Playwright) | `DEPLOY_ENABLED=true` |
| `release.yml` | `main` push | release-please reliz PR'i; merge → teg + **production** deploy (reviewer tasdig'i) | `DEPLOY_ENABLED=true` |
| `preview.yml` | har PR (fork'dan emas) | admin build (staging backend) → `wrangler versions upload --preview-alias pr-N` → PR izohi | `DEPLOY_ENABLED=true` |
| `backup.yml` | har kecha 02:00 Toshkent | prod dump + storage siyosatlari + chek rasmlari (soni tekshiriladi) → toza Supabase'ga tiklab solishtirish → `age` shifrlash → artefakt (90 kun) | `BACKUP_AGE_RECIPIENT` bor bo'lsa |
| `keepalive.yml` | har 2 kunda | staging/prod `health` (≤ 3 s), rejali workflow'larni 60 kunlik o'chirilishdan saqlash | `DEPLOY_ENABLED=true` |

Umumiy qismlar: `.github/actions/setup` (pnpm + Node + install, kesh bilan),
`.github/actions/ops-alert` (xato → ops Telegram).

## Tezlik (2026-09-18, birinchi yashil run)

| Job | Vaqt | Eng sekin qadam |
|---|---|---|
| db | 1,8 daq | lokal Supabase ishga tushishi — 79 s |
| web | 0,7 daq | format + ESLint + tiplar — 15 s |
| e2e (web'dan keyin) | 1,0 daq | Chromium o'rnatish — 25 s |
| **PR kutish vaqti** | **~2 daq** | maqsad < 8 daq ✅ |

Repo public — Actions minutlari cheksiz; `paths` filtrlari ataylab yo'q
(branch himoyasidagi majburiy tekshiruvlar har PR'da hisobot berishi kerak).

Keyingi optimallashtirish imkoniyatlari (kerak bo'lsa):
Playwright brauzer keshi (`~/.cache/ms-playwright`) — −25 s;
Supabase Docker image keshi — −40…60 s.

## Xavfsizlik qoidalari

- Barcha action'lar **commit SHA** bilan pin qilingan (versiya izohda);
  Dependabot haftalik yangilaydi.
- `permissions` har workflow'da minimal (`contents: read` standart).
- Sirlar loglarga chiqmaydi; zaxira va tiklash skriptlari raqam/ma'lumot
  chiqarmaydi (loglar public). Deploy sirlari vaqtinchalik `600` faylda
  (`supabase secrets set --env-file`, `db query -f`) — buyruq qatorida emas.
- `supabase/functions/.env.example` — faqat lokal/CI qiymatlari (haqiqiy sir emas).
- Fork'dan kelgan PR'larda sirli qadamlar ishlamaydi.
