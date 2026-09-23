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
| A9 | GitHub repolar **public** (tekshirildi): Environments, branch himoyasi bepul; loglar/artefaktlar ochiq → zaxira shifrlangan | ADR-12, ADR-13 |

**Savollar va javoblar** (2026-09-18):

| # | Savol | Javob | Ta'siri |
|---|---|---|---|
| Q1 | Yangi kod qaysi GitHub repolarga? | ✅ mavjud `my-wallet-admin` va `my-wallet-mobil`; eski kod `legacy-v1` branchida (+ `legacy-v1-final` teg) | E00-T07 |
| Q2 | Commit/push tartibi? | ✅ har vazifa oxirida lokal commit, har epik oxirida push | 1-bo'lim |
| Q3 | Eski ma'lumot manbai? | ✅ faqat Google Sheets (Firestore v1 da real ma'lumot yo'q) | E27 (Firestore skripti kerak emas) |
| Q4 | iOS kerakmi? | ✅ hozircha yo'q — faqat Android (`flutter create --platforms=android`) | E04, E20 |

---

## 4. Yo'l xaritasi

| Bosqich | Epik | Nomi | Repo | Bog'liqlik | Holat |
|---|---|---|---|---|---|
| **M0 Poydevor** | E00 | Hujjatlar, repolar, konvensiyalar | admin + mobile | — | 🟨 (T08 🔑) |
| | E01 | Supabase backend skeleti | admin | E00 | ✅ |
| | E02 | Admin web skeleti | admin | E00 | ✅ |
| | E03 | Platforma CI/CD, zaxira, keep-alive | admin | E01, E02 | 🟨 (T08 🔑) |
| | E04 | Mobil skelet + CI | mobile | E00 | ✅ |
| **M1 Backend yadrosi** | E05 | Byudjet, a'zolar, rollar, RLS | admin | E01 | ✅ |
| | E06 | Spravochniklar sxemasi | admin | E05 | ✅ |
| | E07 | Amallar, rejalar, fond, qarz, maqsad | admin | E06 | ✅ |
| | E08 | Biznes RPC'lar | admin | E07 | ✅ |
| | E09 | Hisobotlar + golden fixtures + `contracts/` | admin | E08 | ✅ |
| | E10 | Sinxron API | admin | E07 | ✅ |
| | E11 | Rejali ishlar va bildirishnomalar | admin | E08 | ✅ |
| **M2 Mobil MVP** | E12 | Domen paketi + fixtures pariteti | mobile | E09 | ✅ |
| | E13 | Lokal baza va sinxron dvigatel | mobile | E10, E12 | ✅ |
| | E14 | Auth, onboarding, ilova qobig'i | mobile | E13 | ✅ |
| | E15 | Amallar | mobile | E14 | ✅ |
| | E16 | Xulosa (dashboard) va hisobotlar | mobile | E15 | ✅ |
| | E17 | To'lovlar (rejalar) | mobile | E15 | ✅ |
| | E18 | Hamyon: hisoblar, fond, jamg'arma, qarz, maqsad, limit | mobile | E15 | ✅ |
| | E19 | Bildirishnomalar va sozlamalar | mobile | E11, E14 | ✅ |
| | E20 | Sifat, sayqal, reliz konveyeri | mobile | E15–E19 | 🟨 (T08 🔑) |
| **M3 Admin MVP** | E21 | Auth, byudjet konteksti, layout | admin | E05, E02 | ✅ |
| | E22 | Spravochniklar | admin | E21, E06 | ✅ |
| | E23 | Amallar va rejalar | admin | E22, E08 | ✅ |
| | E24 | Hisobotlar va dashboard | admin | E23, E09 | ✅ |
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
- [x] **E00-T06** `.github/`: `pull_request_template.md`, issue shablonlari
  (bug, feature), `CODEOWNERS`, `dependabot.yml` (npm, pub, github-actions —
  haftalik, guruhlangan).
- [x] **E00-T07** GitHub remote (Q1): eski kod `legacy-v1` branchi va
  `legacy-v1-final` tegida saqlanadi, yangi `main` mavjud repolarga
  `--force-with-lease` bilan yuklanadi.
- [ ] 🔑 **E00-T08** GitHub sozlamalari (foydalanuvchi, veb-interfeys —
  `DEPLOY.md` 1-bo'lim): `main` himoyasi (PR + CI yashil), Environments
  `staging` va `production` (prod — reviewer tasdig'i), Actions'ga PR
  yaratish ruxsati (release-please).

### E01 · Supabase backend skeleti `[admin]`

> **Maqsad:** lokal Supabase Docker'da ishlaydi, migratsiya/test/tip
> generatsiyasi konveyeri tayyor. **Qoidalar:** ADR-01, ADR-02, ADR-07.
> **DoD:** `make db-reset && make db-test` yashil; tiplar generatsiya qilinadi.

- [x] **E01-T01** `supabase init`; `config.toml`: loyiha nomi, `auth.site_url`,
  redirect URL'lar (lokal admin, `mywallet://auth-callback`), JWT muddati,
  email OTP, Google provider (`env()` bilan), `db.major_version`.
  `package.json` ga `supabase` CLI (dev dependency, pinned). Dependabot'ga `npm` (`/`)
  yozuvi.
- [x] **E01-T02** Birinchi migratsiya — asoslar: kengaytmalar (`pg_trgm`,
  `pg_cron`, `pg_net`), sxemalar (`private`, `jobs`), xavfsiz standart huquqlar
  (public'dagi yangi funksiya/jadvalga anon/authenticated avtomatik huquq
  olmaydi), `private.uuid_v7()`, `private.touch_synced_row()` (advisory lock +
  `row_version` + `updated_at` — ARX 6), `private.touch_updated_at()`,
  global `private.sync_seq`. Enum tiplar — o'z jadvallari bilan (E05+).
  - Qabul: pgTAP: `uuid_v7()` versiya/variant va vaqt tartibi; `row_version`
    har UPDATE'da o'sadi; anon yangi RPC'ni chaqira olmaydi.
- [x] **E01-T03** Audit infratuzilmasi: `audit_log` jadvali + umumiy
  `private.audit()` trigger funksiyasi (eski/yangi jsonb, faqat o'zgargan
  maydonlar), indeks `(household_id, at desc)`. BR-008.
- [x] **E01-T04** Test harness: `supabase/tests/database/000_helpers.test.sql`
  (`tests.create_user`, `tests.authenticate_as`, `tests.authenticate_as_anon`,
  `tests.clear_authentication`), `900_security_invariants.test.sql` (RLS
  hamma jadvalda, security definer'da `search_path`, anon faqat `health`),
  `make db-test` → `supabase test db`.
- [x] **E01-T05** Tip generatsiyasi: `make db-types` →
  `web/src/shared/api/database.types.ts`; CI'da farq bo'lsa qulaydi.
- [x] **E01-T06** `seed.sql` skeleti (tizim spravochniklari keyingi epiklarda
  to'ldiriladi) + `make db-reset`.
- [x] **E01-T07** Migratsiya xavfsizligi: `squawk` bilan lint (`make db-lint`),
  qoidalar `docs/CONTRIBUTING.md` da.

### E02 · Admin web skeleti `[admin]`

> **Maqsad:** zamonaviy, tez, tipli SPA karkasi: dizayn tizimi, marshrutlash,
> i18n, test. **Qoidalar:** ADR-10, ADR-15. **DoD:** `pnpm build` + unit +
> e2e smoke yashil; light/dark; 3 til.

- [x] **E02-T01** `web/`: Vite + React 19 + TypeScript (strict,
  `noUncheckedIndexedAccess`), pnpm, ESLint (flat config: typescript-eslint,
  react-hooks, jsx-a11y, `boundaries` — FSD import qoidasi), Prettier,
  path aliaslar (`@/app`, `@/features`, `@/entities`, `@/shared`). Dependabot'ga
  `npm` (`/web`) yozuvi (guruhlangan: react, tanstack, dev-tools).
- [x] **E02-T02** Dizayn tizimi: Tailwind v4 + shadcn/ui (Base UI, `nova`
  preset, `@/shared/ui` ga moslangan); tokenlar: brend (indigo), `income`,
  `expense`, `warning` light/dark; Geist shrifti, `tabular-nums`; komponentlar:
  Button, Input, Select, Dialog, Sheet, DropdownMenu, Tabs, Badge, Card,
  Skeleton, Toast (sonner), Tooltip, Table, Sidebar, Command, Popover, Switch,
  Checkbox, Avatar; o'zimizniki: `MoneyText` (+ `formatMoney`, BR-001),
  `EmptyState`, `PageHeader`, `StatCard`. DataTable → E22-T01, MonthPicker →
  E24-T02 (birinchi ishlatilgan joyda — keraksiz abstraksiya yo'q).
- [x] **E02-T03** Marshrutlash: TanStack Router (fayl asosida, tipli
  search-param'lar), `_auth` va `_app` layoutlari, 404/xato sahifalari,
  lazy-loading (route-level code splitting).
- [x] **E02-T04** Ma'lumot qatlami: `shared/api/supabase.ts` (bitta klient,
  PKCE), TanStack Query (standart `staleTime`, retry siyosati, global xato
  → toast), query-key fabrikasi (`qk.transactions.list(householdId, filters)`).
- [x] **E02-T05** i18n: i18next + `uz` (asosiy), `ru`, `en` JSON; pul/sana
  formatlash (`Intl`, `1 234 567 so'm`, `Sentabr 2026`) — `shared/lib/format`
  + unit testlar.
- [x] **E02-T06** Layout (`features/app-shell`): yig'iladigan sidebar
  (mobilda drawer), topbar (⌘K palitra, til, tema), navigatsiya yagona
  manbadan (sidebar + ⌘K), tema birinchi chizishdan oldin qo'llanadi,
  kutubxonalar alohida chunk'larda. Byudjet almashtirgich → E21-T02, profil
  menyusi → E21-T04, oy tanlagich → E24-T02; menyu bo'limlari sahifalari
  tayyor bo'lganda qo'shiladi (o'lik havola yo'q).
- [x] **E02-T07** Test infratuzilmasi: Vitest + Testing Library (jsdom,
  `renderWithProviders`), Playwright (desktop + mobil) `e2e/smoke.spec.ts`
  (bosh sahifa, deep-link, 404, til, tema, ⌘K), `make web-test` / `make e2e`.
  MSW → E21-T01 (birinchi API chaqiruvi bilan).
- [x] **E02-T08** `wrangler.jsonc` (Workers Static Assets, SPA rejimi,
  `staging` env), xavfsizlik sarlavhalari `build/headers.template` → build
  paytida `dist/_headers` (CSP: inline tema skripti hash'i avtomatik; HSTS,
  X-Frame-Options, nosniff, Referrer/Permissions-Policy, `/assets/*` immutable
  kesh), env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`,
  `VITE_APP_ENV`. Tekshirildi: `wrangler dev` ustida e2e 6/6 (CSP bilan).

### E03 · Platforma CI/CD, zaxira, keep-alive `[admin]`

> **Maqsad:** har PR avtomatik tekshiriladi; `main` → staging avtomatik,
> teg → production (qo'lda tasdiq); zaxira va keep-alive ishlaydi.
> **Qoidalar:** ADR-12, ADR-13. **DoD:** bo'sh ilova staging va prod'ga
> pipeline orqali chiqdi; zaxira faylini tiklash sinovdan o'tdi.

- [x] **E03-T01** `ci.yml` (PR + push): `web` job (install → lint → typecheck →
  unit + coverage → build), `db` job (supabase start → `db reset` → `db lint` →
  squawk → pgTAP → tiplar farqi yo'qligi), `functions` job (deno fmt/lint/test),
  `e2e` job (lokal supabase + `vite preview` + Playwright; xatoda hisobot
  artefakt). Keshlar (pnpm store, Docker image'lar), `concurrency` bilan eski
  ishga tushishlarni bekor qilish, `paths` filtrlari (minutlarni tejash).
- [x] **E03-T02** `deploy.yml`: `main` push → **staging**:
  `supabase link` → `db push` → `functions deploy` → `secrets set` →
  web build (staging env) → `wrangler deploy --env
  staging` → smoke (health RPC + Playwright smoke). `v*` teg yoki qo'lda →
  **production** (Environment tasdig'i bilan) — xuddi shu qadamlar.
  Sirlar: `DEPLOY.md` 4-bo'lim.
- [x] **E03-T03** `preview.yml` (PR): web'ni staging backend bilan build →
  `wrangler versions upload --preview-alias pr-<N>` → PR'ga havola izohi.
- [x] **E03-T04** `backup.yml` (har kecha 21:00 UTC = 02:00 Toshkent):
  prod `pg_dump` (session pooler, `--no-owner`), gzip, `age` bilan shifrlash
  (ochiq kalit — repo o'zgaruvchisi), artefakt 90 kun; `scripts/restore.sh`
  (shifrni ochish → staging yoki lokalga tiklash) + `docs/DEPLOY.md` 8-bo'lim.
  - Qabul: haftalik `restore-drill` ishi zaxirani lokal Postgres'ga tiklaydi
    va qatorlar sonini tekshiradi.
- [x] **E03-T05** `keepalive.yml` (har 2 kunda): staging va prod `health`
  RPC (publishable kalit bilan), javob > 3 s yoki xato → ops Telegram
  ogohlantirishi; rejali workflow'larni 60 kunlik o'chirilishdan saqlash
  (API orqali qayta faollashtirish, commit'siz). ADR-13.
- [x] **E03-T06** Reliz: `release-please` (CHANGELOG, semver teg) —
  teg production deploy'ni ishga tushiradi.
- [x] **E03-T07** CI tezligi hisobi `docs/CI.md`: har job necha daqiqa,
  keshlar samarasi, sekin qadamlar (public repo — minutlar cheksiz, lekin
  PR kutish vaqti muhim: maqsad — `ci` < 8 daqiqa).
- [ ] 🔑 **E03-T08** Birinchi haqiqiy deploy (foydalanuvchi `DEPLOY.md` 1–9
  qadamlarini tugatgach): `DEPLOY_ENABLED=true` → staging deploy + smoke
  yashil; preview PR'da havola; `backup.yml` qo'lda ishga tushirib tiklash
  tekshiruvi yashil; `keepalive.yml` yashil; reliz PR'i yaratildi.

> **E04** (mobil skelet + CI) — `my-wallet-mobil/docs/PLAN.md`.

### E05 · Byudjet, a'zolar, rollar, RLS `[admin]`

> **Qoidalar:** BR-010..015, BR-210, BR-213, ADR-04.
> **DoD:** ro'yxatdan o'tgan foydalanuvchi avtomatik shaxsiy byudjetga ega;
> RLS testlari: begona byudjet ko'rinmaydi, rollar huquqlari aniq.

- [x] **E05-T01** Jadvallar: `profiles`, `households`, `household_members`
  (`member_role` enum), `household_invites`; FK, unique, CHECK
  (`personal_fund_day` 1–31, `timezone` mavjud zona, `base_currency` 3 harf).
- [x] **E05-T02** `private` yordamchilar: `my_household_ids()`,
  `my_writable_household_ids()`, `my_admin_household_ids()`,
  `is_platform_admin()` (`security definer`, `stable`, `search_path=''`).
- [x] **E05-T03** RLS siyosatlari (ARX 4): profil — faqat o'zi; byudjet —
  a'zolar o'qiydi, `owner/admin` tahrirlaydi; a'zolar — a'zolar ko'radi,
  `owner/admin` boshqaradi; oxirgi owner'ni o'chirish/rolini tushirish taqiq
  (trigger, BR-014).
- [x] **E05-T04** `on_auth_user_created` trigger: profil + "Shaxsiy byudjet"
  (UZS, Asia/Tashkent) + `owner` a'zolik. Standart spravochniklar E06-T08 da
  qo'shiladi. BR-010.
- [x] **E05-T05** Takliflar: `create_invite(household, role)` (8 belgili kod,
  7 kun), `accept_invite(code)` (bir martalik, muddat, allaqachon a'zo),
  `leave_household`, `transfer_ownership`. BR-012, BR-014. Qo'shimcha: `set_member_role`,
  `remove_member` (invariantlar bitta joyda — E30 UI shularni ishlatadi).
- [x] **E05-T06** `app_bootstrap()` RPC: profil, byudjetlar ro'yxati (rol
  bilan), `app_config` (min versiyalar). `app_config` va `platform_admins`
  jadvallari + RLS.
- [x] **E05-T07** pgTAP: 2 foydalanuvchi, 2 byudjet — o'qish/yozish matritsasi
  (owner/admin/member/viewer × jadval), taklif oqimi, oxirgi owner himoyasi.

### E06 · Spravochniklar sxemasi `[admin]`

> **Qoidalar:** BR-003, BR-020..026, BR-030..037, BR-080, BR-130, BR-140,
> BR-190. **DoD:** barcha spravochnik jadvallari RLS, indeks, cheklov va
> testlar bilan; yangi byudjet standart to'plamni oladi.

- [x] **E06-T01** Tizim spravochniklari: `currencies` (UZS, USD, EUR, RUB —
  `exponent`, `symbol`, `name_i18n`), `category_templates` (BR-031/032, 3
  tilda, ikon/rang, `month_shift`, `system_code`), `exchange_rates`
  (bo'sh; E29). O'qish — hamma, yozish — platforma admini.
  Qo'shimcha: `households.base_currency` → `currencies` FK, `app_bootstrap`
  valyutalarni qaytaradi (ARX 5).
- [x] **E06-T02** `accounts`: turlar enum, valyuta FK, boshlang'ich qoldiq,
  arxiv; unique(household, lower(name)) `WHERE deleted_at IS NULL`; bitta
  `personal_fund` (partial unique); fond hisobi va fond manbai himoyasi.
  BR-026 (valyuta amaldan keyin o'zgarmaydi) — `transactions` jadvali bilan
  birga, E07-T03 ga ko'chirildi.
- [x] **E06-T03** `categories`: kind (o'zgarmaydi), `parent_id` (1 daraja —
  trigger), `month_shift` (faqat income, −1..1), `system_code`, arxiv; tizim
  kategoriyasini o'chirish/arxivlash taqiq (BR-033); unique(household, kind,
  lower(name)).
- [x] **E06-T04** `recurring_rules`: kind (`expense`/`income`/`allocation`),
  summa NULL ruxsat (o'zgaruvchan), `day_of_month` 1–31, amal davri,
  `debt_id` (FK E07 da qo'shiladi), tartib.
- [x] **E06-T05** `category_limits` (unique household+category, summa > 0),
  `quick_actions` (summa > 0, tartib), `tags` (unique lower(name)).
- [x] **E06-T06** RLS: o'qish — a'zolar; yozish — `owner/admin` (BR-011;
  teg yaratish — `member` ham, BR-200). Hamma jadvalga `touch_synced_row`,
  `<jadval>_validate`, `audit` triggerlari; ustun darajasidagi grant'lar,
  klientda `DELETE` yo'q (soft delete).
- [x] **E06-T07** Indekslar: `(household_id, row_version)` har jadvalda;
  `sort_order` indeksi qo'shilmadi (6-bo'lim, qaror).
- [x] **E06-T08** Yangi byudjetga standart to'plam: `private.seed_household
  (household, locale, user)` — shablondan kategoriyalar (lokal tilda), hisoblar
  (Naqd, Karta, 👤 Shaxsiy fond), fond qoidasi (10%, naqd, 5-kun).
  `create_household_for` (signup va `create_household`) chaqiradi; audit
  jurnaliga tushmaydi; mavjud byudjetlar migratsiyada to'ldiriladi.
- [x] **E06-T09** pgTAP: har cheklov (BR ID bilan), tizim kategoriyasi
  himoyasi, rol huquqlari, standart to'plam to'liqligi (90 test) + umumiy
  invariantlar: sinxron jadvalda touch/audit triggeri va sync indeksi, soft
  delete jadvalida `DELETE` yo'q.

### E07 · Amallar, rejalar, fond, qarz, maqsad `[admin]`

> **Qoidalar:** BR-040..046, BR-050..056, BR-060..065, BR-070..077,
> BR-110..118, BR-120..123, BR-150..153, BR-201. **DoD:** har qoida pgTAP
> bilan; qaysi yo'l bilan yozilmasin (PostgREST, RPC, cron) natija bir xil.

- [x] **E07-T01** `debts`, `goals`, `months` jadvallari (+ `recurring_rules.
  debt_id` FK), RLS (yozish — `owner/admin/member`; `months` — faqat RPC),
  triggerlar, indekslar.
- [x] **E07-T02** `planned_items`: ustunlar (ARX 3.2; + `closed_at` — qo'lda
  yopish), unique `(recurring_rule_id, budget_month)` va `(household_id,
  budget_month, system_code)`, qisman indeks (to'lanmaganlar), `status` —
  `private.planned_status(item, today)` funksiyasi (BR-071; saqlanmaydi).
- [x] **E07-T03** `transactions`: ustunlar, kind CHECK'lari (income/expense —
  kategoriya majburiy; transfer — `to_account_id` majburiy, kategoriya yo'q,
  manba ≠ manzil), summa > 0, hisob va kategoriya bir byudjetdan (kompozit
  FK + `private.assert_category/assert_account`), indekslar (ARX 3.4).
  BR-026: hisob valyutasi birinchi amaldan keyin o'zgarmaydi
  (`validate_account`). `private.category_in_use` / `account_in_use` ga
  amallar va rejalar qo'shildi (BR-024, BR-036). `transaction_tags`.
  `currency` ustuni saqlanmaydi — hisobniki (qaror).
- [x] **E07-T04** Hosilalar `transactions_validate` BEFORE triggerida:
  `budget_month` (BR-040..046: income + `month_shift`, xarajat → sana oyi,
  reja bog'langan → reja oyi, `manual` ga tegilmaydi; kirishlar o'zgarmasa
  qayta hisoblanmaydi — BR-043), `amount_base` (bir valyutada = `amount`;
  aks holda `fx_rate` yoki CBU kursi — E29 dan oldinroq, oddiy), `to_amount`.
  pgTAP: 4-jadvaldagi misollar (02.10 Oylik → 2026-09 …).
- [x] **E07-T05** `transactions_after_*` statement triggerlari (transition
  tables): bog'langan reja(lar)ning `paid_amount` qayta hisobi (reja
  almashsa ikkalasi); `settled_at` planned_items triggerida chiqariladi
  (to'liq, summasiz rejaga to'lov, `closed_at`); to'lov o'chirilsa qaytadi
  (BR-071, BR-073).
- [x] **E07-T06** 👤 Fond: ajratma rejasi faqat fondga o'tkazma bilan
  to'lanadi (BR-061); `percent` rejimida oy daromadi o'zgarsa
  `planned_amount` = `round(daromad × foiz / 100 / birlik) × birlik`
  (`currencies.allocation_rounding`: so'm — 1000); sozlama o'zgarsa joriy
  va keyingi oylar (BR-060). pgTAP: 1 499 600 × 10% → 150 000.
- [x] **E07-T07** Oy qulfi: `private.assert_month_writable` — `strict_month_lock`
  bo'lsa yopilgan oyga yozuv/tahrir/o'chirish rad etiladi, aks holda o'tadi
  (ogohlantirish — klientda). BR-055, BR-150..152.
- [x] **E07-T08** Qarz ko'rinishi: `debt_balances` view (security invoker) —
  ilovadan, kutilmoqda, qolgan, qolgan oy, tugash oyi, holat (BR-112..116).
  Maqsad ko'rinishi: `goal_progress` view (qo'lda yoki hisob qoldig'i,
  BR-121..122).
- [x] **E07-T09** Hisob qoldiqlari: `account_balances` view (BR-021) — bitta
  so'rov, `UNION ALL` (chiquvchi/kiruvchi) + `GROUP BY`.
- [x] **E07-T10** Storage: `receipts` bucket (private), RLS (yo'l =
  `{household_id}/...`), `attachments`; amal o'chirilganda cheklar o'chirish
  navbatiga (undo'da qaytadi; faylni E11 tozalaydi). BR-201. Zaxiraga
  storage siyosatlari va fayllari qo'shildi (soni tekshiriladi), tiklash
  ularni qaytaradi — lokalda sinaldi.
- [x] **E07-T11** pgTAP to'plami: BR-040..046, 052, 060..063, 071..073, 110..116,
  121..122, 150..152 — 95 test (jami 247); EXPLAIN: 20k amalda oy
  so'rovlari `transactions_month_idx` dan.

### E08 · Biznes RPC'lar `[admin]`

> **Qoidalar:** BR-043, BR-073, BR-074, BR-081..085, BR-036, BR-153.
> **DoD:** har RPC idempotent yoki tranzaksion; pgTAP + `contracts/api.md`.

- [x] **E08-T01** `open_month_preview(household, month)` va
  `open_month(household, month)`: aktiv shablonlar (tartib bo'yicha, amal
  davri ichida) + fond ajratmasi (nomi — tizim kategoriyasiniki, summa —
  BR-060, 0% bo'lsa yaratilmaydi); `INSERT ... SELECT ... ON CONFLICT DO
  NOTHING`; natija `{created, skipped, items}`; `months.opened_at`.
  pgTAP: ikki marta chaqirish = takror yo'q; 31-kun fevralda 28/29.
- [x] **E08-T02** `pay_planned(item, amount, account, date, settle)`:
  BR-073 (summa standart = qolgan; noma'lum summaga yoki boshqa valyutadagi
  hisobga majburiy; to'langanga xato; kam bo'lsa `partial` yoki `settle`;
  ajratma → fondga o'tkazma). `skip_planned(item, bool)`.
- [x] **E08-T03** `bulk_pay_planned(items[], date, account)` — bitta
  statement (rejalar bir marta qayta hisoblanadi), faqat summasi aniq
  rejalar, natija `{paid, skipped:[{id, reason}]}`. BR-074.
- [x] **E08-T04** `recalc_income_months_preview(household)` (oy juftliklari
  bo'yicha: qayerdan qayerga, nechta) va `..._apply(household,
  expected_count)` (preview'dan keyin o'zgargan bo'lsa rad etadi). BR-043.
  BR-040 formulasi `private.income_budget_month` da — trigger ham shuni ishlatadi.
- [x] **E08-T05** `set_month_closed(household, month, closed)` (faqat tugagan
  oy) + `month_close_check` (to'lanmagan/noma'lum soni — BR-153).
  `merge_categories(from, to)` — subkategoriyalar, amallar, rejalar,
  shablonlar, tez tugmalar, limit ko'chiriladi; turlar va oy siljishi bir
  xil bo'lishi shart. BR-036.
- [x] **E08-T06** `onboarding_apply(household, payload)` — hisoblar (joriy
  qoldiq), daromad turlari va oy qoidalari (+ kutilayotgan daromad rejasi),
  doimiy rejalar, fond qoidasi — bitta tranzaksiyada, nomlar bo'yicha, bir
  marta (`households.onboarded_at`, `app_bootstrap` da `onboarded`).
  Eslatma sozlamasi — E11 (`notification_prefs` jadvali bilan).
- [x] **E08-T07** `contracts/api.md`: har RPC imzosi, javobi, onboarding
  payload namunasi, xato kodlari (`planned_already_paid`, `amount_required`,
  `preview_outdated`, `month_not_finished` …); `schema-version` = 1
  (qo'shimcha o'zgarishlar). Sinxron `conflict` — E10.

### E09 · Hisobotlar + golden fixtures + `contracts/` `[admin]`

> **Qoidalar:** BR-090..095, BR-100..103, BR-063..064, BR-112..114,
> BR-121, BR-130..131, BR-170..172, ADR-03. **DoD:** har hisobot bitta RPC;
> golden fixture'lar bilan kontrakt testlari yashil; `EXPLAIN` testlari.

- [x] **E09-T01** Yagona agregatsiya yadrosi: `private.budget_lines` (har amal
  → daromad / xarajat / ajratma ± / fond sarfi, karta/naqd — BR-022, BR-061/062)
  va `private.month_facts(household, from, to)` (oylar × yig'indilar + rejalar,
  `has_records`), `private.month_derived` (BR-091), `private.limit_status`.
- [x] **E09-T02** `report_month(household, month)` → bitta JSON: yig'indilar
  (BR-090), hosila (BR-091), prognoz (BR-093, kutilayotgan daromad rejalari
  bilan), kuniga sarflash (BR-094), kategoriyalar + limit holati (BR-130,
  BR-132), to'lanmaganlar (BR-076, holat bilan), fond (shu oy + qoldiq),
  jamg'arma (BR-102), qarz jami (BR-114), maqsadlar, oyning yopiqligi.
- [x] **E09-T03** `report_year`, `report_savings` (BR-100..101, ⏳ joriy oy,
  BR-092 xulosasi), `report_personal_fund`, `report_debts`, `report_goals`
  (oylik ajratma yo'q bo'lsa — o'rtacha orttirish), `report_category_trend`
  (BR-095).
- [x] **E09-T04** `health_check(household)` → `{problems[], warnings[],
  info{}}` — BR-171 ning hozir ma'lumoti bor qismi (oy ochilmagan, bog'lanmagan
  qarz + `pg_trgm` o'xshash nom, qarz rejasi kechikkan, manfiy naqd, 30+ kun,
  yopilgandan keyin tahrir, eskirgan kurs); bildirishnoma/ish/sinxron — E10, E11.
- [x] **E09-T05** Golden fixture'lar `contracts/fixtures/*.json` (+ README —
  format): eski tizimning 40 ta tasodifiy holati (o'girilgan), BR-091 misoli,
  jamg'arma jadvali (1 400 000 → 4 150 000), BR-040 jadvali, qisman to'lov,
  noma'lum summa, qarz (4 holat), maqsad (ulguradi/ulgurmaydi), prognoz
  (joriy/o'tgan, rejali/rejasiz), limit 79/80/100/101%, BR-092 invarianti.
  "Bugun" — `app.today` (faqat SQL sessiya). Avto to'lov holati — E11 bilan.
- [x] **E09-T06** Kontrakt testlari (`scripts/contract/run.mjs`, Node +
  `postgres`): fixture → haqiqiy yozuv yo'li bilan bazaga → RPC → qism
  solishtirish; har holat ROLLBACK. `make contract-test`, CI `db` job'ida.
- [x] **E09-T07** Ishlash: `scripts/gen-load.sql` (1 byudjet × 25 000 amal +
  9 shovqin byudjet) + `scripts/perf-check.sh` (`auto_explain` — ichki
  so'rovlarda Seq Scan yo'q; vaqt: `report_month` 45 ms, `report_year` 6 ms).
  Topilgan 3 muammo tuzatildi — `docs/PERF.md`. `make perf`, CI'da.
- [x] **E09-T08** `contracts/README.md` (nima, qanday versiyalanadi, mobil
  qanday oladi) + `scripts/contracts-publish.sh` (`BIZNES-QOIDALAR.md` ni
  `contracts/` ga nusxalash, `schema-version` ↔ `private.api_schema_version()`
  tekshiruvi), `make contracts-check` CI'da. *(E04-T08 uchun oldinroq
  bajarildi; fixtures — E09-T05.)*

### E10 · Sinxron API `[admin]`

> **Qoidalar:** BR-006, BR-007, ADR-07, ADR-09, ARX 6. **DoD:** pull/push
> idempotent; to'qnashuv va rad etish holatlari; parallel yozuvda kursor
> hech narsani o'tkazib yubormaydi (test).

- [x] **E10-T01** `sync_pull(household, cursor, limit)` — `UNION ALL` (har
  jadval `(household_id, row_version)` indeksi va LIMIT bilan) + `ORDER BY
  row_version LIMIT`, tombstone'lar (birinchi yuklashda — yo'q),
  `resync_required` (`households.purged_version`). Qator — to'liq JSON.
- [x] **E10-T02** `sync_push(household, device, mutations)` — ≤ 100,
  `sync_mutations` orqali idempotentlik, `base_version` tekshiruvi →
  `conflict`, har mutatsiya savepoint'da → `ok | conflict | rejected`;
  yoziladigan maydonlar = foydalanuvchining ustun grant'lari (`security
  invoker`), `household_id` almashtirish taqiq.
- [x] **E10-T03** O'chirish = soft delete barcha sinxron jadvallarda (E06
  dan beri); RLS faqat a'zolik — o'chirilganlarni ekran filtrlaydi (qaror
  `ARXITEKTURA.md` 6).
- [x] **E10-T04** Parallel test (`scripts/contract/sync-concurrency.mjs`,
  `make sync-test`, CI): bir byudjetga ikkinchi yozuv lock'ni kutadi, boshqa
  byudjet bloklanmaydi, commit qilinmagan ko'rinmaydi, kursor hech narsani
  o'tkazib yubormaydi.
- [x] **E10-T05** Tozalash: `jobs.purge()` — 90 kunlik tombstone (bolalardan
  otalarga, hali havola qilinayotgani o'tkaziladi va hisoblanadi),
  `purged_version`, audit 180 kun, sinxron jurnali 30 kun; test: eski
  kursor → `resync_required`. pg_cron — E11-T07.
- [x] **E10-T06** `contracts/api.md` — sinxron protokoli (payload, holatlar,
  klient harakati, xato kodlari, oq ro'yxat = grant'lar). `schema-version` = 1
  (qo'shimcha o'zgarish — mobil hali chiqmagan).

### E11 · Rejali ishlar va bildirishnomalar `[admin]`

> **Qoidalar:** BR-075, BR-084, BR-133, BR-160..168, BR-192, ADR-11.
> **DoD:** har ish set-based va idempotent; pgTAP (nima yuboriladi) +
> Deno testlari (qanday yuboriladi); `job_runs` da natija.

- [x] **E11-T01** `notification_prefs` (standart: push ✓, soat 9, 3 kun,
  oylik hisobot ✓ 21-kun, limit ogohlantirishi ✓; a'zolik bilan avtomatik),
  `device_tokens` (akkaunt almashsa ko'chadi), `telegram_links` +
  `telegram_link_tokens` (15 daqiqalik bir martalik), `notification_outbox`
  (dedupe unique, navbat qisman indeksi), `monthly_reports`, `job_runs` + RLS
  va ustun grant'lari; `register_device`, `telegram_link_token` RPC'lari.
- [x] **E11-T02** `jobs.daily_sweep(now)`: lokal 00:05 dan o'tgan va bugun
  ishlamagan byudjetlar — avval avto-ochish (`private.open_month_for` —
  `open_month` RPC bilan umumiy), keyin avto to'lov (`INSERT ... SELECT`,
  qolgan summa, `source = auto_pay`, rejaga bitta — unique, o'chirilgani qayta
  yaratilmaydi; boshqa valyutadagi hisob va qattiq qulfli oy — yo'q).
  pgTAP: vaqt zonasi chegarasi (Toshkent/London), takroriy ishga tushirish.
- [x] **E11-T03** `jobs.enqueue_reminders(now)` (BR-160: bo'sh bo'lsa
  yubormaydi, noma'lum summa — `null`), `jobs.enqueue_monthly_reports(now)`
  (BR-161..162, hisobotlar yadrosidan, `monthly_reports` ga saqlaydi),
  `jobs.enqueue_income_missing` (BR-165), limit ogohlantirishlari `tx_after`
  dan (BR-133, oyda har chegara uchun bir marta, `alert_80`/`alert_100`
  hisobga olinadi). Faqat yetkaziladigan manzillarga (`notification_targets`).
- [x] **E11-T04** Edge Function `notify-dispatch`: outbox'dan olish
  (`FOR UPDATE SKIP LOCKED` — `outbox_claim` RPC), FCM HTTP v1 (servis akkaunt
  RS256 JWT — WebCrypto, token keshi), Telegram `sendMessage` (HTML), email —
  hozircha `skipped` (SMTP ixtiyoriy), natija/xato (`outbox_complete`),
  eskirgan FCM tokenlarni o'chirish, 3 urinish (5/30 daqiqa).
- [x] **E11-T05** Edge Function `telegram-webhook`: secret header tekshiruvi,
  `/start <token>` → bog'lash (BR-163), `/stop`, `/balans`, `/bugun`
  (`telegram_summary`); noma'lum xabar → yordam matni; faqat shaxsiy chat.
- [x] **E11-T06** Xabar shablonlari (uz/ru/en) — `_shared/i18n.ts`: kunlik
  eslatma, oylik hisobot (BR-161 bloklari), limit, daromad kechikdi, test;
  pul formati admin/mobil bilan bir xil. 15 snapshot + 60 Deno testi.
- [x] **E11-T07** pg_cron jadvali (ARX 7, 9 ish) — `jobs.run` → `job_runs`,
  Edge Function URL va sir `vault` da (deploy yozadi); `notify_dispatch` faqat
  outbox bo'sh bo'lmasa HTTP chaqiradi; `platform_stats`. `test_notification
  (household)` — har kanal natijasi va sababi (BR-164),
  `send_monthly_report_now`.
- [x] **E11-T08** `fx-sync` Edge Function (skelet: joriy CBU kurslari →
  `fx_upsert`, qo'lda kiritilgan ustidan yozmaydi; tarix — E29) va
  `delete-account` (BR-015: a'zoliklar, yolg'iz byudjetlar, auth
  foydalanuvchisi; oxirgi owner — 409); chek fayllari — `purge-files`
  (Storage API) + `receipt_files_to_delete`, biriktirma tombstone'lari
  `jobs.purge` da. Uchidan-uchiga: `make fn-smoke` (CI, pg_cron yo'li bilan).

> **E12–E20** (mobil MVP) — `my-wallet-mobil/docs/PLAN.md`.

### E21 · Admin: auth, byudjet konteksti, layout `[admin]`

> **Qoidalar:** BR-011, BR-213, ADR-10. **DoD:** Google va email kod bilan
> kirish; rolga qarab menyu; platforma admini uchun 2FA majburiy.

- [x] **E21-T01** Kirish sahifasi: Google OAuth (PKCE redirect), email OTP
  (6 xonali kod), xatolar tarjimasi, "Qayerdan kirdim" — sessiya holati.
  MSW (Supabase Auth/REST mock'lari) komponent testlari uchun shu yerda ulanadi.
  Kirish usuli va vaqti (AMR) — profil sahifasining "Sessiyalar" bo'limida
  (E21-T04); PostgREST biznes xatolari (`P0001`) ham tarjima qilinadi.
- [x] **E21-T02** Byudjet konteksti: `app_bootstrap` → joriy byudjet
  (URL'da `?h=` emas, `/h/$householdId/...` marshrut prefiksi), almashtirgich,
  oxirgi tanlangan byudjet eslab qolinadi. Byudjeti yo'q (yoki yangisini
  qo'shmoqchi) foydalanuvchi — `/welcome` (yaratish yoki taklif kodi).
- [x] **E21-T03** Rolga asoslangan himoya: marshrut `beforeLoad` da rol
  tekshiruvi, menyu elementlari yashirinadi, `viewer` uchun faqat o'qish
  (tugmalar o'chiq), 403 sahifasi. Mexanizm: `requirePermission`,
  `navSectionsFor`, `useCan`; bo'lim sahifalari (E22+) shularni ishlatadi.
- [x] **E21-T04** 2FA (TOTP): sozlash (QR), tasdiqlash, platforma sahifalari
  AAL2 talab qiladi. Profil: ism, til, tema, sessiyadan chiqish (barcha
  qurilmalardan). 2FA yoqqan foydalanuvchi har kirishda `/mfa` da kod
  kiritadi; platforma marshrutlari `mfaGate(..., { required: true })` bilan
  (E26-T01 da ulanadi).
- [x] **E21-T05** E2E: kirish → byudjet tanlash → rolga mos menyu
  (Playwright, lokal supabase'da test foydalanuvchilar). CI e2e job lokal
  Supabase'ni ishga tushiradi; deploy smoke — `public` loyiha.

### E22 · Admin: spravochniklar `[admin]`

> **Qoidalar:** BR-020..026, BR-030..037, BR-080..083, BR-110, BR-120,
> BR-130, BR-140, BR-200. **DoD:** har spravochnik: jadval, qidiruv, forma
> (zod), yaratish/tahrirlash/arxivlash, tartiblash, bo'sh holat, testlar.

- [x] **E22-T01** Umumiy `DirectoryPage` shabloni: DataTable (saralash,
  qidiruv, ustunlarni yashirish), yon panelda forma (Sheet), optimistik
  yangilash + xatoda qaytarish, arxivlanganlarni ko'rsatish filtri,
  drag & drop tartib (dnd-kit → `sort_order` bitta so'rovda).
  TanStack Table v9, `set_sort_order` RPC, klaviatura bilan tartib va UI
  tilidagi ekran o'quvchi e'lonlari; FormSelect, AmountField, IconPicker,
  ColorPicker, ProgressBar, SectionCard.
- [x] **E22-T02** **Hisoblar**: turi (ikon), valyuta, boshlang'ich qoldiq/sana,
  joriy qoldiq ustuni (`account_balances`), arxiv; `personal_fund` o'chirilmaydi.
- [x] **E22-T03** **Kategoriyalar**: daraxt ko'rinishi (daromad / xarajat
  tablari), ikon va rang tanlagich, subkategoriya, daromad uchun "Qaysi oyga
  tegishli" (joriy / oldingi) + o'zgartirilganda **qayta joylash preview**
  (E25-T04 ga havola), birlashtirish dialogi (`merge_categories`), tizim
  kategoriyasi belgisi.
- [x] **E22-T04** **Doimiy rejalar**: turi (xarajat / daromad / fond ajratmasi),
  summa (bo'sh = "har oy o'zgaradi"), kun, avto to'lov, aktiv, qarz, amal
  davri; "Keyingi oyda nima yaratiladi" preview.
- [x] **E22-T05** **Limitlar** (kategoriya + summa + joriy oy holati ustuni),
  **Tez tugmalar** (tartib, oldindan ko'rish chipi), **Teglar**.
- [x] **E22-T06** **Qarzlar** (yo'nalish, umumiy, oldin to'langan, oylik,
  muddat; ro'yxatda qolgan/progress/tugash — `debt_balances`), **Maqsadlar**
  (hisobga bog'lash yoki qo'lda, oyiga, muddat; progress).
- [x] **E22-T07** **Byudjet sozlamalari**: nomi, asosiy valyuta, vaqt zonasi,
  👤 fond qoidasi (rejim, qiymat, hisob, kun — "joriy oy ajratmasi: X" jonli
  hisob), oy siyosati (avto-ochish, qattiq qulf), a'zolar ro'yxati va
  takliflar (E30 da kengayadi), xavfli zona (byudjetni o'chirish).
  `delete_household` RPC (faqat owner, nom bilan tasdiq); asosiy valyuta —
  faqat ko'rinadi (E29 gacha).
- [x] **E22-T08** Testlar: har forma zod sxemasi (unit), CRUD e2e (hisob,
  kategoriya, doimiy reja). + limit, tez tugma, teg, qarz, maqsad,
  sozlamalar E2E'lari (haqiqiy view/RPC qiymatlari bilan).

### E23 · Admin: amallar va rejalar `[admin]`

> **Qoidalar:** BR-040..056, BR-070..085, BR-150..153, BR-183, BR-202.
> **DoD:** katta jadvalda tez ishlash (keyset), ommaviy amallar bitta
> so'rovda, oy ochish/yopish ishlaydi.

- [x] **E23-T01** **Amallar** jadvali: keyset sahifalash (`occurred_on, id`),
  filtrlar (oy, davr, turi, kategoriya, hisob, a'zo, teg, summa oralig'i),
  qidiruv (payee/izoh, trgm), filtrlar URL'da (ulashiladigan havola),
  jami qatori (filtr bo'yicha — alohida yengil RPC).
- [x] **E23-T02** Amal formasi (Sheet): turi (xarajat / daromad / o'tkazma),
  summa, hisob(lar), kategoriya (qidiruvli), sana, **tegishli oy jonli
  ko'rsatkichi va almashtirish** (BR-045), payee avto-to'ldirish (BR-056),
  reja/qarz bog'lash, teglar, izoh, chek rasmi ko'rish. Yopilgan oy
  ogohlantirishi (BR-055).
- [x] **E23-T03** Ommaviy amallar: kategoriyani almashtirish, teg qo'shish,
  o'chirish (tasdiq bilan) — bitta RPC. CSV eksport (joriy filtr).
- [x] **E23-T04** **Rejalar** sahifasi (oy bo'yicha): bo'limlar — muddati
  o'tgan / bugun / yaqin / keyinroq / to'langan / o'tkazib yuborilgan;
  xarajat va daromad rejalari tablari; "To'landi" (summa, hisob, sana,
  qisman/yopish), "O'tkazib yuborish", ommaviy "To'landi" (BR-074),
  noma'lum summalar `?` bilan, jami: `X so'm + N ta ?`.
- [x] **E23-T05** **Oyni ochish** dialogi (preview: yaratiladigan rejalar
  ro'yxati → tasdiq), **oyni yopish/qayta ochish** (`month_close_check`
  natijasi bilan dialog, BR-153).
- [x] **E23-T06** E2E: oy ochish → reja to'lash (to'liq/qisman) → hisobotda
  aks etishi; ommaviy to'lash.

### E24 · Admin: hisobotlar va dashboard `[admin]`

> **Qoidalar:** BR-090..103, BR-112..114, BR-121, BR-130..131, BR-180.
> **DoD:** eski `Hisobot` va `Yillik` sheetlaridagi **har bir ko'rsatkich**
> admin'da bor (izchillik jadvali — BR 24-bo'lim); eksport ishlaydi.

- [x] **E24-T01** **Dashboard**: joriy oy KPI kartalari (qoldiq, prognoz,
  orttirgan %, kuniga sarflash mumkin), daromad vs xarajat (12 oy, ustun
  grafik), kategoriya donut, yaqin to'lovlar, ogohlantirishlar (limit,
  kechikkan, tekshiruv muammolari soni).
- [x] **E24-T02** **Oylik hisobot** (`report_month`): 1️⃣ daromad matritsasi
  (tur × karta/naqd + JAMI, ro'yxatdan tashqari tur ogohlantirishi),
  2️⃣ yakun (daromad, xarajat, shundan ajratma, reja, to'lanmagan, qoldiq,
  prognoz, karta, naqd, sarflandi %), 3️⃣ orttirish (shu oy, %, umumiy qoldiq,
  oyiga o'rtacha, oylar soni), 4️⃣ prognoz (o'tgan kunlar, kunlik sarf, oy
  oxiri sarfi, kutilayotgan daromad + "hozircha kelgani" izohi, oy oxiri
  qoldig'i, o'rtacha oylik xarajat), 5️⃣ kategoriya + limit (reja, fakt,
  limit, % rangli), 👤 fond, 🏦 jamg'arma, 💳 qarzlar, 🎯 maqsadlar,
  ⏳ to'lanmaganlar. Oy almashtirgich, 🔒 belgisi, chop etish (print CSS).
- [x] **E24-T03** **Yillik ko'rinish** (`report_year`): jadval + JAMI qatori
  + grafik (daromad/xarajat ustunlari, orttirgan chizig'i), yillar
  almashtirgich.
- [x] **E24-T04** **Jamg'arma** (to'planish chizig'i, oylar jadvali ⏳ bilan),
  **Shaxsiy fond** (ajratma/sarf daftari, qoldiq grafigi), **Qarzlar**
  (holatlar, progress, tugash, sof holat, bog'langan to'lovlar tarixi),
  **Maqsadlar** (progress, prognoz, ulguradimi), **Hisoblar qoldig'i**.
- [x] **E24-T05** **Kategoriya tahlili**: tanlangan davr, oyma-oy trend,
  o'tgan oy va 3 oylik o'rtacha bilan solishtirish (BR-095), subkategoriyaga
  tushish (drill-down) → amallar ro'yxati (filtr bilan).
- [x] **E24-T06** Eksport: har hisobot → CSV (XLSX o'rniga — qarorlar
  jurnaliga qarang), oylik hisobot → PDF (brauzer print). BR-180.
- [x] **E24-T07** Kesh siyosati: hisobotlar `staleTime` 60 s, amal
  yozilganda faqat tegishli oy/yil kalitlari invalidatsiya; e2e: amal
  qo'shish → hisobot yangilanadi.

### E25 · Admin: vositalar `[admin]`

> **Qoidalar:** BR-043, BR-164, BR-170..172, BR-180..183, BR-008.
> **DoD:** eski `🩺 Tekshirish`, eksport, audit, qoida o'zgarishi oqimlari
> ishlaydi; import dry-run bilan.

- [x] **E25-T01** **Tekshiruv** sahifasi (`health_check`): 3 bo'lim,
  har muammo yonida amal ("Oyni ochish", "Qarzga bog'lash" — o'xshash
  xarajatlar ro'yxatidan tanlab, "Telegram'ni ulash"), "Qayta tekshirish".
- [x] **E25-T02** **Eksport**: to'liq JSON zaxira (`export_household`),
  CSV (rejalar — davr bo'yicha; amallar — amallar sahifasida filtr bilan). BR-180.
- [x] **E25-T03** **CSV import**: fayl → ustunlarni moslashtirish (sana,
  summa, nom, kategoriya, hisob) → preview (xatolar, dublikatlar — sana +
  summa + nom) → tasdiq → bitta RPC paket. BR-182.
- [x] **E25-T04** **Daromad qoidasini qayta qo'llash**: preview jadvali
  (yozuv, turi, eski oy → yangi oy), tasdiq → `recalc_income_months_apply`.
- [x] **E25-T05** **Audit jurnali**: filtr (jadval, a'zo, davr), eski/yangi
  farqi (diff ko'rinishi), keyset sahifalash.
- [x] **E25-T06** **Bildirishnomalar**: shaxsiy sozlamalar (kanallar, soat,
  kun, oylik hisobot kuni), Telegram'ni ulash (QR + havola), "Test xabar" va
  "Oylik hisobotni hozir yuborish (oy tanlash)" — natija aniq: qayerga
  yuborildi / nega yuborilmadi (BR-164). Yuborish jurnali. Oylik hisobotlar
  arxivi (BR-167).
- [x] **E25-T07** **Qurilmalar va sinxron**: a'zolar qurilmalari (oxirgi
  sinxron, ilova versiyasi), to'qnashuv/rad etish jurnali.

### E26 · Admin: platforma (super-admin) `[admin]`

> **Qoidalar:** BR-213, BR-214, ADR-10. **DoD:** faqat `platform_admins` +
> AAL2; tizim spravochniklari va monitoring ishlaydi.

- [x] **E26-T01** Tizim spravochniklari: **valyutalar**, **kategoriya
  shablonlari** (3 tilda nom, ikon, rang, daromad qoidasi, tartib),
  **karta xabar shablonlari** (E31 uchun, hozircha CRUD).
- [x] **E26-T02** **Ilova konfiguratsiyasi**: min Android/iOS versiya
  (majburiy yangilash, BR-214), texnik ishlar banneri, feature flaglar.
- [x] **E26-T03** **E'lonlar**: barcha / tanlangan foydalanuvchilarga push
  (`admin-ops` Edge Function), jurnal.
- [x] **E26-T04** **Foydalanuvchilar va byudjetlar** (qo'llab-quvvatlash
  uchun, faqat agregat — amal tafsilotlari ko'rinmaydi): ro'yxat, ro'yxatdan
  o'tgan sana, oxirgi faollik, byudjetlar soni, bloklash.
- [x] **E26-T05** **Tizim salomatligi**: rejali ishlar (`job_runs` — oxirgi
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
| 2026-09-18 | Remote auth sozlamalari dashboard'da qo'lda; `config push` ishlatilmaydi | lokal manzillar prod'ga tushmasin | E01-T01, DEPLOY 2.4 |
| 2026-09-18 | Web: TypeScript 6.0 (7.0 emas), ESLint (oxlint emas) | typescript-eslint TS < 6.1 ni qo'llaydi; FSD chegaralari (`boundaries`) va type-aware qoidalar kerak | E02-T01 |
| 2026-09-18 | shadcn/ui — Base UI asosida; shadcn fayllari vendored (lint qisman yumshatilgan) | Base UI faol rivojlanmoqda; shadcn fayllarini qo'lda o'zgartirish yangilanishni buzadi | E02-T02 |
| 2026-09-18 | pnpm ta'minot zanjiri siyosati (minimumReleaseAge) chetlab o'tilmaydi: wrangler 4.133.0 (1 kundan eski) | yangi chiqqan paketlar xavfi | E02-T08 |
| 2026-09-18 | Byudjet ichidagi havolalar — kompozit FK `(household_id, x_id)` | boshqa byudjetga havola imkonsiz; FK tekshiruvi va o'chirish household indeksidan foydalanadi (katta jadvalda to'liq skan yo'q) | E06, ARX 3.2 |
| 2026-09-18 | Biznes tekshiruvlari `<jadval>_validate` triggerida, `_touch` (advisory lock) dan keyin | parallel yozuvlar bir byudjetda ketma-ket tekshiriladi — masalan o'chirilayotgan kategoriyaga bir vaqtda havola paydo bo'lmaydi | E06, ARX 3.3 |
| 2026-09-18 | Spravochniklarda `sort_order` indeksi yo'q | byudjetda o'nlab qator; `(household_id, row_version)` filtrga yetadi, saralash xotirada arzon — ortiqcha indeks faqat yozuvni sekinlatadi | E06-T07 |
| 2026-09-18 | Teg yaratish — `member` ham (tahrir — owner/admin) | teg amal bilan birga qo'yiladi; aks holda member teg qo'ya olmasdi | BR-200, E06-T06 |
| 2026-09-18 | Klientda `DELETE` yo'q, faqat soft delete; ustun darajasidagi grant'lar | tombstone sinxronga yetadi; tizim maydonlari (created_by, row_version, system_code, household_id) klientdan o'zgarmaydi | E06-T06 |
| 2026-09-18 | `transactions.currency` saqlanmaydi — hisobniki | BR-026 hisob valyutasini amaldan keyin muzlatadi; takror ustun nomuvofiqlik manbai bo'lardi | E07-T03 |
| 2026-09-18 | Reja summalari va `paid_amount` — asosiy valyutada (`amount_base` yig'indisi) | byudjet bir valyutada yuritiladi; boshqa valyutadagi hisobdan to'lash ham to'g'ri yig'iladi | E07-T02, T05 |
| 2026-09-18 | `paid_amount` + `settled_at` saqlanadi (ADR-03 istisnosi), `overdue`/`pending` — o'qishda | to'lanmaganlar qisman indeksi va ro'yxatlar tez; holat bugungi sanaga bog'liq qismi saqlanmaydi | E07-T02, ADR-06 |
| 2026-09-18 | Amallardan keyingi qayta hisob — statement trigger + transition tables | ommaviy yozuvda (bulk, avto to'lov, import) har reja/oy bir marta — qatorma-qator takror yo'q | E07-T05 |
| 2026-09-18 | Fondga daromad yozilmaydi; fonddan byudjetga o'tkazma — manfiy ajratma | BR-063 tengligi va BR-092 invarianti saqlanadi | BR-061, BR-063 |
| 2026-09-18 | `amount_base` uchun kurs hozirdanoq (qo'lda `fx_rate` yoki CBU jadvali), yo'q bo'lsa xato | noto'g'ri summa jimgina yozilmaydi; E29 faqat kurslarni to'ldiradi | E07-T04, BR-191 |
| 2026-09-18 | Zaxirada storage siyosatlari alohida SQL, `storage.objects` — fayllarni API orqali qayta yuklash bilan | `db dump` storage sxemasini olmaydi; dump'dagi obyekt qatori qayta yuklashni bloklardi | E07-T10, ADR-12 |
| 2026-09-18 | RPC xavfsizligi: `security invoker` + RLS (to'lash, qayta joylash, birlashtirish); `definer` faqat klient yozolmaydigan maydonlar uchun (oy ochish, yopish, onboarding) | RLS ikkinchi himoya qatlami bo'lib qoladi; definer'da rol aniq tekshiriladi | E08, ARX 5 |
| 2026-09-18 | Onboarding nomlar bo'yicha (ID emas), bir marta (`onboarded_at`) | mobil sozlash oynasi sinxrondan oldin ishlaydi; qayta yuborish xavfsiz | E08-T06 |
| 2026-09-18 | Oy siljishi farqli daromad turlarini birlashtirish taqiq | aks holda amallar jimgina boshqa oyga ko'chardi; BR-043 preview'i orqali tekislanadi | E08-T05, BR-036 |
| 2026-09-18 | Hisobotlar bitta tasnif (`budget_lines`) ustida | karta/naqd, fond va ajratma qoidalari bitta joyda — hisobotlar orasida nomuvofiqlik yo'q | E09-T01 |
| 2026-09-18 | Kontrakt testlari — Node + `postgres` (Deno emas) | Node allaqachon asboblar zanjirida; yangi runtime qo'shilmaydi | E09-T06 |
| 2026-09-18 | "Bugun" — `app.today` sessiya sozlamasi (bo'lmasa haqiqiy sana) | golden fixture'lar aniq sana bilan; PostgREST klienti uni o'rnata olmaydi | E09-T05 |
| 2026-09-18 | Qoldiq view'lari — har hisob/qarz uchun indeksli qidiruv | UNION ALL + GROUP BY view'lari join bilan chaqirilganda butun jadvalni yig'ardi (perf tekshiruvi topdi) | E09-T07, docs/PERF.md |
| 2026-09-18 | Perf tekshiruvi shovqin byudjetlar bilan | bitta byudjetda Seq Scan to'g'ri tanlov — tekshiruv ma'nosiz bo'lardi | E09-T07 |
| 2026-09-18 | `sync_push` — `security invoker`, oq ro'yxat = ustun grant'lari | RLS va huquqlar PostgREST bilan bir xil; ikkinchi ro'yxat yuritilmaydi | E10-T02 |
| 2026-09-18 | RLS'ga `deleted_at IS NULL` qo'shilmaydi | sinxron tombstone'larni, undo o'chirilganni ko'rishi kerak; ekran filtrlaydi | E10-T03 |
| 2026-09-18 | Tozalash havola qilinayotgan tombstone'ni o'tkazib yuboradi (xato bermaydi, hisoblaydi) | FK tartibi va o'chirish vaqtlari farqi — keyingi ishga tushishda o'chadi | E10-T05 |
| 2026-09-18 | Sinxron `schema-version` oshirilmadi | qo'shimcha RPC'lar (buzuvchi emas), mobil hali chiqmagan — README qoidasi | E10-T06 |
| 2026-09-18 | Navbatga faqat yetkaziladigan manzil (qurilmasi bor push, ulangan Telegram) | yetkazib bo'lmaydigan xabar jurnalni to'ldirmaydi, dispatch chaqiruvlari tejaladi | E11-T03, ADR-11 |
| 2026-09-18 | pg_cron → Edge Function: manzil va sir Vault'da, deploy yozadi; `verify_jwt = false`, har funksiya o'z himoyasi bilan | sir repoda yo'q; yangi JWT imzo kalitlari bilan platforma tekshiruvi ishlamaydi | E11-T07, ARX 7 |
| 2026-09-18 | Chek fayllari — `purge-files` (Storage API), ro'yxat SQL'da: byudjeti yo'q — darhol, o'chirilgan biriktirma — 7 kun, yozuvsiz — 1 kun | Storage'da SQL DELETE taqiqlangan; bitta mexanizm akkaunt o'chirish va undo'ni qamraydi | E11-T08, BR-201, BR-015 |
| 2026-09-18 | Avto to'lov sanasi — reja muddati; rejaga bitta (o'chirilsa qayta yaratilmaydi) | ish kechiksa ham to'g'ri sana; foydalanuvchi o'chirgan to'lov qaytib kelmaydi | E11-T02, BR-075 |
| 2026-09-18 | Deno testlari `_tests/` da, `jsr:@std` — `deno.lock` bilan | `_` bilan boshlangan papka deploy qilinmaydi; bog'liqliklar qotirilgan | E11-T06 |
| 2026-09-18 | `platform_stats` — qatorlar soni statistika bahosi (`reltuples`) | kunlik to'liq COUNT katta jadvallarni skan qilardi | E11-T07 |
| 2026-09-19 | Mobil domen: pul va nisbatlar faqat butun sonlarda, `round` — noldan uzoqqa (Postgres bilan bir xil); fond foizi — bazis punktda | double yaxlitlash chegarada serverdan farq qilardi — parite buzilardi | E12-T01, T04 |
| 2026-09-19 | Entity'lar — freezed 4 (Dart 3.13 `new`/`factory ()` sintaksisi), enum'lar server `wire` qiymati bilan | immutable, copyWith, tenglik; shartnoma qiymatlari bitta joyda | E12-T02 |
| 2026-09-19 | Amal tasnifi (`BudgetLine`, `monthFactsOf`) — domen qoidasi; fixture pariteti uchun test "ledger"i server loader'ini takrorlaydi | E13 SQL'i va hisobotlar uchun bitta namuna; 51/51 holat mos, mutatsiya testi bilan tekshirilgan | E12-T05 |
| 2026-09-19 | Use-case'lar `Result` qaytaradi (exception emas), kodlar server bilan bir xil; reja to'lovi lokal taxmin (`settlePlan`), sinxronda server qiymati | offline UI darhol to'g'ri holatni ko'rsatadi, server — hakam | E12-T06 |
| 2026-09-19 | `app_bootstrap` valyutalariga `allocation_rounding` (E14 da, qo'shimcha o'zgarish) | mobil fond ajratmasini oldindan ko'rsatishi uchun birlik kerak | E14-T02 |
| 2026-09-20 | Kirish xatida havola emas, 6 xonali kod (shablon repoda, dashboard'ga qo'lda qo'yiladi) | mobil va admin bir xil oqim; havola mobil ilovaga tushmaydi | E14-T01, DEPLOY 4 |
| 2026-09-20 | Google: har kirishda yangi nonce (Google'ga sha256, Supabase'ga xomi), "Skip nonce checks" o'chiq | token qayta ishlatilishidan himoya; sozlama DEPLOY bilan mos | E14-T01 |
| 2026-09-20 | Mobil sessiya `flutter_secure_storage` da; Android'da `allowBackup=false` | Keystore bilan shifrlangan sessiya zaxiradan boshqa qurilmaga tushmasin (lokal baza — server nusxasi) | E14-T01 |
| 2026-09-20 | `app_bootstrap` javobi lokal saqlanadi — ilova oflaynda ham ochiladi; byudjet tanlovi: saqlangan → oxirgi → birinchi | BR-007: tarmoqsiz ham ishlash; foydalanuvchi tanlovi eslanadi | E14-T02 |
| 2026-09-20 | Sozlash ustasi ro'yxatlari lokal bazadan (sinxron keltirgan nomlar), yuk nomlar bilan yuboriladi | server `onboarding_apply` nom bo'yicha topadi — til va tahrirlar bilan mos | E14-T03 |
| 2026-09-20 | `app_config.maintenance` shakli shartnomada (til bo'yicha matn + `until`) | mobil banneri va E26-T02 admin ekrani bitta shaklga tayanadi | E14-T04, E26-T02 |
| 2026-09-20 | Ilova qulfi: PIN — tuz + PBKDF2, hash Keystore xotirasida; `FLAG_SECURE` MethodChannel bilan | PIN ochiq saqlanmaydi; ilova almashtirgichda balans ko'rinmaydi (BR-211) | E14-T05 |
| 2026-09-21 | Mobil amal kiritish — domen use-case'lari orqali (lokal + outbox), teglar va cheklar shu lokal tranzaksiyada | oflaynda to'liq ishlaydi; yozuv va navbat bir-biridan ajralmaydi | E15-T02..T07 |
| 2026-09-21 | Joyida kategoriya — domen `CreateCategory` (shu nomlisi bo'lsa o'sha, BR-003) | serverdagi `categories_name_key` bilan to'qnashmaslik; ikki qurilmada takror yaratilmaydi | E15-T02 |
| 2026-09-21 | Amallar ro'yxati — tegishli oy bo'yicha (`budget_month` indeksi), sahifalash LIMIT oshishi bilan (reaktiv) | hisobotlar bilan bir xil oy ma'nosi; lokal SQLite'da indeksli SEARCH (EXPLAIN testi) | E15-T06 |
| 2026-09-21 | Cheklar: qurilmada ≤ 1 MB JPEG, `pending_uploads` navbati, har sinxron siklida push'dan oldin yuklash; `attachments` — outbox orqali | oflayn ishlash; bir xil sinxron kanal; yetim fayllarni server tozalaydi (E11-T08) | E15-T07, BR-201 |
| 2026-09-21 | Lokal sxema migratsiyalari — drift `make-migrations` snapshot + `SchemaVerifier` testi (har versiya juftligi) | sxema o'zgarishida indeks/jadval tushib qolmaydi (v2 da ushlangan) | E15-T07 |
| 2026-09-21 | Xulosa va yillik hisobot — lokal bazadan: agregatlar drift SQL'da (`budget_month` indeksi, oyiga bir necha so'rov), formulalar `wallet_domain`da; yangilanish — `tableUpdates` (sinxron ham) | tarmoqsiz ochiladi (< 300 ms), serverga yuk yo'q; ma'no `report_month`/`report_year` fixture'lari bilan qotirilgan | E16-T01, E16-T05 |
| 2026-09-21 | Oylik hisobot ulashish — PNG (360 px karta ×3), PDF emas | messenjerda qulay, qo'shimcha PDF kutubxonasi yo'q; maxfiylik rejimi hurmat qilinadi | E16-T06 |
| 2026-09-21 | Mobil reja o'zgarishlari (o'tkazish, yopish, shu oy summasi) — lokal use-case + outbox; yopilgan oyda `assert_month_writable` bilan bir xil (qat'iy qulf — taqiq, aks holda tasdiq) | oflayn ishlaydi; server rad etadigan o'zgarish navbatga tushmaydi | E17-T02 |
| 2026-09-21 | "Yaqin" to'lovlar oynasi mobil ro'yxatda — 3 kun (BR-160 standarti), E19 da a'zo sozlamasidan | eslatma va ro'yxat bir xil ma'noda | E17-T01 |
| 2026-09-21 | Mobil Hamyon hisobotlari lokal bazadan (`WalletReportLoader`), `report_savings/personal_fund/debts/goals` bilan parite; hisobot jadvallar o'zgarsa qayta hisoblanadi | tarmoqsiz, serverga yuk yo'q; bitta loader Xulosa bilan umumiy (takror kod yo'q) | E18 |
| 2026-09-21 | Hisoblar jami — valyuta bo'yicha, 👤 fond hisobisiz; fond va jamg'arma alohida kartalarda | BR-005: bitta "jami"ga qo'shilmaydi | E18-T01 |
| 2026-09-21 | Qarz/maqsad/limit yozuvlari mobil'da lokal use-case + outbox (server cheklovlari domenda takrorlangan); limit tahriri UI'da faqat owner/admin | oflayn; RLS bilan bir xil huquq, server rad etadigan yozuv navbatga tushmaydi | E18-T04..T06 |
| 2026-09-21 | Mobil FCM — Firebase Dart'dan env qiymatlari bilan (`FIREBASE_*`), `google-services.json` va Gradle plagini yo'q; sozlanmasa push o'chiq | sir/konfiguratsiya kodga yozilmaydi; dev va testlar Firebase'siz ishlaydi | E19-T01 |
| 2026-09-21 | Push bosilganda faqat `data.type` → oq ro'yxatdagi marshrut; lokal eslatma payload'i ham shu ro'yxat bilan tekshiriladi | tashqi kirish marshrut sifatida ishlatilmaydi | E19-T01 |
| 2026-09-21 | Lokal eslatmalar (BR-168): 14 kun, ≤ 30 ta, aniq-vaqt ruxsatisiz, rejalar o'zgarsa 2 s debounce | Android cheklovlari; sinxron paketi bitta qayta rejalash | E19-T02 |
| 2026-09-21 | Eksport — jadvallar `rowid` keyset bo'laklari (500) bilan faylga oqim | katta tarix xotiraga to'liq yuklanmaydi | E19-T04 |
| 2026-09-22 | Admin byudjet konteksti URL prefiksida (`/h/$householdId/...`); a'zolik keshdagi `app_bootstrap` dan, topilmasa bir marta serverdan | havola ulashilsa/yangi tabda ham to'g'ri byudjet; har sahifada qo'shimcha so'rov yo'q (bootstrap 5 daq kesh) | E21-T02 |
| 2026-09-22 | Feature'lar bir-birini import qilmaydi: almashtirgich va hisob menyusi AppShell'ga marshrutdan slot orqali beriladi | FSD chegarasi (ESLint `boundaries`) buzilmaydi | E21-T02, T04 |
| 2026-09-22 | Rol himoyasi uch qatlamda: menyu (`permission`), marshrut (`requirePermission` → 403), tugmalar (`useCan`); haqiqiy chegara — server RLS | URL'dan to'g'ridan ochish ham tushunarli 403 beradi, UI serverdan erkin emas | E21-T03 |
| 2026-09-22 | 2FA: kod kiritilmagan aal1 sessiya `/mfa` ga yo'naltiriladi; AAL sessiya JWT'sidan (tarmoqsiz) | 2FA yoqqan foydalanuvchi uchun himoya har kirishda; marshrut tekshiruvi serverga so'rovsiz | E21-T04 |
| 2026-09-22 | Web testlari: MSW (`onUnhandledRequest: 'error'`), E2E — lokal Supabase + Mailpit, foydalanuvchilar oddiy kirish yo'li bilan (secret kalitsiz); deploy smoke faqat kirmagan holat | kutilmagan so'rov yashirinmaydi; haqiqiy muhitda test foydalanuvchi yaratilmaydi | E21-T01, T05 |
| 2026-09-22 | Mobil outbox server hisoblaydigan, klient yozmaydigan maydonlarni (`planned_items.paid_amount`, `settled_at`) yubormaydi; faqat shular o'zgargan yozuv mutatsiya yaratmaydi; rad etilgan amalda bog'langan reja lokal qayta hisoblanadi | amal trigger'i reja versiyasini oshiradi — hosila yangilanishi har safar conflict bo'lardi (E2E topdi); server qiymati pull'da keladi | E20-T04 |
| 2026-09-22 | Mobil E2E — patrol, emulyatorda har kecha (`e2e.yml`, KVM), lokal Supabase `contracts.lock` commit'idan | haqiqiy UI + tarmoq + airplane mode; PR'ni sekinlashtirmaydi | E20-T04 |
| 2026-09-22 | Spravochnik tartibi — `set_sort_order` RPC (bitta so'rov, o'zgarmagan qatorlar yozilmaydi) | PostgREST upsert NOT NULL ustunlarni talab qiladi, qatorma-qator PATCH — N so'rov; ortiqcha `row_version` sinxron trafigini oshiradi | E22-T01 |
| 2026-09-22 | Admin jadvallari — TanStack Table v9 (faqat ro'yxatdan o'tkazilgan imkoniyatlar), tartib — dnd-kit (klaviatura + UI tilidagi e'lonlar) | bundle'ga faqat kerakli qism; tartiblash sichqonchasiz ham (a11y) | E22-T01 |
| 2026-09-22 | Feature'lar bir-birini import qilmaydi: boshqa spravochnik ro'yxatlari (hisob, kategoriya) marshrutda olinib props bilan beriladi | FSD chegarasi; har feature mustaqil test qilinadi | E22-T04..T07 |
| 2026-09-22 | Asosiy valyuta UI'da faqat ko'rinadi | serverda himoya yo'q, lekin `amount_base` va hisobotlar unga bog'liq — o'zgartirish ko'p valyuta (E29) bilan | E22-T07 |
| 2026-09-22 | Byudjetni o'chirish — `delete_household` (owner, nomni yozib tasdiq), ma'lumotlar kaskadda, fayllar `purge-files` bilan | BR-014; tasodifiy bosishdan himoya; storage alohida tozalanadi | E22-T07 |
| 2026-09-22 | Lokal auth cheklovlari yuqori (email 300/soat) | E2E ketma-ket ishga tushirishda 429; `config push` ishlatilmaydi — remote qiymatlari dashboard'da | E22-T08 |
| 2026-09-22 | Amallar filtri — dinamik SQL: faqat faol shartlar (o'zgarmas matn bo'laklari, qiymatlar `using`), keyset kursori doim qator taqqoslash | "(filtr yo'q yoki shart)" statik so'rovda umumiy reja indeksni tanlay olmaydi — har sahifa byudjetning barcha amallarini aylanardi | E23-T01, PERF.md |
| 2026-09-22 | `transactions_list` / `transactions_summary` — security definer + aniq a'zolik tekshiruvi (`household_id = $1` har so'rovda) | RLS ostida trgm operatorlari (leakproof emas) indeks sharti bo'lmaydi: mos kelmaydigan qidiruv 36 ms → 1 ms | E23-T01 |
| 2026-09-22 | Qidiruv (BR-202): joy+izoh ifodasi bo'yicha bitta GIN; 3+ belgida xatoga chidamli (`word_similarity` ≥ 0,5) | bitta harf xatosi (8 harfli so'zda ≈ 0,55) standart 0,6 dan o'tmasdi; ikki ustun o'rniga bitta shart | E23-T01 |
| 2026-09-22 | Ommaviy amallar — bitta RPC, har qator o'z savepoint'ida, javob `{done, skipped: [{id, reason}]}` | BR-183 (bitta so'rov); yopilgan oy yoki tur mos kelmasligi butun to'plamni bekor qilmasin — foydalanuvchi nima o'tkazilganini ko'radi | E23-T03 |
| 2026-09-22 | Amallar filtri URL'da (zod; yaroqsiz maydon tashlanadi, sahifa yiqilmaydi), sahifalar — "Yana yuklash" tugmasi | ulashiladigan havola; eski/buzilgan havola ham ochiladi; tugma klaviatura va ekran o'quvchi uchun oddiy | E23-T01 |
| 2026-09-22 | Admin amal yozuvi — `save_transaction` RPC (amal + teglar bitta tranzaksiyada, invoker) | PostgREST'da amal va teglar alohida so'rov — yarim yozuv qolishi mumkin; invoker — RLS, ustun grant'lari va trigger tekshiruvlari takrorlanmaydi | E23-T02 |
| 2026-09-22 | Formadagi tegishli oy — klientda `autoBudgetMonth` (trigger bilan bir xil tartib), yozuvda server hisoblaydi; avto tahrirda saqlangan oy yuboriladi | BR-045 jonli ko'rsatish so'rovsiz; izoh tahriri eski daromadni yangi siljishga ko'chirmasligi kerak (BR-043) | E23-T02 |
| 2026-09-22 | Joy nomi avto-to'ldirish — native `datalist` + `payee_suggestions`; faqat bo'sh kategoriya/hisob to'ldiriladi | qo'shimcha kutubxonasiz, klaviatura/ekran o'quvchi brauzerniki; foydalanuvchi tanlovi ustiga yozilmaydi | E23-T02, BR-056 |
| 2026-09-22 | Bog'lash uchun rejalar — shu va oldingi oy | o'tgan oy rejasi keyingi oy boshida to'lanadi (BR-044) — faqat joriy oy ro'yxati asosiy holatni yo'qotardi | E23-T02 |
| 2026-09-22 | CSV eksport — klientda: filtr bo'yicha keyset sahifalar 1000 tadan (PostgREST `max_rows`), sarlavhalar UI tilida, formula boshlanishi `'` bilan zararsizlanadi | server CSV'si sarlavha tilini bilmaydi; 1000 dan katta javob jimgina kesiladi; foydalanuvchi matni (joy, izoh) Excel'da formula bo'lib ishlamasin | E23-T03 |
| 2026-09-22 | Ommaviy natijada o'tkazib yuborilgan amallar tanlangan qoladi, sabablar soni bilan toast'da; tanlov filtrga bog'langan | qaysi qator nima uchun o'tmagani darhol ko'rinadi; filtr o'zgarganda ko'rinmaydigan qatorlar ustida tasodifiy amal bo'lmaydi | E23-T03 |
| 2026-09-22 | Admin rejalar: holat va bo'limlar klientda — `private.planned_status` tartibi, mobil `PlanBoard` bilan bir xil (yaqin — 3 kun), `planned-item` entity'si | holat saqlanmaydi (BR-071, bugungi sana); ikki klientda bir xil ko'rinish; so'rov — bitta oy rejalari | E23-T04 |
| 2026-09-22 | "To'landi" formasida summa doim yuboriladi (standart — qolgani, hisob asosiy valyutada bo'lsa); qisman to'lovda "Yopish" tanlovi faqat qoldiq ma'lum va bir valyutada | foydalanuvchi ko'rgan summa aynan yoziladi; boshqa valyutadagi summani qoldiq bilan solishtirib bo'lmaydi | E23-T04, BR-073 |
| 2026-09-23 | Oy dialoglari tekshiruvlari (ochish preview'i, yopish tekshiruvi) — oy holati keshidan alohida kalitda | ochish/yopishdan keyin oy holati invalidatsiya qilinadi; bir kalitda bo'lsa yopilgan dialogning so'rovi ham qayta ketardi | E23-T05 |
| 2026-09-23 | Grafiklar — o'z SVG kitimiz (ustun, gorizontal ustun, chiziq), kutubxonasiz | kerakli shakllar oddiy; Recharts ≈ 100 KB gz bo'lardi, jadval ko'rinishi va mavzu tokenlari baribir qo'lda bo'lardi | E24-T01 |
| 2026-09-23 | Grafik ranglari — tekshirilgan 8 ta kategorik palitra (`--chart-1..8`); daromad/xarajat grafikda ko'k/to'q sariq, matnda esa yashil/qizil qoladi | yashil-qizil juftligi rang ko'rmaslikda ajralmaydi (ΔE 5,9 yorug'/2,9 qorong'i — talab ≥ 8); matnda ishora bor (+/−), grafikda esa faqat rang | E24-T01 |
| 2026-09-23 | Ulush uchun donut emas — gorizontal ustunlar (bitta rang), har grafikda jadval ko'rinishi | uzun kategoriya nomlari bilan donut yomon o'qiladi; rang yolg'iz belgilovchi bo'lmasligi kerak (ekran o'quvchi, bosib chiqarish) | E24-T01 |
| 2026-09-23 | Hisobot javoblari zod bilan tekshiriladi (`plan_ratio`, `per_day_available` — null, `income_pending` — mantiqiy) | uchala maydon hujjatda tип bilan ko'rsatilmagan edi; tekshiruv ularni sahifa buzilishidan oldin topdi | E24-T01 |
| 2026-09-23 | Eksport — CSV (BOM bilan, Excel ochadi) va PDF — brauzer print orqali; XLSX (SheetJS) qo'shilmadi | npm'dagi `xlsx` eski (CVE-2023-30533), yangilari faqat sotuvchi CDN'idan keladi — ochiq repoda ta'minot zanjiri xavfi; CSV hamma hisobotda bir xil kod bilan ishlaydi | E24-T06, BR-180 |
| 2026-09-23 | Pul harakatidan keyin faqat pulga bog'liq keshlar eskiradi (amal, reja, oy, hisob, hisobot, limit, qarz, maqsad); kalit bo'laklari `shared/api/query-keys` da | avval butun byudjet prefiksi eskirardi — spravochniklar (kategoriya, teg, a'zo) ham qayta so'ralardi; feature'lar bir-birining kalitini import qila olmaydi | E24-T07 |
| 2026-09-23 | Import — bitta RPC ikki rejimda (`p_dry_run`): tekshiruv ham, yozuv ham bir xil yo'ldan o'tadi; hisob va kategoriya nomi bo'yicha (registrsiz), dublikat — sana + summa + joy | preview ko'rsatgani aynan yoziladi (ikkinchi, boshqacha tekshiruv kodi yo'q); bank ko'chirmasida ID yo'q, faqat nom; qator xatosi butun paketni to'xtatmaydi | E25-T03, BR-182 |
| 2026-09-23 | Qayta joylash sahifasi (E25-T04) — kategoriyalar feature'ida, yangi `recalc_income_months_rows` RPC bilan; kategoriya formasidagi dialog jamlangan preview bilan qoladi | sahifa ham, dialog ham bitta API modulidan foydalanadi (feature'lar bir-birini import qila olmaydi); dialog darhol taklif qiladi, sahifa esa har yozuvni ko'rsatadi — dialogga qo'shimcha ustunlar yuklash shart emas | E25-T04, BR-043 |
| 2026-09-23 | Audit jurnali — `audit_list` RPC (tipli filtr parametrlari, keyset `(at, id)`), farq klientda hisoblanadi: texnik maydonlar (`id`, `household_id`, `created_*`, `row_version`) yashiriladi | filtr va sahifalash serverda — 180 kunlik jurnal to'liq yuklanmaydi (`audit_log_household_at_idx`); farq — sof funksiya, testi arzon; ustun nomlari xom ko'rsatiladi (15 jadval uchun tarjima ortiqcha) | E25-T05, BR-008 |
| 2026-09-23 | Telegram bot nomi — build vaqtidagi `VITE_TELEGRAM_BOT` (mobildagi `TELEGRAM_BOT_USERNAME` kabi), QR — `uqr` (0 bog'liqlik, MIT) bitta `<path>` bo'lib chiziladi | bot nomi sir emas, lekin muhitga bog'liq (staging/production botlari boshqa); bo'sh bo'lsa bo'lim "sozlanmagan" deydi; QR kodini qo'lda yozish (Reed-Solomon) ortiqcha, kutubxona 79 KB va bog'liqliksiz | E25-T06, BR-163 |
| 2026-09-23 | Qurilmalar — `household_devices` RPC (security definer, tokensiz), to'qnashuv jurnali esa PostgREST'dan: faqat `result->>code` olinadi, keyset `(applied_at, mutation_id)` | `device_tokens` RLS'da o'ziniki (token shaxsiy), admin esa a'zolar qurilmalarini ko'rishi kerak; to'qnashuvdagi `result.row` butun qator — ro'yxatga tortilmaydi | E25-T07 |
| 2026-09-23 | Platforma bo'limi — alohida marshrut (`/platform`) va o'z karkasi; kirish 2FA (aal2) talab qiladi va bootstrap qayta so'raladi; karta shablonlari faqat platforma adminiga ko'rinadi | byudjet menyusi byudjetga bog'liq (`$householdId`), platforma esa undan tashqarida; `is_platform_admin` aal2'siz `false` qaytadi — eski keshdan 403 bo'lmasligi uchun; naqshlar klientga kerak emas (bot service kalit bilan o'qiydi) | E26-T01, BR-213, BR-222 |
| 2026-09-23 | `app_config` qiymatlari shakli bazada tekshiriladi (CHECK: versiya `X.Y.Z`, texnik ishlar xabari uch tilda); yozish — platforma admini siyosati, grant'lar aniq ro'yxatga keltirildi | konfiguratsiya hamma klientga `app_bootstrap` orqali boradi — noto'g'ri qiymat mobil ilovani to'xtatib qo'yishi mumkin; iOS kaliti qo'shilmadi (loyihada iOS yo'q) | E26-T02, BR-214 |
| 2026-09-23 | E'lon — `admin-ops` Edge Function o'rniga RPC (`send_announcement`): navbat baribir outbox, yuborishni `notify-dispatch` qiladi; bloklash — `auth.users.banned_until` (o'chirish emas) | yangi funksiya = yangi deploy, sir va monitoring; RPC pgTAP bilan qoplanadi; bloklangan foydalanuvchi ma'lumoti saqlanib qoladi (qo'llab-quvvatlash uchun) | E26-T03, E26-T04, BR-213 |
| 2026-09-23 | Tizim salomatligi — mavjud `jobs.platform_stats()` ustiga bitta RPC (`platform_health`); keep-alive/zaxira holati GitHub API'dan olinmadi | statistikani kunlik cron allaqachon hisoblaydi, sahifa jonli chaqiradi — ikkinchi hisob-kitob yo'q; GitHub API brauzerdan token talab qiladi (ochiq repoda sir bo'lmaydi) — holat Actions'da ko'rinadi | E26-T05 |
| 2026-09-19 | Mobil lokal baza — server jadvallarining nusxasi: ustunlar va snake_case JSON bir xil, lokal FK yo'q, indekslar `EXPLAIN QUERY PLAN` bilan (`SEARCH`) | pull qatori mappersiz yoziladi; FK pull tartibiga bog'lanmaydi; oy/ro'yxat so'rovlari indeksdan | E13-T01 |
| 2026-09-19 | Oy yig'indisi lokalda SQL'da (bitta GROUP BY), ro'yxat — keyset (50 tadan) | butun tarixni xotiraga yuklamaslik; domen bilan parite testi (52/52) SQL'ni himoya qiladi | E13-T02 |
| 2026-09-19 | Outbox: qatorga bitta kutilayotgan mutatsiya (birlashtiriladi, birinchi `base_version`), yuborilayotganiga tegilmaydi; `base_row` — rad etilganda qaytarish | kamroq push va server yozuvi; javob yo'qolsa ham o'zgarish yo'qolmaydi; rollback serverga so'rovsiz | E13-T04, T05, BR-006 |
| 2026-09-19 | Sinxron: bir vaqtda bitta sikl, yozuv debounce 1 s, oflaynda 1→300 s backoff, fon — WorkManager 6 soat | server va batareya yuklamasi cheklangan; tarmoq qaytishi darhol sinxronlaydi | E13-T05, T06 |
| 2026-09-19 | Pull upsert — `toCompanion(false)` (drift data-class emas) | data-class insert NULL maydonni tashlab yuboradi — tiklangan tombstone qaytmasdi (integratsiya testi topdi) | E13-T07 |
| 2026-09-19 | Mobil integratsiya testlari host'da (`integration/`, emulyatorsiz), server `contracts.lock` commit'idan | CI arzon va tez; mobil tekshirgan shartnoma bilan bir xil server | E13-T07 |

## 7. Jarayon jurnali

| Sana | Vazifa | Natija |
|---|---|---|
| 2026-09-18 | E00-T01..T03 | eski loyihalar o'rganildi; BIZNES-QOIDALAR, ARXITEKTURA, PLAN, DEPLOY yozildi |
| 2026-09-18 | E00-T04 | ikkala repoda .editorconfig, .gitattributes, .gitignore, LICENSE, Makefile, README |
| 2026-09-18 | E00-T05 | CONTRIBUTING.md (ikkala repo): til, Conventional Commits + vazifa ID, migratsiya va test qoidalari |
| 2026-09-18 | E00-T06 | PR shabloni, issue shablonlari (bug/taklif), CODEOWNERS, dependabot (github-actions) |
| 2026-09-18 | E00-T07 | eski kod `legacy-v1` + `legacy-v1-final` tegida; yangi `main` ikkala repoga yuklandi; repolar public ekani aniqlandi (ADR-13, A9) |
| 2026-09-18 | E01-T01..T07 | lokal Supabase (Docker, PG 17), foundation + audit migratsiyalari, pgTAP harness (21 test), squawk + db lint, TS tiplar; topilgan xavfsizlik bo'shlig'i: PUBLIC EXECUTE global standarti yopildi |
| 2026-09-18 | E04-T01 | Flutter (Android), `uz.mywallet.app`, pub workspace + `wallet_domain`, very_good_analysis 11 (Dart 3.13 `new(...)` konstruktor sintaksisi), debug APK build ✅ |
| 2026-09-18 | E02-T01 | Vite 8 + React 19 + TS 6 (strict, noUncheckedIndexedAccess), ESLint 10 (strictTypeChecked, jsx-a11y, react-hooks, FSD `boundaries` — tekshirildi), Prettier, `make web-lint` |
| 2026-09-18 | E02-T02 | Tailwind v4 + shadcn (Base UI), brend/semantik tokenlar, 20+ komponent, MoneyText/EmptyState/PageHeader/StatCard; build ✅ |
| 2026-09-18 | E02-T03 | TanStack Router (fayl asosida, autoCodeSplitting, `tsr generate` tsc'dan oldin), `_auth`/`_app` layoutlari, 404 va xato sahifalari; preview deep-link ✅ |
| 2026-09-18 | E02-T04 | Supabase klienti (PKCE, tipli), env zod bilan tekshiriladi, QueryClient (staleTime 30 s, retry siyosati, global xato → toast), query-key fabrikasi, router konteksti, `make web-env` |
| 2026-09-18 | E02-T05 | i18next (uz/ru/en, tipli kalitlar, til `localStorage` da), `formatMoney` (BR-001) va oy yordamchilari (BR-002, BR-040) + 10 Vitest testi; mavjud matnlar tarjimaga ko'chirildi |
| 2026-09-18 | E02-T06 | app-shell: Sidebar (Base UI), topbar, ⌘K, tema (next-themes + index.html skripti), til menyusi; vendor chunk'lar (eng kattasi 228 KB) |
| 2026-09-18 | E02-T07 | 18 unit/komponent testi (Vitest + RTL), Playwright e2e 11/11 (3 marta barqaror); topilgan UX kamchiligi: ⌘K da til nomlari lotincha topilmasdi → kalit so'zlar |
| 2026-09-18 | E02-T08 | wrangler (Static Assets, SPA), CSP hash plagini, xavfsizlik sarlavhalari; e2e `wrangler dev` ustida ✅. **E02 yakunlandi** |
| 2026-09-18 | E03-T01..T07 | CI GitHub'da yashil (~2 daq); deploy/preview/release/backup/keep-alive workflow'lari (DEPLOY_ENABLED bilan yoqiladi); `health()` RPC; zaxira → tiklash → solishtirish lokalda tasdiqlandi (ijobiy va salbiy holat); action'lar SHA bilan pin |
| 2026-09-18 | E09-T08 | contracts/ (README, api.md, schema-version, BIZNES-QOIDALAR nusxasi) + publish/check skripti — mobil E04-T08 uchun oldinroq |
| 2026-09-18 | E05-T01..T07 | tenancy: 6 jadval + RLS (initPlan pattern), signup triggeri (profil + shaxsiy byudjet), 8 RPC (takliflar, egalik, rollar, bootstrap), oxirgi owner himoyasi; 33 pgTAP testi birinchi urinishda yashil; contracts/api.md kengaytirildi. **E05 yakunlandi** |
| 2026-09-18 | E06-T01..T09 | 9 jadval (3 tizim + 6 byudjet spravochnigi), kompozit FK, validate triggerlari (tizim yozuvlari, ishlatilayotganni o'chirish, subkategoriya darajasi, fond manbai), ustun grant'lari, standart to'plam (18 kategoriya, 3 hisob, fond qoidasi) uz/ru/en; 90 yangi pgTAP + 4 invariant (jami 152); EXPLAIN: himoya so'rovlari household indeksidan. **E06 yakunlandi** |
| 2026-09-18 | E07-T01..T11 | 8 jadval + 3 view + bucket: qarz/maqsad/oy, rejalar (holat funksiyasi), amallar (tegishli oy, asosiy valyuta, o'tkazma, fond qoidalari), statement triggerlar (to'lov, fond ajratmasi 1 499 600 × 10% → 150 000), oy qulfi, cheklar + zaxira/tiklash (storage siyosatlari va fayllar, lokalda sinaldi); 95 pgTAP (jami 247); 20k amalda EXPLAIN. **E07 yakunlandi** |
| 2026-09-18 | E08-T01..T07 | 11 RPC: oy ochish (preview, idempotent, fond rejasi), to'lash/o'tkazib yuborish/ommaviy (bitta statement), qayta joylash (preview → apply, BR-040 yagona funksiyada), oyni yopish + tekshiruv, kategoriyalarni birlashtirish, onboarding (nomlar bo'yicha, bir marta); 56 pgTAP (jami 303); contracts/api.md. **E08 yakunlandi** |
| 2026-09-18 | E09-T01..T07 | 8 hisobot RPC (bitta tasnif yadrosi), health_check; 51 golden fixture (40 tasi eski tizimdan — birinchi urinishda aynan mos) + Node kontrakt runner; perf: 25k amal + shovqin, auto_explain — 3 muammo topildi va tuzatildi (health_check 219 → 23 ms); 18 pgTAP (jami 321). **E09 yakunlandi** |
| 2026-09-18 | E10-T01..T06 | sync_pull (14 jadval, indeks + LIMIT), sync_push (idempotent, conflict/rejected, grant'lar = oq ro'yxat), sync_mutations jurnali, jobs.purge (tombstone/audit/jurnal); parallel test (6 xossa) CI'da; 29 pgTAP (jami 350). **E10 yakunlandi** |
| 2026-09-18 | E11-T01..T08 | 7 jadval, 9 pg_cron ishi (`job_runs`), outbox (dedupe, SKIP LOCKED, qayta urinish), 5 Edge Function (FCM v1, Telegram bot, CBU, fayllar, akkaunt o'chirish), uz/ru/en shablonlar; 71 pgTAP (jami 421), 60 Deno testi, uchidan-uchiga 13 tekshiruv (pg_cron → Vault → pg_net → Edge Function); testlar 2 xatoni topdi (limit sozlamalari, chek fayli muddati). **E11 yakunlandi — M1 (platforma yadrosi) tayyor** |
| 2026-09-19 | E12-T01..T06 | mobil `wallet_domain`: value object'lar, 12 entity (freezed), 14 qoida moduli (tegishli oy, reja holati, fond, eslatma, amal tasnifi, oylik yakun, prognoz, jamg'arma, qarz, maqsad, limit), 9 use-case + repository interfeyslari; golden fixture pariteti **51/51** (40 tasi eski tizimdan) — mutatsiya testi bilan; 191 test, domen qoplamasi 100%. **E12 yakunlandi** |
| 2026-09-19 | E13-T01..T07 | mobil lokal baza (drift, 14 jadval + outbox/kursor/muammolar), `LedgerDao` (oy yig'indisi SQL'da — domen bilan parite 52/52; yangi fixture: fonddan qaytish va byudjet hisoblari o'tkazmasi), `RemoteApi`, atomar repository'lar, `SyncEngine`/`SyncScheduler`, WorkManager, holat nishoni va ekrani; 155 test (92,5%), domen 192 (97,7%); lokal Supabase bilan 4 integratsiya testi (`integration.yml`) — drift upsert NULL xatosini topdi. **E13 yakunlandi** |
| 2026-09-20 | E14-T01..T06 | mobil kirish (email kodi — xat shabloni serverda, Google + nonce), byudjet yuklash/tanlash, taklif kodi (QR va deep link), sozlash ustasi (`onboarding_apply` + joriy oy), ilova qobig'i (almashtirgich, oflayn va texnik ishlar bannerlari, BR-214 majburiy yangilash), ilova qulfi (PIN/PBKDF2, biometrika, avto-qulf, FLAG_SECURE) va maxfiylik rejimi; 221 test (92,6%) + 8 integratsiya (uchidan-uchiga birinchi ochilish). Topilgan xatolar: sozlash oynasida sinxron ishlamasdi, qulf/`/join` dan chiqib bo'lmasdi, sozlamalar kech o'qilsa holatni bosardi. **E14 yakunlandi** |
| 2026-09-21 | E15-T01..T08 | mobil amallar: "Qo'shish" varag'i (klaviatura `000`/`+ −`, tez tugmalar + 5 s undo, kategoriya to'ri va joyida yangi kategoriya, hisob/sana/joy/teg/qarz, tegishli oy izohi va tanlovi — BR-045, 👤 fond izohlari — BR-061..063, cheklar — siqish, oflayn navbat, Storage), amallar ro'yxati (oy, kunlik jami, filtr, qidiruv, swipe-o'chirish + undo, tahrirlash, yopilgan oy tasdig'i); 264 test (90,9%), goldenlar, 9 integratsiya (haqiqiy Storage). Topilgan xatolar: nom dialogi controller'i erta dispose, migratsiyada indeks yo'qligi. **E15 yakunlandi** |
| 2026-09-21 | E16-T01..T07 | mobil Xulosa lokal bazadan: `MonthReportLoader` + `ReportDao` (kategoriya qatorlari server qoidasi bilan — rejasi/fakti/limiti bor, subkategoriyalar bilan), `report_month` pariteti 49/49 va `report_year` jami; hero (qoldiq, prognoz, kuniga, orttirgan %), statistika → filtrlangan amallar, rejalar, yaqin to'lovlar (To'landi), prognoz, kategoriyalar (limit rangi), daromad turlari, fond/jamg'arma, qarz, maqsadlar, oyni ochish; yillik ko'rinish + kategoriya trendi; PNG ulashish; bo'sh oy holati; 328 test (89,1%), goldenlar. Topilgan xatolar: `by_category` server bilan farqi (nol qatorlar, limitli qatorlar), 360 px da toshib ketishlar. **E16 yakunlandi** |
| 2026-09-21 | E17-T01..T06 | mobil To'lovlar: xarajat/daromad tablari, holat bo'limlari va `X + N ta ?` jami (domen `PlanBoard`), to'lash varag'i (qolgan summa, summasizda majburiy), qisman → keyin/yopish (BR-073), swipe, shu oy summasi (BR-083), yopish/qayta ochish, o'tkazish + undo, kalendar, oyni ochish preview'i (BR-081, oflayn xabar); domen `ClosePlan`/`EditPlan`; 341 test (91,4%), domen 203 (97,8%). **E17 yakunlandi** |
| 2026-09-21 | E18-T01..T07 | mobil Hamyon: hisoblar (fondsiz jami, manfiy naqd), 👤 fond (jonli ajratma, oylar), 🏦 jamg'arma (chiziq, jadval, ⏳), 💳 qarzlar (jamlar, 4 holat, tafsilot, forma, arxiv), 🎯 maqsadlar (prognoz, ulguradimi, tabrik), 📊 limitlar (rol bo'yicha); 4 hisobot pariteti 5/5; domen qarz/maqsad/limit use-case'lari; 365 test (92,0%), domen 212. Topilgan xatolar: qo'shish varag'i tanlovi hisoblar yuklanganda tushib qolishi, tor ekranda 2 ta toshib ketish. **E18 yakunlandi** |
| 2026-09-21 | E19-T01..T05 | mobil bildirishnomalar va sozlamalar: FCM (register/unregister_device, bosilganda ekran, ochiq paytidagi push), lokal eslatmalar, onboarding'da ruxsat, `notification_prefs` sozlamalari (Telegram ulash, sinov xabari), Sozlamalar (tema, til, eksport, `delete-account` ikki bosqichli), 386 test (90,0%), 9 integratsiya, dev APK. E18 integratsiya CI xatosi — sekin CI'da sinxron dashboard'dan keyin kelishi; test shartga asoslangan kutishga o'tkazildi. **E19 yakunlandi** |
| 2026-09-22 | E21-T01..T05 | admin: kirish (email kodi, Google PKCE, xatolar tarjimasi), `/h/$householdId` konteksti, almashtirgich (oxirgi byudjet eslab qolinadi), `/welcome` (yaratish/taklif kodi), rol himoyasi (menyu, 403, viewer belgisi), 2FA (QR, `/mfa`), profil (ism, til, mavzu, sessiyalar, hamma qurilmadan chiqish); 60 Vitest (MSW) + 25 Playwright (lokal Supabase, TOTP generatori bilan to'liq 2FA oqimi). Topilgan xatolar: login xatolari ikki marta (toast + forma), Mailpit'dan eski kod olinishi, AMR tartibi, brauzer ICU'sida uz sana formati. **E21 yakunlandi** |
| 2026-09-22 | E20-T02, T04 | mobil: E2E (patrol) emulyatorda yashil, nightly workflow; E2E topgan sinxron xatosi (reja to'lovi → conflict) tuzatildi + integratsiya testlari; sovuq start ~1,5 s (emulyator, `docs/PERF.md` — parallel init yutuq bermadi, halol qayd); chek rasmlari keshi. E20-T08 🔑 (keystore, testerlar) |
| 2026-09-22 | E22-T01..T08 | admin spravochniklar: DirectoryPage shabloni (DataTable v9, Sheet forma, optimistik arxiv/o'chirish/tartib, klaviatura bilan dnd), hisoblar (joriy qoldiq), kategoriyalar (daraxt, oy siljishi + qayta joylash, birlashtirish), doimiy rejalar (keyingi oy preview), limitlar (joriy oy holati), tez tugmalar, teglar, qarzlar (debt_balances, jami), maqsadlar (prognoz), byudjet sozlamalari (fond jonli preview, a'zolar, takliflar, o'chirish); 2 RPC (`set_sort_order`, `delete_household`), 15 pgTAP (jami 437); 170 Vitest (MSW) + 50 Playwright (lokal Supabase). Topilgan xatolar: optimistik tartibda daraxt sakrashi, o'chirish tasdig'i xatoda ochiq qolishi, sidebar'da eski byudjet nomi, disabled register bilan bekor bo'lishi, dnd e'lonlari inglizcha. **E22 yakunlandi** |
| 2026-09-23 | E23-T01..T06 | admin amallar va rejalar: amallar jadvali (dinamik SQL filtri, keyset, jami, xatoga chidamli qidiruv — mos kelmaydigan qidiruv 36 → 1 ms), amal formasi (tegishli oy jonli, joy nomi tarixdan, reja/qarz/teg/chek, save_transaction — amal va teglar bitta tranzaksiyada), ommaviy amallar va CSV eksport, rejalar sahifasi (bo'limlar, To'landi/Keldi, qisman to'lov, ommaviy to'lash), oyni ochish/yopish/qayta ochish; 4 RPC + 2 ta yangi pgTAP fayl (jami 475), 228 Vitest, 60 Playwright, make perf'da 5 ta yangi o'lchov. Topilgan xatolar: RLS ostida trgm indeksi ishlamasligi, qidiruvda so'z oxiridagi probelning o'chib ketishi, o'tkazmaga kategoriya (CHECK o'rniga tushunarli sabab), BR-043 ni buzuvchi qayta hisoblash. **E23 yakunlandi** |
| 2026-09-23 | E24-T01..T07 | admin hisobotlar: xulosa (KPI, 12 oylik grafik, kategoriyalar, yaqin to'lovlar, ogohlantirishlar), oylik hisobot (yakun, daromad matritsasi, prognoz, limitlar, fond/qarz/maqsad/to'lanmaganlar, print), yillik ko'rinish, jamg'arma + 👤 fond + hisob qoldiqlari, qarz va maqsadlar, kategoriya tahlili (BR-095), CSV eksport va kesh siyosati; o'z SVG grafik kiti (ustun/chiziq/gorizontal) va tekshirilgan 8 rangli palitra. 266 Vitest, 66 Playwright. Topilgan xatolar: `income_pending` mantiqiy (hujjatda son deb tushunilardi), `plan_ratio` va `per_day_available` null bo'lishi, kam oyda ustunlar cho'zilib ketishi, yuklanayotganda sarlavha yo'qolishi. **E24 yakunlandi** |
| 2026-09-23 | E25-T01..T07 | admin vositalari: tekshiruv (health_check, amal havolalari, qarzga bog'lash), eksport (to'liq JSON zaxira + rejalar CSV), CSV import (ustunlarni moslashtirish → tekshiruv → bitta paket, BR-182), daromad oyini qayta qo'llash (yozuvlar ro'yxati bilan), audit jurnali (filtr, farq, keyset), bildirishnomalar (kanallar, Telegram QR+havola, sinov va "hozir yuborish" natijasi, jurnal va oylik hisobotlar arxivi), qurilmalar va sinxron jurnali. 6 yangi RPC + 4 pgTAP fayl (jami 508), 303 Vitest, 72 Playwright; make perf'da audit sahifalari (1–2 ms). Topilgan xatolar: import'da enum cast, RFC 4180 tahlilida noto'g'ri bo'shliq, Base UI switch'da `disabled` atributi yo'qligi, `void` RPC javobining bo'shligi. **E25 yakunlandi** |
