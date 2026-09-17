# Deploy — admin panel va backend

Bu repo **butun backend**ni deploy qiladi: Firestore qoidalari va
indekslari, Cloud Functions, Vercel Cron va admin panelning o'zi.

Mobil ilova — `oylik-byudjet-app` repodagi `docs/DEPLOY.md` da.

---

## 0. Oldindan kerak bo'ladi

| Nima | Nega | Narxi |
|---|---|---|
| Firebase loyihasi + **Blaze rejasi** | Cloud Functions Spark (bepul) rejada **umuman deploy bo'lmaydi** | amaliy sarf ~$0, bepul kvota ichida |
| Vercel akkaunti | Admin panel | bepul (Hobby) yetarli |
| GitHub repo | Rejali ishlar (cron) | bepul |
| Telegram bot (ixtiyoriy) | Eslatma va oylik hisobot | bepul |

### Rejali ishlar — GitHub Actions'da (bepul)

Vercel'ning bepul rejasida cron soni va chastotasi cheklangan, shuning
uchun 5 ta rejali ish **GitHub Actions** ga ko'chirildi
(`.github/workflows/cron.yml`). Endpointlar Vercel'da qoladi — Actions
ularni `CRON_SECRET` bilan chaqiradi, ya'ni himoya o'zgarmaydi.

Kerakli secretlar: **Settings → Secrets and variables → Actions**

| Secret | Qiymat |
|---|---|
| `ADMIN_URL` | Vercel domeni, masalan `https://byudjet.vercel.app` |
| `CRON_SECRET` | Vercel env dagi qiymat bilan **aynan bir xil** |

Tekshirish: *Actions → Cron → Run workflow → `reminder`* → log'da
`HTTP 200` va `✅ reminder bajarildi` chiqishi kerak.

> ⚠️ **Muhim:** GitHub 60 kun davomida repoda hech qanday faollik
> (commit) bo'lmasa rejali workflow'larni **avtomatik o'chiradi** va
> bu haqda email yuboradi. Bir bosish bilan qayta yoqiladi, lekin
> eslatmalar jimgina to'xtab qolmasligi uchun buni bilib qo'ying.
>
> Shuningdek, Actions cron **aniq daqiqada** ishlamaydi — yuklama
> ko'p bo'lsa bir necha daqiqa kechikishi mumkin. Bizning ishlar
> uchun bu muhim emas (eng qattiq talab — kunlik eslatma).

---

## 1. Firebase

```bash
npm i -g firebase-tools
firebase login
firebase projects:create oylik-byudjet-dev
firebase projects:create oylik-byudjet-prod
```

Konsolida: **Firestore Database → Create database → `eur3`**,
so'ng **Blaze rejasiga** o'ting (Functions uchun majburiy).

### Qoidalar va indekslarni chiqarish (BIRINCHI NAVBATDA)

```bash
firebase deploy --only firestore:rules,firestore:indexes --project dev
```

> Indekslarsiz `where(...).orderBy(...)` so'rovlari xato beradi va ilova
> ro'yxatlarni ko'rsata olmaydi. Indeks qurilishi bir necha daqiqa vaqt
> oladi — buni deploydan oldin qiling.

### Funksiyalar

```bash
make build                      # calc-ts → bundle → functions/lib/index.js
firebase deploy --only functions --project dev
```

> `functions/` esbuild bilan **bitta faylga bundle qilinadi**. Sababi:
> `@byudjet/calc` lokal `file:` paket, Firebase esa faqat `functions/`
> papkasini yuklaydi — bundlesiz bulutdagi `npm install` uni topa olmay
> deploy qulardi.

## 2. Service account kaliti

```
Firebase Console → Project settings → Service accounts
  → Generate new private key   (key.json yuklab olinadi)

base64 -w0 key.json            # natijani FIREBASE_SERVICE_ACCOUNT ga qo'yasiz
```

⚠️ `key.json` ni repoga qo'ymang — `.gitignore` da, lekin baribir ehtiyot
bo'ling. U Firestore'ga **to'liq huquq** beradi.

## 3. Vercel

1. Vercel → Add New Project → repo'ni ulang;
2. **Root Directory = `admin`** (muhim!);

> Vercel faqat shu papkada buyruq bajaradi, `@byudjet/calc` esa
> `packages/calc-ts/dist` ga ishora qiladi va `dist/` repoda saqlanmaydi.
> Shuning uchun `admin` ning `build` skripti avval `calc-ts` ni yig'adi
> (`build:calc`). Bu qadamsiz Vercel `Module not found: @byudjet/calc`
> beradi.
3. Environment Variables (Production + Preview uchun alohida):

| O'zgaruvchi | Turi | Qiymat |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | Secret | `base64 -w0 key.json` natijasi |
| `FIREBASE_PROJECT_ID` | Plain | `oylik-byudjet-prod` / `-dev` |
| `ADMIN_UIDS` | Secret | Firebase Auth'dagi uid'ingiz (vergul bilan) |
| `CRON_SECRET` | Secret | `openssl rand -hex 32` |
| `TELEGRAM_BOT_TOKEN` | Secret | @BotFather bergan token |
| `TELEGRAM_CHAT_ID` | Secret | quyida 4-bo'lim |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Plain | Web app config'dan |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Plain | `<loyiha>.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Plain | loyiha ID |

> **Preview muhiti hech qachon prod Firebase'ga ulanmasligi kerak** —
> Preview uchun `-dev` loyiha qiymatlarini bering (reja §13.2).

4. Firebase Console → Authentication → Settings → **Authorized domains**
   ga Vercel domenini qo'shing (aks holda Google popup ishlamaydi).

## 4. Telegram (ixtiyoriy)

```bash
# 1. @BotFather → /newbot → token oling
# 2. Botga istalgan xabar yozing, so'ng:
curl "https://api.telegram.org/bot<TOKEN>/getUpdates" | grep -o '"chat":{"id":[0-9-]*'
# → chiqqan raqam = TELEGRAM_CHAT_ID
```

## 5. Sheets'dan ma'lumot ko'chirish

```bash
# 1. legacy/apps_script/Code.gs ga scripts/apps-script-export.gs qo'shing
# 2. Web app sifatida chiqaring va JSON oling:
curl "https://script.google.com/.../exec?action=export&k=KALIT" > export.json

# 3. Avval quruq yurgizib ko'ring (hech narsa yozilmaydi):
FIREBASE_SERVICE_ACCOUNT=$(base64 -w0 key.json) \
  node scripts/import-from-sheets.mjs export.json --uid=UID --dry

# 4. Haqiqiy import:
FIREBASE_SERVICE_ACCOUNT=$(base64 -w0 key.json) \
  node scripts/import-from-sheets.mjs export.json --uid=UID
```

Skript **oxirida Sheets'ning o'z yakunlari bilan avtomatik solishtiradi**:
har oy uchun `qoldiq` va `orttirgan` mos kelmasa xato bilan to'xtaydi.

So'ng admin panelda **🩺 Tekshirish** sahifasida drift yo'qligini
tasdiqlang.

## 6. CI/CD

| Workflow | Qachon | Nima qiladi |
|---|---|---|
| `ci.yml` | har push / PR | calc-ts tip + 86 test, functions tip, admin build, 16 ta rules testi (emulyator) |
| `deploy.yml` | `main` ga push (backend fayllari o'zgarsa) yoki qo'lda | build + testlardan so'ng Firestore qoidalari, indekslar va funksiyalarni deploy qiladi |
| `cron.yml` | jadval bo'yicha | 5 ta rejali ishni chaqiradi |

> Admin panelning o'zini **Vercel deploy qiladi** (GitHub integratsiyasi):
> har push → Preview, `main` → Production. Buning uchun workflow kerak emas.

### GitHub secrets (Settings → Secrets and variables → Actions)

| Secret | Kimga kerak | Qiymat |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | `deploy.yml` | `base64 -w0 key.json` |
| `ADMIN_URL` | `cron.yml` | `https://xxx.vercel.app` |
| `CRON_SECRET` | `cron.yml` | Vercel env dagi bilan bir xil |

`deploy.yml` ni qo'lda ishga tushirish: *Actions → Deploy → Run workflow*
→ `dev` yoki `prod` ni tanlaysiz.

## ✅ Deploy oldidan tekshiruv

- [ ] Firestore DB yaratilgan (`eur3`), Blaze rejasi yoqilgan
- [ ] `firebase deploy --only firestore:rules,firestore:indexes` o'tdi
- [ ] `make build && firebase deploy --only functions` o'tdi
- [ ] Vercel: Root Directory = `admin`, 9 ta env to'ldirilgan
- [ ] Authorized domains'ga Vercel domeni qo'shilgan
- [ ] GitHub secrets: `ADMIN_URL` va `CRON_SECRET` qo'shilgan
- [ ] *Actions → Cron → Run workflow* qo'lda sinab ko'rildi (HTTP 200)
- [ ] `curl https://<domen>/api/cron/reconcile` → **401** qaytaradi
      (kalitsiz kirib bo'lmasligi shart)
- [ ] `ADMIN_UIDS` da bo'lmagan hisob bilan kirib ko'rildi → **403**
- [ ] `make rules` — 16 ta qoida testi o'tadi
