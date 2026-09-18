# Ishlash qoidalari (platforma repo)

> Mobil repo qoidalari: `my-wallet-mobil/docs/CONTRIBUTING.md`.
> Reja va "bajarildi" mezoni: [`PLAN.md`](PLAN.md) 1–2-bo'limlar.

## 1. Til

| Nima | Til |
|---|---|
| Identifikatorlar (jadval, ustun, funksiya, o'zgaruvchi, fayl nomi) | ingliz |
| Kod izohlari, commit xabarlari, hujjatlar, PR tavsifi | o'zbek (lotin) |
| UI matnlari | `uz` asosiy + `ru`, `en` (i18n fayllari orqali, kodda matn yo'q) |

Izoh **"nega"** ni tushuntiradi, "nima" ni emas. Biznes qoidaga tayanadigan
joyda qoida ID si: `-- BR-060: bir marta yaxlitlanadi`.

## 2. Branch va commit

- Branch: `<tur>/<vazifa-id>-<qisqa-nom>` — `feat/E05-T02-households`,
  `fix/E07-T05-paid-amount`, `docs/E00-T05-contributing`.
- Commit — [Conventional Commits](https://www.conventionalcommits.org), scope =
  vazifa ID si:
  ```
  feat(E05-T02): households va a'zolar jadvallari
  fix(E07-T05): reja o'chirilganda paid_amount qaytariladi
  test(E07-T11): BR-071 holatlari
  ```
  Turlar: `feat`, `fix`, `test`, `docs`, `refactor`, `perf`, `ci`, `chore`, `build`.
  Buzuvchi o'zgarish (shartnoma/API) — `feat(E10-T02)!:` va xabar tanasida
  `BREAKING CHANGE:`.
- Bitta commit = bitta vazifa (yoki uning mantiqiy qismi). Vazifa ID bo'yicha
  qidirish: `git log --grep E05-T02`.
- Kichik PR'lar: bitta PR = bitta vazifa. `main` ga faqat PR orqali, CI
  yashil bo'lganda (branch himoyasi).

## 3. Ma'lumotlar bazasi (migratsiyalar)

- Fayl nomi: `supabase migrations new <snake_case_nom>` →
  `YYYYMMDDHHMMSS_<nom>.sql`. **Faqat oldinga:** qo'llangan migratsiya hech
  qachon tahrirlanmaydi — tuzatish uchun yangi migratsiya.
- Bitta migratsiya = bitta mavzu (jadval + uning indekslari, RLS va
  triggerlari birga).
- Xavfsiz o'zgarish tartibi: yangi ustun `NULL` bilan → ma'lumotni to'ldirish
  → keyingi migratsiyada `NOT NULL` / `CHECK`. Katta jadvalda ustun nomini
  o'zgartirish yoki turini almashtirish — avval yangi ustun, keyin ko'chirish.
- Har jadval: `alter table ... enable row level security` **majburiy**;
  RLS'siz jadval CI'da qulaydi.
- Pul — `bigint` (eng kichik birlik), hech qachon `numeric`/`float` emas
  (kurslardan tashqari). Sana — `date`, vaqt — `timestamptz`.
- Funksiyalar: `security definer` faqat zarur bo'lsa va har doim
  `set search_path = ''` bilan; nomlar to'liq (`public.transactions`).
- `select *` ishlatilmaydi (view va RPC natijalarida ustunlar aniq).
- Har yangi so'rov: `EXPLAIN` bilan tekshiriladi; `WHERE/JOIN/ORDER BY`
  ustunlarida indeks. Lint: `make db-lint` (squawk + `supabase db lint`).

## 4. Testlar

| Qatlam | Vosita | Joyi | Nomlash |
|---|---|---|---|
| SQL qoidalar, RLS, triggerlar | pgTAP | `supabase/tests/database/*.test.sql` | `BR-071: qisman to'lov partial` |
| Kontrakt (fixture ↔ RPC) | Deno test | `supabase/tests/contract/` | fixture nomi |
| Edge Functions | Deno test | `supabase/functions/**/*_test.ts` | |
| Web unit/komponent | Vitest + Testing Library | `web/src/**/*.test.ts(x)` | |
| E2E | Playwright | `web/e2e/` | foydalanuvchi oqimi |

Biznes qoida o'zgarsa — avval `BIZNES-QOIDALAR.md`, keyin test, keyin kod.

## 5. Web (admin panel)

- Qatlamlar (FSD): `routes → features → entities → shared`; faqat pastga
  import (ESLint majburlaydi). Supabase'ga murojaat faqat `features/*/api`.
- Server holati — TanStack Query (query-key fabrikasi orqali); lokal UI
  holati — komponent ichida. Global store yo'q.
- Formalar — react-hook-form + zod; sxema bitta joyda, forma va API
  bir sxemadan foydalanadi.
- Har sahifa: yuklanish (skeleton), bo'sh holat, xato holati, light/dark,
  360 px kenglik.

## 6. Sirlar

- Sir/token/parol kodga, commit'ga, issue'ga yozilmaydi. Yangi env
  o'zgaruvchi → `.env.example` + `docs/DEPLOY.md` (9-bo'lim jadvali).
- Brauzerga faqat `publishable` kalit; `secret` kalit — faqat CI va Edge
  Functions.

## 7. PR tekshiruv ro'yxati

PR shabloni (`.github/pull_request_template.md`) bo'yicha: vazifa ID, qaysi
BR qoidalar, qanday tekshirildi (buyruqlar), skrinshot (UI bo'lsa),
migratsiya/kontrakt o'zgarishi bormi.
