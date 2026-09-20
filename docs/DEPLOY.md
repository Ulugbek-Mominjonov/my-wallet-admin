# My Wallet — deploy sozlamalarini tayyorlash yo'riqnomasi

> Bu yo'riqnoma **siz (egasi) bir marta bajaradigan** ishlarni qadamma-qadam
> beradi: akkauntlar, loyihalar, kalitlar va GitHub sirlari. Kod
> tayyorlanishi bilan parallel qilish mumkin — reja vazifalaridagi 🔑 belgisi
> shu yerdagi qadamga ishora qiladi.
>
> **Hammasi bepul, bank kartasi talab qilinmaydi.** Ixtiyoriy pullik narsalar
> alohida belgilangan (💲).
>
> Mobil ilovaning build/reliz sozlamalari: `my-wallet-mobil/docs/DEPLOY.md`.

---

## 0. Umumiy ko'rinish

| # | Xizmat | Nima uchun | Tarif | Taxminiy vaqt |
|---|---|---|---|---|
| 1 | GitHub | kod, CI/CD, zaxira, keep-alive | Free (public repo: minutlar cheksiz) | 10 daq |
| 2 | Supabase | Postgres, auth, API, cron, Edge Functions | Free (2 loyiha) | 20 daq |
| 3 | Google Cloud (OAuth) | "Google bilan kirish" | bepul | 20 daq |
| 4 | Gmail (SMTP) | email orqali kirish kodi | bepul (≈500 xat/kun) | 10 daq |
| 5 | Cloudflare | admin panel hosting | Free | 10 daq |
| 6 | Firebase | push (FCM), Crashlytics, App Distribution | Spark (bepul) | 20 daq |
| 7 | Telegram | eslatmalar boti + ops ogohlantirishlari | bepul | 10 daq |
| 8 | age | zaxira nusxani shifrlash kaliti | bepul | 5 daq |

**Muhitlar:** `staging` (sinov) va `production` (haqiqiy). Har xizmatda ikkita
loyiha/kalit ochiladi — staging hech qachon prod ma'lumotiga tegmaydi.

Ushbu hujjat bo'yicha to'plagan qiymatlaringizni **parol menejerida**
saqlang (Bitwarden — bepul). Hech qachon chatga, kodga yoki issue'ga
yozmang.

---

## 1. GitHub

1. Repolar: `my-wallet-admin`, `my-wallet-mobil` — hozir **public**.
   Shunday qolgani ma'qul: GitHub Free'da Environments, reviewer talabi va
   branch himoyasi faqat public repolarda bepul, Actions minutlari cheksiz.
   Kodda sir yo'q; loglar va artefaktlar ochiq bo'lgani uchun zaxira
   shifrlanadi (8-qadam). Private qilinsa — bu imkoniyatlar uchun GitHub Pro
   kerak bo'ladi.
2. Har repoda **Settings → Branches → Add rule** (`main`):
   ✅ Require a pull request · ✅ Require status checks (`ci`) ·
   ✅ Require linear history.
3. **Settings → Environments:** `staging` (cheklovsiz) va `production`
   (✅ Required reviewers → o'zingiz). Prod deploy faqat tasdiqdan keyin.
4. **Personal access token (fine-grained)** — mobil CI admin repodan
   `contracts/` va backendni o'qishi uchun: *Settings → Developer settings →
   Fine-grained tokens* → Repository access: faqat `my-wallet-admin` →
   Permissions: **Contents: Read-only** → muddati 1 yil.
   → mobil repo sirlari: `ADMIN_REPO_TOKEN`.

5. **Settings → Actions → General → Workflow permissions:**
   ✅ "Allow GitHub Actions to create and approve pull requests" — reliz PR'i
   (release-please) uchun.

✅ **Tekshiruv:** PR ochganda "Merge" tugmasi CI tugamaguncha bloklangan.

---

## 2. Supabase (2 ta loyiha)

1. <https://supabase.com> → GitHub bilan ro'yxatdan o'ting → **New project**:
   - Nomi: `my-wallet-staging`, region: **Central EU (Frankfurt)**
     (O'zbekistonga eng yaqin), DB paroli — kuchli, saqlang.
   - Xuddi shunday `my-wallet-prod`.
2. Har loyihadan yozib oling (**Project Settings → API / Database**):

   | Qiymat | Qayerdan | GitHub'dagi nomi |
   |---|---|---|
   | Project ref (URL'dagi `abcd...`) | Settings → General | `SUPABASE_PROJECT_REF_STAGING` / `_PROD` (variable) |
   | Project URL | Settings → API | `SUPABASE_URL_STAGING` / `_PROD` (variable) |
   | **Publishable key** (`sb_publishable_...`) | Settings → API Keys | `SUPABASE_PUBLISHABLE_KEY_STAGING` / `_PROD` (variable — ochiq kalit) |
   | **Secret key** (`sb_secret_...`) | Settings → API Keys | `SUPABASE_SECRET_KEY` — Environment **secret** (Edge Function'larga platforma o'zi beradi; bu nusxa — ops skriptlari uchun) |
   | DB paroli | 1-qadam | `SUPABASE_DB_PASSWORD_STAGING` / `_PROD` (**secret**) |
   | Session pooler ulanish satri (IPv4) | Connect → Session pooler | `SUPABASE_DB_URL_PROD` (**secret**, zaxira uchun) |

   > Eski `anon` / `service_role` JWT kalitlari 2026-yil oxirida o'chiriladi —
   > faqat yangi `publishable` / `secret` kalitlardan foydalanamiz.
3. **Access token** (CLI uchun): Account → **Access Tokens** → Generate →
   `SUPABASE_ACCESS_TOKEN` (**secret**).
4. **Authentication → URL Configuration** (har loyihada):
   - Site URL: admin panel manzili (5-qadamdan keyin to'ldiriladi).
   - Redirect URLs: `https://<admin-domen>/**`, `mywallet://auth-callback`
     (prod), `mywallet-stg://auth-callback` (staging).
   > Remote auth sozlamalari faqat shu yerda (dashboard) qo'lda qilinadi —
   > `supabase/config.toml` faqat lokal muhit uchun (lokal manzillar prod'ga
   > tushib qolmasligi uchun `config push` ishlatilmaydi).
5. **Database → Extensions:** `pg_cron`, `pg_net` yoqilganini tekshiring
   (migratsiya ham yoqadi).

⚠️ **Bilib qo'ying (bepul reja):**
- 7 kun API so'rovi bo'lmasa loyiha **pauza** qilinadi — `keepalive.yml`
  (har 2 kunda) buning oldini oladi. Pauza bo'lsa: Dashboard → Restore
  (ma'lumot saqlanadi, 1 yil ichida).
- Avtomatik zaxira **yo'q** — `backup.yml` har kecha shifrlangan zaxira
  oladi (8-qadam).
- DB chegarasi 500 MB — admin "Platforma → Tizim salomatligi" ko'rsatadi.

✅ **Tekshiruv:** `curl -s "$SUPABASE_URL/rest/v1/" -H "apikey: <publishable>"`
→ JSON javob (401 emas).

---

## 3. Google OAuth ("Google bilan kirish")

1. <https://console.cloud.google.com> → yangi loyiha `my-wallet`.
2. **APIs & Services → OAuth consent screen** → External → ilova nomi
   "My Wallet", support email, logo (ixtiyoriy) → Scopes: `email`,
   `profile`, `openid` → Test users: o'zingiz (Publish qilguncha).
3. **Credentials → Create credentials → OAuth client ID** — 3 xil:

   | Turi | Nima uchun | Sozlama |
   |---|---|---|
   | **Web application** | Supabase (server tomonda token tekshiruvi) va Android `serverClientId` | Authorized redirect URI: `https://<ref>.supabase.co/auth/v1/callback` (staging va prod ikkalasi) |
   | **Android** (staging) | native Google Sign-In | package: `uz.mywallet.app.stg`, SHA-1: upload keystore'dan |
   | **Android** (prod) | | package: `uz.mywallet.app`, SHA-1: upload keystore'dan (+ Play App Signing SHA-1, agar Play ishlatilsa) |

   SHA-1 olish: `keytool -list -v -keystore upload.jks -alias upload`
   (keystore — `my-wallet-mobil/docs/DEPLOY.md` 2-qadam).
4. Supabase (har loyiha) → **Authentication → Providers → Google** → yoqing:
   Client ID = Web client ID, Client Secret = Web client secret,
   ✅ "Skip nonce checks" — **o'chiq** qoldiring.
5. GitHub'ga:
   - admin repo: `GOOGLE_WEB_CLIENT_ID` (variable), `GOOGLE_WEB_CLIENT_SECRET`
     (**secret** → `config.toml` dagi `env(...)`);
   - mobil repo: `GOOGLE_WEB_CLIENT_ID` (variable → `serverClientId`).

✅ **Tekshiruv:** admin panel login sahifasida "Google bilan kirish" →
Google oynasi → qaytib kirilgan holat.

---

## 4. Email kirish kodi — Gmail SMTP (bepul)

Supabase'ning o'rnatilgan pochtasi soatiga **2 ta** xat yuboradi va faqat
jamoa a'zolariga — ishlatib bo'lmaydi. Bepul yechim — Gmail SMTP.

1. Alohida Gmail (masalan `mywallet.noreply@gmail.com`) → **2-Step
   Verification** yoqing → <https://myaccount.google.com/apppasswords> →
   "My Wallet Supabase" → 16 belgili **App password**.
2. Supabase → **Authentication → Emails → SMTP Settings** → Enable custom SMTP:
   host `smtp.gmail.com`, port `587`, user — Gmail manzil, password — App
   password, sender name "My Wallet".
3. **Rate limits** → email: soatiga 30 (Gmail kunlik ~500 dan oshmaydi).
4. **Authentication → Emails → Templates** → **Magic Link** va **Confirm
   signup** ikkalasiga `supabase/templates/sign-in-code.html` mazmunini
   qo'ying (subject: `My Wallet — kirish kodi`). Standart shablonda havola
   bo'ladi, ilova esa **kod** (`{{ .Token }}`) kutadi.
5. GitHub (admin): `SMTP_USER` (variable), `SMTP_PASSWORD` (**secret**) —
   `config.toml` va ixtiyoriy email bildirishnomalari uchun.

> 💲 Muqobil: o'z domeningiz bo'lsa Resend (oyiga 3000 xat bepul, domen
> tasdig'i kerak) — deliverability yaxshiroq.

✅ **Tekshiruv:** admin login → "Email orqali" → 6 xonali kod keladi
(lokalda: `make db-start` → Mailpit <http://127.0.0.1:54324>).

---

## 5. Cloudflare (admin panel)

1. <https://dash.cloudflare.com> → ro'yxatdan o'ting (karta kerak emas).
2. **Account ID:** o'ng panelda (Workers & Pages) → `CLOUDFLARE_ACCOUNT_ID`
   (variable).
3. **API Token:** My Profile → API Tokens → Create → shablon **"Edit Cloudflare
   Workers"** → Account resources: faqat o'z akkauntingiz →
   `CLOUDFLARE_API_TOKEN` (**secret**).
4. Worker nomlari (`wrangler.jsonc` da): `my-wallet-admin` (prod) va
   `my-wallet-admin-staging`. Birinchi deploy'dan keyin manzillar:
   `https://my-wallet-admin.<subdomen>.workers.dev` — Supabase Site URL va
   Redirect URL'larga yozing (2-qadam, 4-band).
5. (ixtiyoriy 💲) O'z domeningiz: Workers → Settings → Domains & Routes.

✅ **Tekshiruv:** Actions → Deploy (staging) yashil → manzil ochiladi,
sahifani yangilaganda (`/reports/month`) 404 bo'lmaydi (SPA rejimi).

---

## 6. Firebase (push, Crashlytics, App Distribution)

1. <https://console.firebase.google.com> → **2 loyiha**: `my-wallet-staging`,
   `my-wallet-prod` (Google Analytics — ixtiyoriy). Reja **Spark** qoladi —
   Blaze'ga o'tmang.
2. Har loyihada **Android ilova** qo'shing: package `uz.mywallet.app.stg` /
   `uz.mywallet.app`, SHA-1 (3-qadamdagi) → `google-services.json` ni
   yuklab oling → mobil repo sirlari (`my-wallet-mobil/docs/DEPLOY.md`).
3. **Cloud Messaging (FCM) — server kaliti:** Project settings → Service
   accounts → **Generate new private key** (JSON) → base64:
   `base64 -w0 key.json` → admin repo **Environment secret**
   `FCM_SERVICE_ACCOUNT` (`staging` va `production` — har biriga o'z Firebase
   loyihasi kaliti). Deploy uni Edge Function muhitiga o'tkazadi
   (`notify-dispatch`). JSON faylni keyin o'chiring.
4. **App Distribution:** Release & Monitor → App Distribution → Get started →
   Testers & Groups → guruh `testers` (o'zingiz + oila a'zolari emaillari).
   CI yuklashi uchun servis akkaunt: Google Cloud Console (shu Firebase
   loyihasi) → IAM → Service accounts → Create → rol **Firebase App
   Distribution Admin** → JSON kalit → mobil repo **secret**
   `FIREBASE_APPDIST_SA_STAGING` / `_PROD` (base64).
5. **Crashlytics:** Release & Monitor → Crashlytics → Enable (SDK ilova
   ichida).

✅ **Tekshiruv:** Firebase Console → Messaging → "Send test message" →
qurilma tokeniga (ilovaning Sozlamalar → Diagnostika da ko'rinadi) keladi.

---

## 7. Telegram (2 ta bot)

1. Telegram'da **@BotFather** → `/newbot`:
   - **Ilova boti** (foydalanuvchilarga eslatma, `/balans`, tez kiritish):
     masalan `@MyWalletUzBot` → token → `production` Environment **secret**
     `TELEGRAM_BOT_TOKEN`. Staging uchun alohida bot (`@MyWalletStgBot`) →
     `staging` Environment'dagi `TELEGRAM_BOT_TOKEN`.
   - **Ops boti** (CI ogohlantirishlari: zaxira/keep-alive xatosi) — alohida
     bot → `OPS_TELEGRAM_BOT_TOKEN` (**secret**). O'zingiz botga `/start`
     yozing, keyin `https://api.telegram.org/bot<token>/getUpdates` dan
     `chat.id` → `OPS_TELEGRAM_CHAT_ID` (variable).
2. Webhook maxfiy kaliti: `openssl rand -hex 32` → har Environment'ga
   **secret** `TELEGRAM_WEBHOOK_SECRET`.
3. Webhook'ni ulash — **deploy workflow o'zi bajaradi**
   (`scripts/telegram-setup.sh`: `setWebhook` →
   `https://<ref>.supabase.co/functions/v1/telegram-webhook`, `secret_token`
   bilan; buyruqlar menyusi `/balans`, `/bugun`, `/stop` — uz/ru/en).
   Qo'lda kerak emas. Token bo'lmasa — Telegram qadami o'tkaziladi.
4. BotFather → `/setdescription`, `/setuserpic` — ixtiyoriy.

✅ **Tekshiruv:** ilovada Sozlamalar → Telegram → "Ulash" → botda `/start`
→ "✅ My Wallet ulandi" xabari.

---

## 8. Zaxira nusxa kaliti (age)

1. O'z kompyuteringizda: `sudo apt install age` → `age-keygen -o mywallet-backup.key`.
2. Chiqqan **ochiq kalit** (`age1...`) → admin repo variable
   `BACKUP_AGE_RECIPIENT`.
3. **Yopiq kalit** fayli (`mywallet-backup.key`) — faqat sizda: parol
   menejeri + oflayn nusxa (USB). GitHub'ga **qo'yilmaydi** — shuning uchun
   GitHub buzilsa ham zaxirani o'qib bo'lmaydi.
4. Tiklash (favqulodda):
   ```bash
   gh run download <run-id> -n db-backup-<run-id>      # yoki Actions → artefakt
   mkdir backup && age -d -i mywallet-backup.key my-wallet-*.tar.gz.age | tar -xzf - -C backup
   # DB + chek rasmlari (storage) — rasmlar uchun loyiha ref va token:
   SUPABASE_PROJECT_REF=<ref> SUPABASE_ACCESS_TOKEN=<token> \
     ./scripts/restore.sh backup <staging-yoki-lokal-db-url>
   ```
   Zaxira tarkibi: `roles.sql`, `schema.sql`, `data.sql` va `storage/`
   (chek rasmlari; fayllar soni bazadagi yozuvlar bilan solishtiriladi).
   Tiklash tekshiruvi har kecha zaxira bilan birga avtomatik
   (`restore.sh --verify` — CI ichidagi vaqtinchalik Supabase'ga).

---

## 9. GitHub sirlari va o'zgaruvchilari — yig'ma jadval

**Tamoyil:** ochiq qiymatlar (URL, publishable kalit, ref) — **repo
o'zgaruvchilari** (`_STAGING` / `_PRODUCTION` qo'shimchasi bilan): keep-alive
va zaxira ishlari ularni production tasdig'ini kutmasdan o'qiydi. Sirlar —
**Environment secrets** (`staging` / `production`): production siri faqat
reviewer tasdig'idan keyin ochiladi.

**Admin repo → Settings → Secrets and variables → Actions:**

*Variables (repo):*

| Nomi | Qiymat | Qadam |
|---|---|---|
| `DEPLOY_ENABLED` | `true` — hamma narsa sozlangandan keyin (shu paytgacha deploy workflow'lari o'chiq) | 10 |
| `SUPABASE_PROJECT_REF_STAGING` / `_PRODUCTION` | loyiha ref | 2.2 |
| `SUPABASE_URL_STAGING` / `_PRODUCTION` | `https://<ref>.supabase.co` | 2.2 |
| `SUPABASE_PUBLISHABLE_KEY_STAGING` / `_PRODUCTION` | `sb_publishable_...` | 2.2 |
| `ADMIN_URL_STAGING` / `_PRODUCTION` | admin panel manzili (workers.dev) | 5.4 |
| `CLOUDFLARE_ACCOUNT_ID` | akkaunt ID | 5.2 |
| `BACKUP_AGE_RECIPIENT` | `age1...` ochiq kalit | 8 |
| `OPS_TELEGRAM_CHAT_ID` | ops chat ID | 7.1 |

*Secrets (repo):*

| Nomi | Qadam |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | 2.3 |
| `CLOUDFLARE_API_TOKEN` | 5.3 |
| `SUPABASE_DB_URL_PRODUCTION` (session pooler, zaxira uchun) | 2.2 |
| `OPS_TELEGRAM_BOT_TOKEN` | 7.1 |

*Environment secrets (`staging` va `production` — har birida o'z qiymati):*

| Nomi | Qadam |
|---|---|
| `SUPABASE_DB_PASSWORD` | 2.1 |
| `SUPABASE_SECRET_KEY` | 2.2 |
| `FCM_SERVICE_ACCOUNT` (base64 JSON) | 6.3 |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` | 7 |
| `CRON_SECRET` (`openssl rand -hex 32`) — pg_cron → Edge Function chaqiruvlari uchun | — |

> **Deploy nima qiladi** (`scripts/deploy-secrets.sh`, har deployda):
> `CRON_SECRET`, `FCM_SERVICE_ACCOUNT`, `TELEGRAM_BOT_TOKEN`,
> `TELEGRAM_WEBHOOK_SECRET` → Edge Function muhitiga (`supabase secrets set`);
> Edge Function manzili va `CRON_SECRET` → **Vault** (`edge_functions_url`,
> `cron_secret`) — pg_cron shu yerdan o'qiydi. Sirni almashtirish: GitHub'da
> yangilang → deploy'ni qayta ishga tushiring (ikkala joy birga yangilanadi).
> Ixtiyoriy sir bo'sh bo'lsa, shu kanal xabarlari `skipped` (sababi bilan).

> Google Client Secret va SMTP paroli GitHub'ga **kerak emas** — ular
> Supabase dashboard'ida bir marta kiritiladi (3.4, 4.2).

**Mobil repo** — `my-wallet-mobil/docs/DEPLOY.md` 4-bo'lim.

---

## 10. Birinchi ishga tushirish tartibi

1. 1–8-qadamlar (akkauntlar va kalitlar) → 9-bo'limdagi jadval to'ldirildi.
2. Repo o'zgaruvchisi `DEPLOY_ENABLED = true`.
3. **Actions → Deploy → Run workflow → staging**: migratsiyalar → Edge
   Functions → admin panel → smoke testlar. Keyingi `main` push'lari
   staging'ga avtomatik chiqadi.
4. Staging'da tekshiruv ro'yxati (11-bo'lim).
5. Production: reliz PR'i (release-please) merge qilinadi → `release.yml`
   prod deploy'ni boshlaydi → `production` Environment'da tasdiqlaysiz.
   Favqulodda: **Actions → Deploy → production** (qo'lda, tasdiq bilan).
6. Mobil: `my-wallet-mobil/docs/DEPLOY.md` 5-bo'lim.
7. Eski ma'lumot importi (reja E27) — avval staging, keyin prod.

---

## 11. Tekshiruv ro'yxati (har muhit uchun)

- [ ] `health` RPC javob beradi (keepalive workflow yashil).
- [ ] Admin panel ochiladi, Google va email kod bilan kirish ishlaydi.
- [ ] Yangi foydalanuvchida shaxsiy byudjet va standart spravochniklar bor.
- [ ] Mobil ilova (shu muhit flavor'i) kiradi, amal yozadi, admin'da ko'rinadi.
- [ ] Oflayn yozuv tarmoq kelganda sinxronlanadi.
- [ ] Test push keldi; Telegram ulandi va test xabar keldi.
- [ ] `job_runs` da ishlar muvaffaqiyatli (SQL Editor):
      `select job, status, details, started_at from job_runs order by id desc limit 30;`
      — `daily_sweep`, `enqueue_*`, `dispatch_notifications`, `fx_sync`,
      `purge`, `purge_files`, `platform_stats`.
- [ ] pg_cron → Edge Function chaqiruvlari: `select status_code, content from
      net._http_response order by id desc limit 10;` — 200 (403 emas).
- [ ] Zaxira workflow yashil, restore-drill yashil.
- [ ] Supabase **Security Advisor** va **Performance Advisor** — ogohlantirish yo'q.

---

## 12. Muammolar va yechimlar

| Belgi | Sabab | Yechim |
|---|---|---|
| Loyiha "Paused" | 7 kun so'rov bo'lmagan | Dashboard → Restore; `keepalive.yml` yoqilganini tekshiring |
| `supabase db push` — auth xatosi | `SUPABASE_ACCESS_TOKEN` / DB paroli noto'g'ri | 2.1, 2.3 |
| Zaxira: `could not connect` | to'g'ridan-to'g'ri ulanish IPv6 | **Session pooler** satrini ishlating (2.2) |
| Google kirish: `DEVELOPER_ERROR` (Android) | SHA-1 yoki package mos emas | 3.3 — keystore SHA-1 va `applicationId` |
| Google kirish: redirect xato (web) | Redirect URI ro'yxatda yo'q | 2.4 va 3.3 |
| Email kod kelmaydi | custom SMTP yo'q / App password xato | 4 |
| Push kelmaydi | FCM servis akkaunti / token eskirgan | 6.3; admin "Qurilmalar" sahifasi |
| Telegram javob bermaydi | webhook ulanmagan / secret mos emas | deploy logidagi "Telegram webhook" qadami; `getWebhookInfo` |
| Eslatmalar kelmaydi, `job_runs` da `{"skipped": "not_configured"}` | Vault bo'sh (deploy sirlar qadamidan o'tmagan) | 9-bo'lim: `CRON_SECRET` ni qo'shib deploy'ni qayta ishga tushiring |
| `net._http_response` da 403 | Vault'dagi va Edge Function'dagi `CRON_SECRET` farq qiladi | deploy'ni qayta ishga tushiring (ikkalasini birga yozadi) |
| Xabar `skipped`: `push_not_configured` / `telegram_not_configured` | Edge Function muhitida FCM / bot tokeni yo'q | 6.3 / 7; deploy'ni qayta ishga tushiring |
| Admin sahifani yangilaganda 404 | SPA rejimi o'chiq | `wrangler.jsonc` → `not_found_handling` |
| Actions minutlari tugayapti | ko'p ishga tushirish | `docs/CI.md` — `paths` filtrlari, keshlar |
