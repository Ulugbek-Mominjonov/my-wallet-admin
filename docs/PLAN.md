# My Wallet — bajarish rejasi (master)

> Bu fayl — **yagona yo'l xaritasi** (ikkala repo uchun) va platforma
> (backend + admin) vazifalari. Mobil vazifalar:
> `my-wallet-mobil/docs/PLAN.md`. Har vazifa ID si ikkala faylda **yagona**.
>
> Asoslar: [`BIZNES-QOIDALAR.md`](BIZNES-QOIDALAR.md) (BR-xxx) ·
> [`ARXITEKTURA.md`](ARXITEKTURA.md) (ADR-xx) · [`DEPLOY.md`](DEPLOY.md).

---

## 1. Ish tartibi (bajaruvchi uchun — Claude va dasturchi)

**Keyingi ishni tanlash:**
1. 4-bo'limdagi yo'l xaritasidan holati ✅ bo'lmagan, bog'liqliklari
   bajarilgan **birinchi** epikni ol.
2. O'sha epikda birinchi belgilanmagan `- [ ]` vazifani ol (vazifa qaysi
   repoda — epik sarlavhasidagi `[admin]` / `[mobile]` belgisi).
3. 🔑 belgili vazifa foydalanuvchi harakatini talab qiladi (akkaunt, kalit) —
   bajarilmagan bo'lsa, `DEPLOY.md` dagi tegishli qadamni so'ra va keyingi
   bloklanmagan vazifaga o't.

**Vazifani bajarish:**
1. Vazifadagi `BR-xxx` / `ADR-xx` havolalarini va mavjud kodni o'qi —
   atrofdagi uslubni nusxala.
2. Biznes qoida bo'lsa — **avval test** (test nomida qoida ID si:
   `BR-071: qisman to'lov partial holatini beradi`).
3. Eng kichik to'g'ri o'zgarish; talab qilinmagan refactor aralashtirilmaydi.
4. Tekshir: `make check` (repo ildizida) — lint + tip + testlar.
5. `- [ ]` → `- [x]`, 7-bo'limdagi **Jarayon jurnali**ga bir qator:
   sana · vazifa · qisqa natija (commit'ni `git log --grep <ID>` topadi).
6. Commit xabari: `feat(E05-T02): households va a'zolar jadvallari`
   (Conventional Commits, scope = vazifa ID — `docs/CONTRIBUTING.md`); har vazifa
   oxirida lokal commit, epik tugaganda `git push` (Q2).
7. Qoida yoki arxitektura o'zgarishi kerak bo'lsa — avval hujjat
   (`BIZNES-QOIDALAR.md` / `ARXITEKTURA.md`), keyin kod; qaror 6-bo'limga.

**Belgilar:** `- [ ]` bajarilmagan · `- [x]` bajarildi · `⏳` jarayonda ·
`🔑` foydalanuvchi harakati kerak · `⛔` bloklangan (sababi yoniga yoziladi).
Epik holati: ⬜ boshlanmagan · 🟨 jarayonda · ✅ tugadi.

---

## 2. "Bajarildi" mezoni (har vazifa uchun umumiy DoD)

- [ ] Lint / analiz / tip tekshiruvi toza, barcha testlar yashil (`make check`).
- [ ] Yangi biznes qoida → unit/pgTAP test (qoida ID si bilan).
- [ ] Yangi SQL so'rov → `EXPLAIN` da katta jadvalda `Seq Scan` yo'q;
      indeks migratsiyada.
- [ ] Yangi RLS siyosati → "begona byudjet ko'rinmaydi / yozilmaydi" testi.
- [ ] UI → light va dark, uz/ru/en matnlar, 360 px kenglikda buzilmaydi,
      yuklanish / bo'sh / xato holatlari bor, klaviatura va screen reader.
- [ ] Shartnoma (`contracts/`) o'zgarsa — `schema-version` oshirilgan,
      mobil repoga eslatma.
- [ ] Sir/token kodda yo'q; yangi env o'zgaruvchi `DEPLOY.md` va
      `.env.example` da.

---

## 3. Taxminlar va ochiq savollar

**Qabul qilingan taxminlar** (boshqacha aytilmaguncha shunday ishlanadi):

| # | Taxmin | Nega |
|---|---|---|
| A1 | Yangi tizim — yangi kod bazasi (`~/my-wallet/`), eski repolar o'zgarishsiz | eski texnik qarorlar olinmaydi |
| A2 | Ko'p foydalanuvchili (oilaviy) arxitektura; 1-reliz asosan shaxsiy foydalanish | ADR-04 |
| A3 | Android — asosiy platforma (bepul tarqatish); iOS kodi tayyor, App Store ixtiyoriy | Apple $99/yil |
| A4 | Tarqatish: GitHub Releases + Firebase App Distribution (bepul); Google Play ixtiyoriy | Play $25 bir martalik |
| A5 | Kirish: Google (asosiy) + email kod (Gmail SMTP — bepul); SMS yo'q | SMS pullik |
| A6 | Eski ma'lumot manbai — Google Sheets eksport JSON v1 | BR-181 |
| A7 | MVP'da faqat UZS (sxema ko'p valyutaga tayyor) | E29 |
| A8 | Domen — bepul `*.workers.dev`; o'z domeni ixtiyoriy | bepul |

**Savollar va javoblar** (2026-09-18):

| # | Savol | Javob | Ta'siri |
|---|---|---|---|
| Q1 | Yangi kod qaysi GitHub repolarga? | ✅ mavjud `my-wallet-admin` va `my-wallet-mobil`; eski kod `legacy-v1` branchida (+ `v1-final` teg) | E00-T07 |
| Q2 | Commit/push tartibi? | ✅ har vazifa oxirida lokal commit, har epik oxirida push | 1-bo'lim |
| Q3 | Eski ma'lumot manbai? | ✅ faqat Google Sheets (Firestore v1 da real ma'lumot yo'q) | E27 (Firestore skripti kerak emas) |
| Q4 | iOS kerakmi? | ✅ hozircha yo'q — faqat Android (`flutter create --platforms=android`) | E04, E20 |

---

## 4. Yo'l xaritasi

| Bosqich | Epik | Nomi | Repo | Bog'liqlik | Holat |
|---|---|---|---|---|---|
| **M0 Poydevor** | E00 | Hujjatlar, repolar, konvensiyalar | admin + mobile | — | ⬜ |
| | E01 | Supabase backend skeleti | admin | E00 | ⬜ |
| | E02 | Admin web skeleti | admin | E00 | ⬜ |
| | E03 | Platforma CI/CD, zaxira, keep-alive | admin | E01, E02 | ⬜ |
| | E04 | Mobil skelet + CI | mobile | E00 | ⬜ |
| **M1 Backend yadrosi** | E05 | Byudjet, a'zolar, rollar, RLS | admin | E01 | ⬜ |
| | E06 | Spravochniklar sxemasi | admin | E05 | ⬜ |
| | E07 | Amallar, rejalar, fond, qarz, maqsad | admin | E06 | ⬜ |
| | E08 | Biznes RPC'lar | admin | E07 | ⬜ |
| | E09 | Hisobotlar + golden fixtures + `contracts/` | admin | E08 | ⬜ |
| | E10 | Sinxron API | admin | E07 | ⬜ |
| | E11 | Rejali ishlar va bildirishnomalar | admin | E08 | ⬜ |
| **M2 Mobil MVP** | E12 | Domen paketi + fixtures pariteti | mobile | E09 | ⬜ |
| | E13 | Lokal baza va sinxron dvigatel | mobile | E10, E12 | ⬜ |
| | E14 | Auth, onboarding, ilova qobig'i | mobile | E13 | ⬜ |
| | E15 | Amallar | mobile | E14 | ⬜ |
| | E16 | Xulosa (dashboard) va hisobotlar | mobile | E15 | ⬜ |
| | E17 | To'lovlar (rejalar) | mobile | E15 | ⬜ |
| | E18 | Hamyon: hisoblar, fond, jamg'arma, qarz, maqsad, limit | mobile | E15 | ⬜ |
| | E19 | Bildirishnomalar va sozlamalar | mobile | E11, E14 | ⬜ |
| | E20 | Sifat, sayqal, reliz konveyeri | mobile | E15–E19 | ⬜ |
| **M3 Admin MVP** | E21 | Auth, byudjet konteksti, layout | admin | E05, E02 | ⬜ |
| | E22 | Spravochniklar | admin | E21, E06 | ⬜ |
| | E23 | Amallar va rejalar | admin | E22, E08 | ⬜ |
| | E24 | Hisobotlar va dashboard | admin | E23, E09 | ⬜ |
| | E25 | Vositalar: tekshiruv, import/eksport, audit | admin | E24 | ⬜ |
| | E26 | Platforma (super-admin) | admin | E21, E11 | ⬜ |
| **M4 Ishga tushirish** | E27 | Eski ma'lumotni ko'chirish | admin | E25 | ⬜ |
| | E28 | Production v1.0 | admin + mobile | E20, E26, E27 | ⬜ |
| **M5 Kengaytmalar** | E29 | Ko'p valyuta (CBU) | admin + mobile | E28 | ⬜ |
| | E30 | Oilaviy byudjet (takliflar, rollar UI) | admin + mobile | E28 | ⬜ |
| | E31 | Telegram bot: tez kiritish, karta xabarlari | admin | E28 | ⬜ |
| | E32 | Tahlillar (insights) | admin + mobile | E28 | ⬜ |
| | E33 | Android vidjet, chek QR skaneri | mobile | E28 | ⬜ |
| | E34 | Limitlar v2 (rollover, ota-kategoriya) | admin + mobile | E28 | ⬜ |

**Kritik yo'l:** E00 → E01 → E05 → E06 → E07 → E10 → E13 → E14 → E15 → E20 → E28.
Parallel olib borish mumkin: E02/E03 (admin skelet) E05–E09 bilan;
E21–E26 (admin) M2 bilan.

---

## 5. Epiklar va vazifalar (platforma: backend + admin)

### E00 · Hujjatlar, repolar, konvensiyalar `[admin + mobile]`

> **Maqsad:** ikkala repo tayyor, qoidalar yozilgan, har kim bir xil ishlaydi.
> **DoD:** repolar GitHub'da, README'lar, konvensiyalar, PR shabloni.

- [x] **E00-T01** Eski loyihalar biznes mantiqini o'rganish →
  `docs/BIZNES-QOIDALAR.md` (BR-ID bilan, eski → yangi jadval, kamchiliklar).
- [x] **E00-T02** Arxitektura va ADR'lar → `docs/ARXITEKTURA.md`;
  mobil arxitektura → `my-wallet-mobil/docs/ARXITEKTURA.md`.
- [x] **E00-T03** Reja (shu fayl + mobil `PLAN.md`) va deploy yo'riqnomasi
  (`docs/DEPLOY.md`, `my-wallet-mobil/docs/DEPLOY.md`).
- [x] **E00-T04** Repo asoslari (ikkala repo): `.editorconfig`,
  `.gitattributes`, `.gitignore` (aniq yo'llar bilan — `lib/` kabi keng naqsh
  yo'q), `README.md` (nima, qanday ishga tushadi, hujjatlarga havolalar),
  `LICENSE` (private — "All rights reserved"), `Makefile` (`check`, `dev`,
  `test`, `fmt`).
  - Qabul: `make check` ikkala repoda ishlaydi (hozircha bo'sh maqsadlar).
- [x] **E00-T05** Konvensiyalar → `docs/CONTRIBUTING.md` (ikkala repo):
  branch nomlari (`feat/E05-T02-households`), Conventional Commits +
  vazifa ID, PR shabloni (qaysi BR, qanday tekshirildi, skrinshot),
  kod uslubi (til: kod — ingliz, hujjat/UI — o'zbek), migratsiya qoidalari
  (faqat oldinga, bitta migratsiya = bitta mavzu).
- [ ] **E00-T06** `.github/`: `pull_request_template.md`, issue shablonlari
  (bug, feature), `CODEOWNERS`, `dependabot.yml` (npm, pub, github-actions —
  haftalik, guruhlangan).
- [ ] 🔑 **E00-T07** GitHub remote (Q1 javobiga ko'ra): repolarni ulash,
  himoyalangan `main` (PR + CI yashil talab), Environments: `staging`,
  `production` (prod — qo'lda tasdiq). `DEPLOY.md` 1-qadam.

### E01 · Supabase backend skeleti `[admin]`

> **Maqsad:** lokal Supabase Docker'da ishlaydi, migratsiya/test/tip
> generatsiyasi konveyeri tayyor. **Qoidalar:** ADR-01, ADR-02, ADR-07.
> **DoD:** `make db-reset && make db-test` yashil; tiplar generatsiya qilinadi.

- [ ] **E01-T01** `supabase init`; `config.toml`: loyiha nomi, `auth.site_url`,
  redirect URL'lar (lokal admin, `mywallet://auth-callback`), JWT muddati,
  email OTP, Google provider (`env()` bilan), `db.major_version`.
  `package.json` ga `supabase` CLI (dev dependency, pinned).
- [ ] **E01-T02** Birinchi migratsiya — asoslar: kengaytmalar (`pg_trgm`,
  `pg_cron`, `pg_net`, `pgtap` — faqat test), sxemalar (`private`, `jobs`),
  `uuid_v7()` funksiyasi, umumiy enum tiplar, `set_updated_at` va
  `set_row_version` triggerlari (advisory lock bilan — ARX 6), global
  `sync_seq` sequence.
  - Qabul: pgTAP: `uuid_v7()` monoton; `row_version` har UPDATE'da o'sadi.
- [ ] **E01-T03** Audit infratuzilmasi: `audit_log` jadvali + umumiy
  `private.audit()` trigger funksiyasi (eski/yangi jsonb, faqat o'zgargan
  maydonlar), indeks `(household_id, at desc)`. BR-008.
- [ ] **E01-T04** Test harness: `supabase/tests/database/000_setup.test.sql`,
  yordamchilar (`tests.create_user`, `tests.authenticate_as`, `tests.as_anon`),
  `make db-test` → `supabase test db`.
- [ ] **E01-T05** Tip generatsiyasi: `make db-types` →
  `web/src/shared/api/database.types.ts`; CI'da farq bo'lsa qulaydi.
- [ ] **E01-T06** `seed.sql` skeleti (tizim spravochniklari keyingi epiklarda
  to'ldiriladi) + `make db-reset`.
- [ ] **E01-T07** Migratsiya xavfsizligi: `squawk` bilan lint (`make db-lint`),
  qoidalar `docs/CONTRIBUTING.md` da.

### E02 · Admin web skeleti `[admin]`

> **Maqsad:** zamonaviy, tez, tipli SPA karkasi: dizayn tizimi, marshrutlash,
> i18n, test. **Qoidalar:** ADR-10, ADR-15. **DoD:** `pnpm build` + unit +
> e2e smoke yashil; light/dark; 3 til.

- [ ] **E02-T01** `web/`: Vite + React 19 + TypeScript (strict,
  `noUncheckedIndexedAccess`), pnpm, ESLint (flat config: typescript-eslint,
  react-hooks, jsx-a11y, `boundaries` — FSD import qoidasi), Prettier,
  path aliaslar (`@/app`, `@/features`, `@/entities`, `@/shared`).
- [ ] **E02-T02** Dizayn tizimi: Tailwind v4 + shadcn/ui; tokenlar
  (`--background`, `--primary`, `--income`, `--expense`, `--warning`,
  `--danger`, radius, soya) light/dark; shriftlar (Inter, `tabular-nums`
  raqamlar uchun); asosiy komponentlar: Button, Input, Select, Dialog, Sheet,
  DropdownMenu, Tabs, Badge, Card, Skeleton, Toast (sonner), Tooltip,
  DataTable (TanStack Table), `MoneyText`, `MonthPicker`, `EmptyState`,
  `PageHeader`, `StatCard`.
- [ ] **E02-T03** Marshrutlash: TanStack Router (fayl asosida, tipli
  search-param'lar), `_auth` va `_app` layoutlari, 404/xato sahifalari,
  lazy-loading (route-level code splitting).
- [ ] **E02-T04** Ma'lumot qatlami: `shared/api/supabase.ts` (bitta klient,
  PKCE), TanStack Query (standart `staleTime`, retry siyosati, global xato
  → toast), query-key fabrikasi (`qk.transactions.list(householdId, filters)`).
- [ ] **E02-T05** i18n: i18next + `uz` (asosiy), `ru`, `en` JSON; pul/sana
  formatlash (`Intl`, `1 234 567 so'm`, `Sentabr 2026`) — `shared/lib/format`
  + unit testlar.
- [ ] **E02-T06** Layout: yig'iladigan sidebar (bo'limlar: Dashboard,
  Hisobotlar, Amallar, Rejalar, Spravochniklar, Vositalar, Platforma),
  topbar (byudjet almashtirgich, oy tanlagich, tema, til, profil),
  ⌘K buyruqlar palitrasi (cmdk), mobil kenglikda drawer.
- [ ] **E02-T07** Test infratuzilmasi: Vitest + Testing Library + MSW,
  Playwright (chromium) + `e2e/smoke.spec.ts`, `make web-check`.
- [ ] **E02-T08** `wrangler.jsonc` (Workers Static Assets,
  `not_found_handling: "single-page-application"`), xavfsizlik sarlavhalari
  (`_headers`: CSP — faqat o'z domen + Supabase URL, `X-Frame-Options: DENY`,
  `Referrer-Policy`), env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`,
  `VITE_APP_ENV`.

### E03 · Platforma CI/CD, zaxira, keep-alive `[admin]`

> **Maqsad:** har PR avtomatik tekshiriladi; `main` → staging avtomatik,
> teg → production (qo'lda tasdiq); zaxira va keep-alive ishlaydi.
> **Qoidalar:** ADR-12, ADR-13. **DoD:** bo'sh ilova staging va prod'ga
> pipeline orqali chiqdi; zaxira faylini tiklash sinovdan o'tdi.

- [ ] **E03-T01** `ci.yml` (PR + push): `web` job (install → lint → typecheck →
  unit + coverage → build), `db` job (supabase start → `db reset` → `db lint` →
  squawk → pgTAP → tiplar farqi yo'qligi), `functions` job (deno fmt/lint/test),
  `e2e` job (lokal supabase + `vite preview` + Playwright; xatoda hisobot
  artefakt). Keshlar (pnpm store, Docker image'lar), `concurrency` bilan eski
  ishga tushishlarni bekor qilish, `paths` filtrlari (minutlarni tejash).
- [ ] 🔑 **E03-T02** `deploy.yml`: `main` push → **staging**:
  `supabase link` → `db push` → `functions deploy` → `secrets set` →
  `config push` (auth) → web build (staging env) → `wrangler deploy --env
  staging` → smoke (health RPC + Playwright smoke). `v*` teg yoki qo'lda →
  **production** (Environment tasdig'i bilan) — xuddi shu qadamlar.
  Sirlar: `DEPLOY.md` 4-bo'lim.
- [ ] **E03-T03** `preview.yml` (PR): web'ni staging backend bilan build →
  `wrangler versions upload --preview-alias pr-<N>` → PR'ga havola izohi.
- [ ] 🔑 **E03-T04** `backup.yml` (har kecha 21:00 UTC = 02:00 Toshkent):
  prod `pg_dump` (session pooler, `--no-owner`), gzip, `age` bilan shifrlash
  (ochiq kalit — repo o'zgaruvchisi), artefakt 90 kun; `scripts/restore.sh`
  (shifrni ochish → staging yoki lokalga tiklash) + `docs/DEPLOY.md` 8-bo'lim.
  - Qabul: haftalik `restore-drill` ishi zaxirani lokal Postgres'ga tiklaydi
    va qatorlar sonini tekshiradi.
- [ ] **E03-T05** `keepalive.yml` (har 2 kunda): staging va prod `health`
  RPC (publishable kalit bilan), javob > 3 s yoki xato → ops Telegram
  ogohlantirishi. ADR-13.
- [ ] **E03-T06** Reliz: `release-please` (CHANGELOG, semver teg) —
  teg production deploy'ni ishga tushiradi.
- [ ] **E03-T07** Branch himoyasi va `CODEOWNERS` hujjatlashtirildi
  (`DEPLOY.md` 1-bo'lim), Actions minut sarfi hisobi (`docs/CI.md`: har job
  necha daqiqa, oylik 2000 dan qancha).

> **E04** (mobil skelet + CI) — `my-wallet-mobil/docs/PLAN.md`.

### E05 · Byudjet, a'zolar, rollar, RLS `[admin]`

> **Qoidalar:** BR-010..015, BR-210, BR-213, ADR-04.
> **DoD:** ro'yxatdan o'tgan foydalanuvchi avtomatik shaxsiy byudjetga ega;
> RLS testlari: begona byudjet ko'rinmaydi, rollar huquqlari aniq.

- [ ] **E05-T01** Jadvallar: `profiles`, `households`, `household_members`
  (`member_role` enum), `household_invites`; FK, unique, CHECK
  (`personal_fund_day` 1–31, `timezone` mavjud zona, `base_currency` 3 harf).
- [ ] **E05-T02** `private` yordamchilar: `my_household_ids()`,
  `my_writable_household_ids()`, `my_admin_household_ids()`,
  `is_platform_admin()` (`security definer`, `stable`, `search_path=''`).
- [ ] **E05-T03** RLS siyosatlari (ARX 4): profil — faqat o'zi; byudjet —
  a'zolar o'qiydi, `owner/admin` tahrirlaydi; a'zolar — a'zolar ko'radi,
  `owner/admin` boshqaradi; oxirgi owner'ni o'chirish/rolini tushirish taqiq
  (trigger, BR-014).
- [ ] **E05-T04** `on_auth_user_created` trigger: profil + "Shaxsiy byudjet"
  (UZS, Asia/Tashkent) + `owner` a'zolik. Standart spravochniklar E06-T08 da
  qo'shiladi. BR-010.
- [ ] **E05-T05** Takliflar: `create_invite(household, role)` (8 belgili kod,
  7 kun), `accept_invite(code)` (bir martalik, muddat, allaqachon a'zo),
  `leave_household`, `transfer_ownership`. BR-012, BR-014.
- [ ] **E05-T06** `app_bootstrap()` RPC: profil, byudjetlar ro'yxati (rol
  bilan), `app_config` (min versiyalar). `app_config` va `platform_admins`
  jadvallari + RLS.
- [ ] **E05-T07** pgTAP: 2 foydalanuvchi, 2 byudjet — o'qish/yozish matritsasi
  (owner/admin/member/viewer × jadval), taklif oqimi, oxirgi owner himoyasi.

### E06 · Spravochniklar sxemasi `[admin]`

> **Qoidalar:** BR-003, BR-020..026, BR-030..037, BR-080, BR-130, BR-140,
> BR-190. **DoD:** barcha spravochnik jadvallari RLS, indeks, cheklov va
> testlar bilan; yangi byudjet standart to'plamni oladi.

- [ ] **E06-T01** Tizim spravochniklari: `currencies` (UZS, USD, EUR, RUB —
  `exponent`, `symbol`, `name_i18n`), `category_templates` (BR-031/032, 3
  tilda, ikon/rang, `month_shift`, `system_code`), `exchange_rates`
  (bo'sh; E29). O'qish — hamma, yozish — platforma admini.
- [ ] **E06-T02** `accounts`: turlar enum, valyuta FK, boshlang'ich qoldiq,
  arxiv; unique(household, lower(name)) `WHERE deleted_at IS NULL`; bitta
  `personal_fund` (partial unique); valyutani amaldan keyin o'zgartirish
  taqiq (BR-026, trigger).
- [ ] **E06-T03** `categories`: kind, `parent_id` (1 daraja — trigger),
  `month_shift` (faqat income, −1..1), `system_code`, arxiv; tizim
  kategoriyasini o'chirish taqiq (BR-033); unique(household, kind,
  lower(name)).
- [ ] **E06-T04** `recurring_rules`: kind (`expense`/`income`/`allocation`),
  summa NULL ruxsat (o'zgaruvchi), `day_of_month` 1–31, amal davri,
  `debt_id` (FK E07 da qo'shiladi), tartib.
- [ ] **E06-T05** `category_limits` (unique household+category, summa > 0),
  `quick_actions` (summa > 0, tartib), `tags` (unique lower(name)).
- [ ] **E06-T06** RLS: o'qish — a'zolar; yozish — `owner/admin` (BR-011).
  Hamma jadvalga `set_row_version`, `set_updated_at`, `audit` triggerlari.
- [ ] **E06-T07** Indekslar: `(household_id, row_version)` har jadvalda,
  `(household_id, sort_order)` ro'yxatlar uchun.
- [ ] **E06-T08** Yangi byudjetga standart to'plam: `private.seed_household
  (household, locale)` — shablondan kategoriyalar (lokal tilda), hisoblar
  (Naqd, Karta, 👤 Shaxsiy fond), fond qoidasi (10%, naqd, 5-kun).
  `on_auth_user_created` shu funksiyani chaqiradi.
- [ ] **E06-T09** pgTAP: har cheklov (BR ID bilan), tizim kategoriyasi
  himoyasi, rol huquqlari, standart to'plam to'liqligi.

### E07 · Amallar, rejalar, fond, qarz, maqsad `[admin]`

> **Qoidalar:** BR-040..046, BR-050..056, BR-060..065, BR-070..077,
> BR-110..118, BR-120..123, BR-150..153, BR-201. **DoD:** har qoida pgTAP
> bilan; qaysi yo'l bilan yozilmasin (PostgREST, RPC, cron) natija bir xil.

- [ ] **E07-T01** `debts`, `goals`, `months` jadvallari (+ `recurring_rules.
  debt_id` FK), RLS (yozish — `owner/admin/member`), triggerlar, indekslar.
- [ ] **E07-T02** `planned_items`: ustunlar (ARX 3.2), unique
  `(recurring_rule_id, budget_month)` va `(household_id, budget_month,
  system_code)`, qisman indeks (to'lanmaganlar), `status` —
  `private.planned_status(item, today)` funksiyasi (BR-071; saqlanmaydi).
- [ ] **E07-T03** `transactions`: ustunlar, kind CHECK'lari (income/expense —
  kategoriya majburiy; transfer — `to_account_id` majburiy, kategoriya yo'q,
  manba ≠ manzil), summa > 0, hisob va kategoriya bir byudjetdan (trigger),
  indekslar (ARX 3.4).
- [ ] **E07-T04** `tx_derive` BEFORE trigger: `budget_month` (BR-040..046:
  income + `month_shift`, xarajat → sana oyi, reja bog'langan → reja oyi,
  `manual` ga tegilmaydi), `currency` (hisobdan), `amount_base` (MVP: =
  `amount`; E29 da kurs). pgTAP: 4-jadvaldagi misollar (02.10 Oylik → 2026-09 …).
- [ ] **E07-T05** `tx_after` AFTER trigger: bog'langan reja(lar)ning
  `paid_amount` qayta hisobi (INSERT/UPDATE/DELETE, reja almashsa ikkalasi);
  `paid_amount ≥ planned` (reja summasi bo'sh bo'lsa — birinchi to'lov) →
  `settled_at`; to'lov o'chirilsa qaytariladi (BR-071, BR-073).
- [ ] **E07-T06** 👤 Fond: `personal_fund` hisobiga o'tkazma = ajratma
  (BR-061); ajratma rejasi (`system_code = personal_allocation`) —
  `percent` rejimida oy daromadi o'zgarsa `planned_amount` qayta hisoblanadi:
  `round(daromad × foiz / 100 / 1000) × 1000` (BR-060). pgTAP: 1 499 600 × 10%
  → 150 000 (bir marta yaxlitlash).
- [ ] **E07-T07** Oy qulfi: `month_lock_guard` — `strict_month_lock`
  bo'lsa yopilgan oyga yozuv rad etiladi, aks holda o'tadi (ogohlantirish —
  klientda). BR-055, BR-150..152.
- [ ] **E07-T08** Qarz ko'rinishi: `debt_balances` view (security invoker) —
  bitta `GROUP BY debt_id`: ilovadan, kutilmoqda (bog'langan to'lanmagan
  rejalar), qolgan, qolgan oy, tugash oyi, holat (BR-112..116).
  Maqsad ko'rinishi: `goal_progress` view (qo'lda yoki hisob qoldig'i,
  BR-121..122).
- [ ] **E07-T09** Hisob qoldiqlari: `account_balances` view (BR-021) — bitta
  so'rov, `UNION ALL` (chiquvchi/kiruvchi) + `GROUP BY`.
- [ ] **E07-T10** Storage: `receipts` bucket (private), RLS (yo'l =
  `{household_id}/...`), amal o'chirilganda fayl o'chirish navbati. BR-201.
- [ ] **E07-T11** pgTAP to'plami: BR-040..046, 052, 060..063, 071..073, 110..116,
  121..122, 150..152 — har biriga kamida bitta ijobiy va bitta salbiy holat.

### E08 · Biznes RPC'lar `[admin]`

> **Qoidalar:** BR-043, BR-073, BR-074, BR-081..085, BR-036, BR-153.
> **DoD:** har RPC idempotent yoki tranzaksion; pgTAP + `contracts/api.md`.

- [ ] **E08-T01** `open_month_preview(household, month)` va
  `open_month(household, month)`: aktiv shablonlar (tartib bo'yicha, amal
  davri ichida) + fond ajratmasi; `INSERT ... SELECT ... ON CONFLICT DO
  NOTHING`; natija `{created, skipped, items}`; `months.opened_at`.
  pgTAP: ikki marta chaqirish = takror yo'q; 31-kun fevralda 28/29.
- [ ] **E08-T02** `pay_planned(item, amount, account, date, settle)`:
  BR-073 (summa standart = qolgan; noma'lum summaga majburiy; to'langanga
  xato; kam bo'lsa `partial` yoki `settle`). `skip_planned(item, bool)`.
- [ ] **E08-T03** `bulk_pay_planned(items[])` — bitta tranzaksiya, faqat
  summasi aniq rejalar, natija `{paid, skipped:[{id, reason}]}`. BR-074.
- [ ] **E08-T04** `recalc_income_months_preview(household)` (qaysi yozuv
  qayerdan qayerga) va `..._apply(household, expected_count)` (preview'dan
  keyin o'zgargan bo'lsa rad etadi). BR-043.
- [ ] **E08-T05** `set_month_closed(household, month, closed)` +
  `month_close_check` (to'lanmagan/noma'lum soni — BR-153). `merge_categories
  (from, to)` — amallar, rejalar, shablonlar, limitlar ko'chiriladi. BR-036.
- [ ] **E08-T06** `onboarding_apply(payload jsonb)` — hisoblar (boshlang'ich
  qoldiq), daromad turlari va oy qoidalari, doimiy rejalar, fond qoidasi,
  eslatma sozlamasi — bitta tranzaksiyada, qayta chaqirilsa ustiga yozmaydi.
- [ ] **E08-T07** `contracts/api.md`: har RPC imzosi, payload namunasi, xato
  kodlari (`P0001` + `code` matn: `planned_already_paid`, `amount_required`,
  `month_closed`, `conflict` …); `contracts/schema-version` = 1.

### E09 · Hisobotlar + golden fixtures + `contracts/` `[admin]`

> **Qoidalar:** BR-090..095, BR-100..103, BR-063..064, BR-112..114,
> BR-121, BR-130..131, BR-170..172, ADR-03. **DoD:** har hisobot bitta RPC;
> golden fixture'lar bilan kontrakt testlari yashil; `EXPLAIN` testlari.

- [ ] **E09-T01** `private.month_facts(household, from, to)` — yagona
  agregatsiya yadrosi: tegishli oy × {daromad, daromad karta/naqd, xarajat,
  xarajat karta/naqd, ajratma, fond sarfi} + tur × usul matritsasi +
  kategoriya × {reja, fakt}. Qoidalar: BR-022 (karta/naqd), BR-061/062 (fond).
- [ ] **E09-T02** `report_month(household, month)` → bitta JSON: yig'indilar
  (BR-090), hosila (BR-091), prognoz (BR-093, kutilayotgan daromad rejalari
  bilan), kuniga sarflash (BR-094), kategoriyalar + limit holati (BR-130),
  to'lanmaganlar ro'yxati (BR-076), fond (shu oy + jami), jamg'arma
  (oldingi / shu oy / to'plangan — BR-102), qarz jami (BR-114), maqsadlar,
  oyning yopiqligi. "Bugun" — byudjet vaqt zonasida.
- [ ] **E09-T03** `report_year(household, year)` (oylar × daromad, xarajat,
  ajratma, qoldiq, fond sarfi, orttirgan, % + JAMI qatori, 🔒 belgisi),
  `report_savings(household)` (BR-100..101, ⏳ joriy oy), `report_personal_fund
  (household, from, to)`, `report_debts`, `report_goals`,
  `report_category_trend(household, from, to, category?)` (BR-095).
- [ ] **E09-T04** `health_check(household)` → `{problems[], warnings[],
  info[]}` — BR-171 ro'yxati; o'xshash nom taklifi `pg_trgm similarity`
  bilan (BR-117).
- [ ] **E09-T05** Golden fixture'lar `contracts/fixtures/*.json` — har holat:
  `today`, sozlamalar, spravochniklar, amallar, rejalar → kutilgan natijalar
  (`month`, `year`, `savings`, `debts`, `goals`, `planned_status`,
  `income_month`). Majburiy holatlar: BR-091 misoli (5 750 000 → orttirgan
  3 300 000), README'dagi jamg'arma jadvali (1 400 000 → 4 150 000), BR-040
  jadvali, qisman to'lov, noma'lum summa (`+ 2 ta ?`), avto to'lov, qarz
  (3 holat), maqsad (muddatga ulguradi/ulgurmaydi), prognoz (joriy/o'tgan oy,
  kutilayotgan daromad bor/yo'q), limit 79/80/100/101%, BR-092 invarianti.
- [ ] **E09-T06** Kontrakt testlari `supabase/tests/contract/` (Deno):
  fixture → lokal bazaga yozish → RPC → kutilgan natija bilan aynan
  solishtirish. CI `db` job'iga ulanadi.
- [ ] **E09-T07** Ishlash: 10 yillik sintetik ma'lumot generatori
  (`scripts/gen-load.sql`: 1 byudjet × 25 000 amal) + `EXPLAIN (ANALYZE,
  BUFFERS)` testlari: `report_month` < 50 ms, `report_year` < 150 ms,
  Seq Scan yo'q. Natija `docs/PERF.md` ga.
- [ ] **E09-T08** `contracts/README.md` (nima, qanday versiyalanadi, mobil
  qanday oladi) + `scripts/contracts-publish.sh` (`BIZNES-QOIDALAR.md` ni
  `contracts/` ga nusxalash, `schema-version` tekshiruvi).

### E10 · Sinxron API `[admin]`

> **Qoidalar:** BR-006, BR-007, ADR-07, ADR-09, ARX 6. **DoD:** pull/push
> idempotent; to'qnashuv va rad etish holatlari; parallel yozuvda kursor
> hech narsani o'tkazib yubormaydi (test).

- [ ] **E10-T01** `sync_pull(household, cursor, limit)` — `UNION ALL` +
  `ORDER BY row_version LIMIT` (merge append), tombstone'lar,
  `resync_required` (`households.purged_version`). Klientga kerakli
  ustunlar ro'yxati (`contracts/api.md`).
- [ ] **E10-T02** `sync_push(household, device, mutations)` — ≤ 100,
  `sync_mutations` orqali idempotentlik, `base_version` tekshiruvi →
  `conflict`, har mutatsiya savepoint'da → `ok | conflict | rejected`,
  jadval bo'yicha oq ro'yxat maydonlar, `household_id` almashtirish taqiq.
- [ ] **E10-T03** O'chirish = soft delete (`deleted_at`) barcha sinxron
  jadvallarda; PostgREST o'qishlarida `deleted_at IS NULL` (RLS siyosatida
  yoki view orqali — qaror `ARXITEKTURA.md` ga).
- [ ] **E10-T04** Parallel test: ikki sessiya bir byudjetga bir vaqtda yozadi,
  pull kursori hech qatorni o'tkazib yubormaydi (advisory lock kafolati);
  boshqa byudjetlar bir-birini bloklamaydi.
- [ ] **E10-T05** Tozalash: `jobs.purge()` — 90 kunlik tombstone,
  `purged_version` yangilanadi; test: eski kursor → `resync_required`.
- [ ] **E10-T06** `contracts/api.md` — sinxron protokoli (payload, holatlar,
  xato kodlari, oq ro'yxatlar); `schema-version` oshiriladi.

### E11 · Rejali ishlar va bildirishnomalar `[admin]`

> **Qoidalar:** BR-075, BR-084, BR-133, BR-160..168, BR-192, ADR-11.
> **DoD:** har ish set-based va idempotent; pgTAP (nima yuboriladi) +
> Deno testlari (qanday yuboriladi); `job_runs` da natija.

- [ ] **E11-T01** `notification_prefs` (standart: push ✓, soat 9, 3 kun,
  oylik hisobot ✓ 21-kun, limit ogohlantirishi ✓), `device_tokens`,
  `telegram_links` + `telegram_link_tokens`, `notification_outbox`
  (dedupe unique), `monthly_reports`, `job_runs` + RLS.
- [ ] **E11-T02** `jobs.daily_sweep(now)`: lokal 00:05 dan o'tgan va bugun
  ishlamagan byudjetlar — avto to'lov (`INSERT ... SELECT`, `source =
  auto_pay`, takrorga qarshi unique), 1-kuni avto-ochish (`open_month`).
  pgTAP: vaqt zonasi chegarasi, takroriy ishga tushirish.
- [ ] **E11-T03** `jobs.enqueue_reminders(now)` (BR-160: bo'sh bo'lsa
  yubormaydi, noma'lum summa matni), `jobs.enqueue_monthly_reports(now)`
  (BR-161..162, `monthly_reports` ga saqlaydi), `jobs.enqueue_income_missing`
  (BR-165), limit ogohlantirishlari `tx_after` dan (BR-133, oyda bir marta).
- [ ] **E11-T04** Edge Function `notify-dispatch`: outbox'dan olish
  (`FOR UPDATE SKIP LOCKED` — RPC orqali), FCM HTTP v1 (servis akkaunt JWT,
  token keshi), Telegram `sendMessage` (HTML), email (SMTP — ixtiyoriy),
  natija/xato yozish, eskirgan FCM tokenlarni o'chirish, 3 ta qayta urinish.
- [ ] **E11-T05** Edge Function `telegram-webhook`: secret header tekshiruvi,
  `/start <token>` → bog'lash (BR-163), `/stop`, `/balans`, `/bugun`;
  noma'lum xabar → yordam matni.
- [ ] **E11-T06** Xabar shablonlari (uz/ru/en) — `_shared/i18n.ts`: kunlik
  eslatma, oylik hisobot (BR-161 bloklari), limit, daromad kechikdi.
  Snapshot testlari.
- [ ] **E11-T07** pg_cron jadvali (ARX 7) — migratsiyada `cron.schedule`,
  Edge Function URL va sir `vault` da; `notify_dispatch` faqat outbox bo'sh
  bo'lmasa HTTP chaqiradi. `test_notification(user, channel)` RPC (BR-164).
- [ ] **E11-T08** `fx-sync` Edge Function (skelet; E29 da to'liq) va
  `delete-account` Edge Function (BR-015: a'zoliklar, yolg'iz byudjetlar,
  storage fayllari, auth foydalanuvchisi).

> **E12–E20** (mobil MVP) — `my-wallet-mobil/docs/PLAN.md`.

### E21 · Admin: auth, byudjet konteksti, layout `[admin]`

> **Qoidalar:** BR-011, BR-213, ADR-10. **DoD:** Google va email kod bilan
> kirish; rolga qarab menyu; platforma admini uchun 2FA majburiy.

- [ ] **E21-T01** Kirish sahifasi: Google OAuth (PKCE redirect), email OTP
  (6 xonali kod), xatolar tarjimasi, "Qayerdan kirdim" — sessiya holati.
- [ ] **E21-T02** Byudjet konteksti: `app_bootstrap` → joriy byudjet
  (URL'da `?h=` emas, `/h/$householdId/...` marshrut prefiksi), almashtirgich,
  oxirgi tanlangan byudjet eslab qolinadi.
- [ ] **E21-T03** Rolga asoslangan himoya: marshrut `beforeLoad` da rol
  tekshiruvi, menyu elementlari yashirinadi, `viewer` uchun faqat o'qish
  (tugmalar o'chiq), 403 sahifasi.
- [ ] **E21-T04** 2FA (TOTP): sozlash (QR), tasdiqlash, platforma sahifalari
  AAL2 talab qiladi. Profil: ism, til, tema, sessiyadan chiqish (barcha
  qurilmalardan).
- [ ] **E21-T05** E2E: kirish → byudjet tanlash → rolga mos menyu
  (Playwright, lokal supabase'da test foydalanuvchilar).

### E22 · Admin: spravochniklar `[admin]`

> **Qoidalar:** BR-020..026, BR-030..037, BR-080..083, BR-110, BR-120,
> BR-130, BR-140, BR-200. **DoD:** har spravochnik: jadval, qidiruv, forma
> (zod), yaratish/tahrirlash/arxivlash, tartiblash, bo'sh holat, testlar.

- [ ] **E22-T01** Umumiy `DirectoryPage` shabloni: DataTable (saralash,
  qidiruv, ustunlarni yashirish), yon panelda forma (Sheet), optimistik
  yangilash + xatoda qaytarish, arxivlanganlarni ko'rsatish filtri,
  drag & drop tartib (dnd-kit → `sort_order` bitta so'rovda).
- [ ] **E22-T02** **Hisoblar**: turi (ikon), valyuta, boshlang'ich qoldiq/sana,
  joriy qoldiq ustuni (`account_balances`), arxiv; `personal_fund` o'chirilmaydi.
- [ ] **E22-T03** **Kategoriyalar**: daraxt ko'rinishi (daromad / xarajat
  tablari), ikon va rang tanlagich, subkategoriya, daromad uchun "Qaysi oyga
  tegishli" (joriy / oldingi) + o'zgartirilganda **qayta joylash preview**
  (E25-T04 ga havola), birlashtirish dialogi (`merge_categories`), tizim
  kategoriyasi belgisi.
- [ ] **E22-T04** **Doimiy rejalar**: turi (xarajat / daromad / fond ajratmasi),
  summa (bo'sh = "har oy o'zgaradi"), kun, avto to'lov, aktiv, qarz, amal
  davri; "Keyingi oyda nima yaratiladi" preview.
- [ ] **E22-T05** **Limitlar** (kategoriya + summa + joriy oy holati ustuni),
  **Tez tugmalar** (tartib, oldindan ko'rish chipi), **Teglar**.
- [ ] **E22-T06** **Qarzlar** (yo'nalish, umumiy, oldin to'langan, oylik,
  muddat; ro'yxatda qolgan/progress/tugash — `debt_balances`), **Maqsadlar**
  (hisobga bog'lash yoki qo'lda, oyiga, muddat; progress).
- [ ] **E22-T07** **Byudjet sozlamalari**: nomi, asosiy valyuta, vaqt zonasi,
  👤 fond qoidasi (rejim, qiymat, hisob, kun — "joriy oy ajratmasi: X" jonli
  hisob), oy siyosati (avto-ochish, qattiq qulf), a'zolar ro'yxati va
  takliflar (E30 da kengayadi), xavfli zona (byudjetni o'chirish).
- [ ] **E22-T08** Testlar: har forma zod sxemasi (unit), CRUD e2e (hisob,
  kategoriya, doimiy reja).

### E23 · Admin: amallar va rejalar `[admin]`

> **Qoidalar:** BR-040..056, BR-070..085, BR-150..153, BR-183, BR-202.
> **DoD:** katta jadvalda tez ishlash (keyset), ommaviy amallar bitta
> so'rovda, oy ochish/yopish ishlaydi.

- [ ] **E23-T01** **Amallar** jadvali: keyset sahifalash (`occurred_on, id`),
  filtrlar (oy, davr, turi, kategoriya, hisob, a'zo, teg, summa oralig'i),
  qidiruv (payee/izoh, trgm), filtrlar URL'da (ulashiladigan havola),
  jami qatori (filtr bo'yicha — alohida yengil RPC).
- [ ] **E23-T02** Amal formasi (Sheet): turi (xarajat / daromad / o'tkazma),
  summa, hisob(lar), kategoriya (qidiruvli), sana, **tegishli oy jonli
  ko'rsatkichi va almashtirish** (BR-045), payee avto-to'ldirish (BR-056),
  reja/qarz bog'lash, teglar, izoh, chek rasmi ko'rish. Yopilgan oy
  ogohlantirishi (BR-055).
- [ ] **E23-T03** Ommaviy amallar: kategoriyani almashtirish, teg qo'shish,
  o'chirish (tasdiq bilan) — bitta RPC. CSV eksport (joriy filtr).
- [ ] **E23-T04** **Rejalar** sahifasi (oy bo'yicha): bo'limlar — muddati
  o'tgan / bugun / yaqin / keyinroq / to'langan / o'tkazib yuborilgan;
  xarajat va daromad rejalari tablari; "To'landi" (summa, hisob, sana,
  qisman/yopish), "O'tkazib yuborish", ommaviy "To'landi" (BR-074),
  noma'lum summalar `?` bilan, jami: `X so'm + N ta ?`.
- [ ] **E23-T05** **Oyni ochish** dialogi (preview: yaratiladigan rejalar
  ro'yxati → tasdiq), **oyni yopish/qayta ochish** (`month_close_check`
  natijasi bilan dialog, BR-153).
- [ ] **E23-T06** E2E: oy ochish → reja to'lash (to'liq/qisman) → hisobotda
  aks etishi; ommaviy to'lash.

### E24 · Admin: hisobotlar va dashboard `[admin]`

> **Qoidalar:** BR-090..103, BR-112..114, BR-121, BR-130..131, BR-180.
> **DoD:** eski `Hisobot` va `Yillik` sheetlaridagi **har bir ko'rsatkich**
> admin'da bor (izchillik jadvali — BR 24-bo'lim); eksport ishlaydi.

- [ ] **E24-T01** **Dashboard**: joriy oy KPI kartalari (qoldiq, prognoz,
  orttirgan %, kuniga sarflash mumkin), daromad vs xarajat (12 oy, ustun
  grafik), kategoriya donut, yaqin to'lovlar, ogohlantirishlar (limit,
  kechikkan, tekshiruv muammolari soni).
- [ ] **E24-T02** **Oylik hisobot** (`report_month`): 1️⃣ daromad matritsasi
  (tur × karta/naqd + JAMI, ro'yxatdan tashqari tur ogohlantirishi),
  2️⃣ yakun (daromad, xarajat, shundan ajratma, reja, to'lanmagan, qoldiq,
  prognoz, karta, naqd, sarflandi %), 3️⃣ orttirish (shu oy, %, umumiy qoldiq,
  oyiga o'rtacha, oylar soni), 4️⃣ prognoz (o'tgan kunlar, kunlik sarf, oy
  oxiri sarfi, kutilayotgan daromad + "hozircha kelgani" izohi, oy oxiri
  qoldig'i, o'rtacha oylik xarajat), 5️⃣ kategoriya + limit (reja, fakt,
  limit, % rangli), 👤 fond, 🏦 jamg'arma, 💳 qarzlar, 🎯 maqsadlar,
  ⏳ to'lanmaganlar. Oy almashtirgich, 🔒 belgisi, chop etish (print CSS).
- [ ] **E24-T03** **Yillik ko'rinish** (`report_year`): jadval + JAMI qatori
  + grafik (daromad/xarajat ustunlari, orttirgan chizig'i), yillar
  almashtirgich.
- [ ] **E24-T04** **Jamg'arma** (to'planish chizig'i, oylar jadvali ⏳ bilan),
  **Shaxsiy fond** (ajratma/sarf daftari, qoldiq grafigi), **Qarzlar**
  (holatlar, progress, tugash, sof holat, bog'langan to'lovlar tarixi),
  **Maqsadlar** (progress, prognoz, ulguradimi), **Hisoblar qoldig'i**.
- [ ] **E24-T05** **Kategoriya tahlili**: tanlangan davr, oyma-oy trend,
  o'tgan oy va 3 oylik o'rtacha bilan solishtirish (BR-095), subkategoriyaga
  tushish (drill-down) → amallar ro'yxati (filtr bilan).
- [ ] **E24-T06** Eksport: har hisobot → CSV/XLSX (SheetJS), oylik hisobot →
  PDF (brauzer print yoki `@react-pdf/renderer`). BR-180.
- [ ] **E24-T07** Kesh siyosati: hisobotlar `staleTime` 60 s, amal
  yozilganda faqat tegishli oy/yil kalitlari invalidatsiya; e2e: amal
  qo'shish → hisobot yangilanadi.

### E25 · Admin: vositalar `[admin]`

> **Qoidalar:** BR-043, BR-164, BR-170..172, BR-180..183, BR-008.
> **DoD:** eski `🩺 Tekshirish`, eksport, audit, qoida o'zgarishi oqimlari
> ishlaydi; import dry-run bilan.

- [ ] **E25-T01** **Tekshiruv** sahifasi (`health_check`): 3 bo'lim,
  har muammo yonida amal ("Oyni ochish", "Qarzga bog'lash" — o'xshash
  xarajatlar ro'yxatidan tanlab, "Telegram'ni ulash"), "Qayta tekshirish".
- [ ] **E25-T02** **Eksport**: to'liq JSON zaxira (`export_household`),
  CSV/XLSX (amallar, rejalar, davr bo'yicha). BR-180.
- [ ] **E25-T03** **CSV import**: fayl → ustunlarni moslashtirish (sana,
  summa, nom, kategoriya, hisob) → preview (xatolar, dublikatlar — sana +
  summa + nom) → tasdiq → bitta RPC paket. BR-182.
- [ ] **E25-T04** **Daromad qoidasini qayta qo'llash**: preview jadvali
  (yozuv, turi, eski oy → yangi oy), tasdiq → `recalc_income_months_apply`.
- [ ] **E25-T05** **Audit jurnali**: filtr (jadval, a'zo, davr), eski/yangi
  farqi (diff ko'rinishi), keyset sahifalash.
- [ ] **E25-T06** **Bildirishnomalar**: shaxsiy sozlamalar (kanallar, soat,
  kun, oylik hisobot kuni), Telegram'ni ulash (QR + havola), "Test xabar" va
  "Oylik hisobotni hozir yuborish (oy tanlash)" — natija aniq: qayerga
  yuborildi / nega yuborilmadi (BR-164). Yuborish jurnali. Oylik hisobotlar
  arxivi (BR-167).
- [ ] **E25-T07** **Qurilmalar va sinxron**: a'zolar qurilmalari (oxirgi
  sinxron, ilova versiyasi), to'qnashuv/rad etish jurnali.

### E26 · Admin: platforma (super-admin) `[admin]`

> **Qoidalar:** BR-213, BR-214, ADR-10. **DoD:** faqat `platform_admins` +
> AAL2; tizim spravochniklari va monitoring ishlaydi.

- [ ] **E26-T01** Tizim spravochniklari: **valyutalar**, **kategoriya
  shablonlari** (3 tilda nom, ikon, rang, daromad qoidasi, tartib),
  **karta xabar shablonlari** (E31 uchun, hozircha CRUD).
- [ ] **E26-T02** **Ilova konfiguratsiyasi**: min Android/iOS versiya
  (majburiy yangilash, BR-214), texnik ishlar banneri, feature flaglar.
- [ ] **E26-T03** **E'lonlar**: barcha / tanlangan foydalanuvchilarga push
  (`admin-ops` Edge Function), jurnal.
- [ ] **E26-T04** **Foydalanuvchilar va byudjetlar** (qo'llab-quvvatlash
  uchun, faqat agregat — amal tafsilotlari ko'rinmaydi): ro'yxat, ro'yxatdan
  o'tgan sana, oxirgi faollik, byudjetlar soni, bloklash.
- [ ] **E26-T05** **Tizim salomatligi**: rejali ishlar (`job_runs` — oxirgi
  natija, davomiylik, xato), DB hajmi va 500 MB chegaragacha foiz, Storage
  hajmi, eng katta jadvallar, outbox navbati, keep-alive/zaxira holati
  (GitHub API — ixtiyoriy). 70% dan oshsa ogohlantirish.

### E27 · Eski ma'lumotni ko'chirish `[admin]`

> **Qoidalar:** BR-181, BR 24-bo'lim. **DoD:** Sheets eksportidagi har oy
> uchun `qoldiq` va `orttirgan` yangi tizim hisobotlari bilan **aynan teng**;
> dry-run hisobot; qayta ishga tushirish xavfsiz.

- [ ] **E27-T01** Eksport: eski `apps-script-export.gs` (v1 JSON: settings,
  incomes, expenses, personal spends, debts, goals, months) — yo'riqnoma
  `docs/MIGRATSIYA.md`; namunaviy anonim fayl `scripts/fixtures/legacy-v1.json`.
- [ ] **E27-T02** Moslashtirish qoidalari (hujjat + kod):
  daromad → income (tur → kategoriya `month_shift` bilan; `monthKey` saqlanadi,
  `manual`); xarajat qatori: reja bor → `planned_item` (+ fakt bo'lsa to'lov
  amali), faqat fakt → amal; K ustun → `manual` oy; avto belgisi;
  "O'zim uchun" qatori → ajratma rejasi + fondga o'tkazma; O'zim uchun
  sarflari → fond xarajatlari; karta/naqd → "Karta"/"Naqd" hisoblari;
  qarzlar (nom → `debt_id`, eski nom bo'yicha bog'lanishlar tiklanadi);
  maqsadlar; sozlamalar → doimiy rejalar, limitlar, tez tugmalar, fond
  qoidasi, eslatmalar; yopilgan oylar.
- [ ] **E27-T03** `import_legacy_v1(household, payload, dry_run)` RPC (yoki
  admin-ops funksiyasi) — bitta tranzaksiya, `source = import`,
  idempotent (`import_batch_id`), dry-run → `{counts, per_month_diff,
  warnings}`.
- [ ] **E27-T04** Admin sahifa: fayl yuklash → dry-run natijasi (oylar
  jadvali: Sheets qoldiq/orttirgan ↔ yangi, farq qizil) → faqat farq 0 bo'lsa
  "Import" tugmasi faol.
- [ ] **E27-T05** 🔑 Haqiqiy import (staging'da sinov → prod), natija
  jurnalga; 1 oy parallel davr (Sheets faqat o'qish uchun).

### E28 · Production v1.0 `[admin + mobile]`

> **DoD:** prod'da ishlaydi, zaxira tiklash sinovi o'tgan, monitoring
> yoqilgan, foydalanuvchi qo'llanmasi bor, `v1.0.0` teglari.

- [ ] 🔑 **E28-T01** Prod muhit: `DEPLOY.md` 2–7-qadamlari bajarilganini
  tekshirish ro'yxati (Supabase prod, Cloudflare, Firebase, Telegram bot,
  Google OAuth, SMTP, GitHub sirlari).
- [ ] **E28-T02** Xavfsizlik tekshiruvi: Supabase Security Advisor va
  Performance Advisor ogohlantirishlari 0; RLS har jadvalda yoqilgan
  (pgTAP `tests.rls_enabled_everywhere`); sirlar skaneri (gitleaks) CI'da.
- [ ] **E28-T03** Yuklama/ishlash: prod o'lchamidagi sintetik ma'lumotda
  hisobotlar va sinxron vaqtlari (`docs/PERF.md`), mobil sovuq start < 2 s.
- [ ] **E28-T04** Zaxira: prod zaxirasidan staging'ga tiklash mashqi
  muvaffaqiyatli (natija `DEPLOY.md` jurnaliga).
- [ ] **E28-T05** Hujjatlar: `docs/QOLLANMA.md` (foydalanuvchi qo'llanmasi —
  skrinshotlar bilan: onboarding, amal qo'shish, oy ochish, to'lovlar,
  fondlar, hisobotlar, Telegram), `CHANGELOG`.
- [ ] **E28-T06** Reliz: admin `v1.0.0` teg → prod deploy; mobil `v1.0.0`
  (E20-T08) → GitHub Release + App Distribution; E27 importi prod'da.
- [ ] **E28-T07** Ishga tushgandan keyingi 2 hafta: kundalik `health_check`
  va `job_runs` nazorati, xatolar ro'yxati → yangi vazifalar.

### E29 · Ko'p valyuta (CBU) `[admin + mobile]` — platforma qismi

> **Qoidalar:** BR-190..194, ADR-08. Mobil qismi: E29-T07..T09
> (`my-wallet-mobil/docs/PLAN.md`).

- [ ] **E29-T01** `fx-sync` to'liq: cbu.uz JSON (`Ccy`, `Rate`, `Nominal`,
  `Date`) → `exchange_rates` upsert; tarixiy to'ldirish (sana bo'yicha
  so'rov) — birinchi amal sanasidan beri; xatoda `job_runs`.
- [ ] **E29-T02** `tx_derive`: `amount_base = round(amount × kurs)`
  (sanadagi yoki undan oldingi eng yaqin kurs), qo'lda `fx_rate` ustun;
  o'tkazma — `to_amount` majburiy (valyutalar har xil bo'lsa).
- [ ] **E29-T03** Hisobotlar `amount_base` bilan; hisob qoldig'i o'z
  valyutasida + asosiy valyutadagi ekvivalent (joriy kurs); qarz/maqsad
  valyutasi (BR-194).
- [ ] **E29-T04** Admin UI: hisob valyutasi tanlash (UZS dan boshqa ham),
  amal formasida kurs ko'rinishi va qo'lda kurs, "Valyuta kurslari" sahifasi
  (tarix, qo'lda tuzatish — platforma admini).
- [ ] **E29-T05** Fixture'lar: ko'p valyutali holatlar (USD daromad, USD→UZS
  o'tkazma, kurs yo'q kun) → `contracts/`, `schema-version` +1.
- [ ] **E29-T06** Mavjud ma'lumot migratsiyasi: `amount_base` qayta hisobi
  (UZS uchun o'zgarmaydi — test).

### E30 · Oilaviy byudjet `[admin + mobile]` — platforma qismi

> **Qoidalar:** BR-011..014. Backend E05 da tayyor; bu epik — UI va tahlil.
> Mobil qismi: E30-T04..T06.

- [ ] **E30-T01** Admin: a'zolar sahifasi (rol o'zgartirish, chiqarish),
  taklif yaratish (kod + havola + QR, muddati), egalikni o'tkazish.
- [ ] **E30-T02** Hisobotlarda "a'zo" kesimi (kim qancha sarfladi —
  `created_by`), amallar filtrida a'zo.
- [ ] **E30-T03** Bildirishnoma: a'zo katta xarajat qilsa (chegara
  sozlanadi) boshqa a'zolarga push (ixtiyoriy sozlama).

### E31 · Telegram bot: tez kiritish `[admin]`

> **Qoidalar:** BR-220..222.

- [ ] **E31-T01** Matnli kiritish: `taksi 20000` / `20000 taksi` /
  `+5000000 oylik` → tahlil (summa, nom, belgi), nom tarixidan kategoriya va
  hisob, inline tugmalar (✅ Saqlash / ✏️ Kategoriya / ❌), `source = telegram`.
- [ ] **E31-T02** Karta xabarnomasi forward'i: shablonlar spravochnigi
  (E26-T01) bo'yicha regex → summa, sana, joy, karta oxirgi 4 raqami →
  hisobni moslashtirish; tanilmasa — "shablon topilmadi".
- [ ] **E31-T03** Buyruqlar: `/balans`, `/bugun`, `/hisobot [oy]`, `/til`;
  bot menyusi (`setMyCommands`).
- [ ] **E31-T04** Testlar: tahlilchi uchun jadvalli testlar (30+ real xabar
  namunasi, anonimlashtirilgan).

### E32 · Tahlillar `[admin + mobile]` — platforma qismi

- [ ] **E32-T01** `report_insights(household, month)`: kategoriya sakrashi
  (> 3 oylik o'rtachadan 30%+), obunalarni aniqlash (har oy bir xil payee
  va summa), eng katta xarajatlar, hafta kunlari bo'yicha sarf.
- [ ] **E32-T02** Admin: "Tahlillar" sahifasi + oylik hisobotga "Diqqat"
  bloki; yillik yakun ("Yil xulosasi") sahifasi.

### E34 · Limitlar v2 `[admin + mobile]` — platforma qismi

- [ ] **E34-T01** Ota-kategoriya limiti (BR-132) — `report_month` da
  subkategoriyalar yig'indisi.
- [ ] **E34-T02** Rollover (BR-134): `category_limits.rollover` → mavjud
  limit = limit + o'tgan oy qoldig'i (manfiy bo'lsa sozlamaga ko'ra);
  fixture'lar.

> **E33** (Android vidjet, chek QR) — faqat mobil.

---

## 6. Qarorlar jurnali

| Sana | Qaror | Sabab | Havola |
|---|---|---|---|
| 2026-09-18 | Backend — Supabase (Postgres) | bepul, relyatsion, RLS, auth, cron | ADR-01 |
| 2026-09-18 | Agregatlar o'qishda hisoblanadi, saqlanmaydi | drift yo'q, oddiyroq | ADR-03 |
| 2026-09-18 | Admin — SPA, Cloudflare Workers Static Assets | server kerak emas, bepul, tijoriy ruxsat | ADR-10 |
| 2026-09-18 | Reja va fakt alohida | qisman to'lov, to'langan sana | ADR-06 |
| 2026-09-18 | Shaxsiy fond — maxsus hisob, ajratma — o'tkazma | eski arifmetika + pul joylashuvi | ADR-05 |
| 2026-09-18 | Q1–Q4 javoblari: mavjud repolar, commit/push tartibi, faqat Sheets importi, faqat Android | foydalanuvchi qarori | 3-bo'lim |

## 7. Jarayon jurnali

| Sana | Vazifa | Natija |
|---|---|---|
| 2026-09-18 | E00-T01..T03 | eski loyihalar o'rganildi; BIZNES-QOIDALAR, ARXITEKTURA, PLAN, DEPLOY yozildi |
| 2026-09-18 | E00-T04 | ikkala repoda .editorconfig, .gitattributes, .gitignore, LICENSE, Makefile, README |
| 2026-09-18 | E00-T05 | CONTRIBUTING.md (ikkala repo): til, Conventional Commits + vazifa ID, migratsiya va test qoidalari |
