# 🚀 Yo'riqnoma — siz nima qilasiz

> Kod tayyor va tekshirilgan. Qolgan ishlar — **faqat akkaunt, kalit va
> tugma bosish**. Hech qayerda kod yozish kerak emas.
>
> Jami vaqt: **~2 soat** (migratsiyasiz ~1.5 soat).
> Jami pul: **$0** (Play Store'ga chiqarmoqchi bo'lsangiz — $25 bir martalik).

Bu fayl ikkala repoda ham bir xil: `oylik-byudjet-app` va
`oylik-byudjet-admin`.

---

## Boshlashdan oldin

### Nima kerak bo'ladi

| Akkaunt | Nima uchun | Narxi |
|---|---|---|
| Google (bor) | Firebase | bepul |
| GitHub (bor) | Kod + rejali ishlar (cron) | bepul |
| Vercel | Admin panel | bepul (Hobby yetarli) |
| Telegram (ixtiyoriy) | Eslatma va oylik hisobot | bepul |
| Play Console (keyinroq) | Ilovani Play Store'ga chiqarish | $25 |

### Kerakli vositalar

```bash
# Node (bor) va Flutter (bor). Qolgani:
npm i -g firebase-tools
dart pub global activate flutterfire_cli
firebase login
```

### Boshlashdan oldin git

Ikkala papkada ham `git init` qilingan, lekin **commit qilinmagan**:

```bash
cd ~/oylik-byudjet-app   && git add -A && git commit -m "Dastlabki versiya"
cd ~/oylik-byudjet-admin && git add -A && git commit -m "Dastlabki versiya"
# GitHub'da ikkita repo yarating va push qiling
```

---

## 1-qadam · Firebase loyihasi (20 daqiqa)

### 1.1. Ikkita loyiha yarating

https://console.firebase.google.com → **Add project**

* `oylik-byudjet-dev` — sinov uchun
* `oylik-byudjet-prod` — haqiqiy ma'lumot uchun

> Ikkitasi shart: preview/sinov hech qachon haqiqiy pulingiz yozuvlariga
> tegmasligi kerak.

### 1.2. Firestore bazasini yarating

Har bir loyihada: **Build → Firestore Database → Create database**

* Rejim: **Production mode** (qoidalarni biz beramiz)
* Lokatsiya: **`eur3` (europe-west)** — Toshkentga eng yaqin variant

⚠️ Lokatsiya **keyin o'zgartirilmaydi**.

### 1.3. Google bilan kirishni yoqing

**Build → Authentication → Get started → Sign-in method → Google → Enable**

Support email sifatida o'z pochtangizni tanlang.

### 1.4. Blaze rejasiga o'ting

Pastki chap burchak → **Upgrade → Blaze (Pay as you go)**

> Cloud Functions bepul (Spark) rejada **umuman deploy bo'lmaydi**.
> Qo'rqmang: bizning yuklama bepul kvota ichida, amaliy to'lov ~$0.
> Xotirjamlik uchun **Budget alert** qo'ying: Google Cloud Console →
> Billing → Budgets → $1.

✅ **Tekshiruv:** Firestore ochilyapti, Authentication'da Google "Enabled".

---

## 2-qadam · Qoidalar va indekslar (10 daqiqa)

⚠️ **Bu qadamni birinchi bajaring.** Indekslarsiz ilova ro'yxatlarni
ko'rsata olmaydi va "The query requires an index" xatosi chiqadi.

```bash
cd ~/oylik-byudjet-admin

# .firebaserc dagi loyiha nomlarini o'zingiznikiga moslang
firebase use --add          # dev ni tanlang, alias: dev

firebase deploy --only firestore:rules,firestore:indexes --project dev
```

Indekslar qurilishi 2–10 daqiqa oladi (Firebase konsolida
**Firestore → Indexes** da holati ko'rinadi).

✅ **Tekshiruv:** konsolda 6 ta composite indeks "Enabled" holatida.

---

## 3-qadam · Mobil ilovani ulash (25 daqiqa)

### 3.1. Firebase'ni ilovaga bog'lang

```bash
cd ~/oylik-byudjet-app/app
flutterfire configure --project=oylik-byudjet-dev
```

Platformalardan **android** va **ios** ni tanlang. Bu buyruq o'zi:
* `lib/firebase_options.dart` ni yozadi,
* `android/app/google-services.json` ni qo'yadi,
* `ios/Runner/GoogleService-Info.plist` ni qo'yadi.

### 3.2. SHA fingerprint (MAJBURIY)

Bu qadamsiz Android'da **Google bilan kirish ishlamaydi**
(`ApiException: 10` xatosi chiqadi).

```bash
cd ~/oylik-byudjet-app/app/android
./gradlew signingReport | grep -A3 "Variant: debug"
```

Chiqqan **SHA1** va **SHA-256** ni:
Firebase Console → ⚙️ **Project settings → Your apps → Android →
Add fingerprint** ga qo'shing.

So'ng `google-services.json` ni **qayta yuklab oling** va
`android/app/` ichidagisini almashtiring.

### 3.3. Ishga tushiring

```bash
cd ~/oylik-byudjet-app/app
flutter run
```

✅ **Tekshiruv ro'yxati:**
- [ ] "Google bilan kirish" ishlaydi
- [ ] Daromad qo'shildi → Xulosa ekranida qoldiq o'zgardi
- [ ] **Aviarejimni yoqing** → xarajat qo'shing → qoldiq **darhol**
      o'zgaradi va "📴 Oflayn" lentasi chiqadi
- [ ] Aviarejimni o'chiring → bir necha soniyada lenta yo'qoladi
- [ ] Firebase konsolida `users/<uid>/months/2026-09` hujjati paydo bo'ldi

### 3.4. UID ingizni yozib oling

Firebase Console → **Authentication → Users** → `User UID` ustunidan
nusxa oling. Keyingi qadamlarda kerak bo'ladi.

---

## 4-qadam · Admin panel → Vercel (25 daqiqa)

### 4.1. Service account kaliti

Firebase Console → ⚙️ **Project settings → Service accounts →
Generate new private key** → `key.json` yuklanadi.

```bash
base64 -w0 ~/Downloads/key.json      # chiqqan uzun matnni nusxa oling
```

⚠️ Bu kalit Firestore'ga **to'liq huquq** beradi — hech kimga bermang,
repoga qo'ymang.

### 4.2. Cron kaliti yarating

```bash
openssl rand -hex 32                 # chiqqan qiymatni saqlab qo'ying
```

### 4.3. Web app qo'shing

Firebase Console → **Project settings → Your apps → Web (</>)** →
`My Wallet Admin` deb nomlang. Chiqqan config'dan 3 ta qiymat kerak:
`apiKey`, `authDomain`, `projectId`.

### 4.4. Vercel loyihasi

https://vercel.com → **Add New → Project** → admin repo'ni tanlang.

| Sozlama | Qiymat |
|---|---|
| **Root Directory** | `admin` ⚠️ (eng muhim!) |
| Framework | Next.js (o'zi topadi) |

**Environment Variables** (Production va Preview uchun alohida):

| Nomi | Qiymat |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | 4.1 dagi base64 matn |
| `FIREBASE_PROJECT_ID` | `oylik-byudjet-dev` |
| `ADMIN_UIDS` | 3.4 dagi UID |
| `CRON_SECRET` | 4.2 dagi qiymat |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | 4.3 dagi `apiKey` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | 4.3 dagi `authDomain` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | 4.3 dagi `projectId` |

**Deploy** tugmasini bosing.

### 4.5. Domenni Firebase'ga tanishtiring

Firebase Console → **Authentication → Settings → Authorized domains →
Add domain** → Vercel bergan domen (`xxx.vercel.app`).

> Busiz Google kirish oynasi ochilib, darhol yopilib qoladi.

✅ **Tekshiruv:**
- [ ] Vercel domeni ochildi, "Google bilan kirish" ishlaydi
- [ ] Ichkarida Xulosa sahifasi ma'lumot ko'rsatyapti
- [ ] Boshqa Google hisob bilan kirsangiz — **403** (ro'yxatda yo'q)

---

## 5-qadam · Rejali ishlar (cron) — 5 daqiqa

GitHub → admin repo → **Settings → Secrets and variables → Actions →
New repository secret**:

| Secret | Qiymat |
|---|---|
| `ADMIN_URL` | `https://xxx.vercel.app` (oxirida `/` **yo'q**) |
| `CRON_SECRET` | 4.2 dagi qiymat (Vercel'dagi bilan **aynan bir xil**) |

✅ **Tekshiruv:** **Actions → Cron → Run workflow** → `reminder` ni
tanlang → Run. Log'da `HTTP 200` va `✅ reminder bajarildi` chiqishi kerak.

> ⚠️ GitHub 60 kun repoda commit bo'lmasa rejali ishlarni avtomatik
> o'chiradi (email yuboradi). Qayta yoqish — bir bosish.

---

## 6-qadam · Cloud Functions (10 daqiqa)

```bash
cd ~/oylik-byudjet-admin
make build
firebase deploy --only functions --project dev
```

✅ **Tekshiruv:** Firebase Console → **Functions** da 3 ta funksiya:
`reconcileAggregates`, `recalcMonthKeys`, `sendTestPush`.

---

## 7-qadam · Telegram (10 daqiqa, ixtiyoriy)

```bash
# 1. Telegramda @BotFather → /newbot → nom bering → TOKEN oling
# 2. Yaratilgan botga istalgan xabar yozing ("salom")
# 3. Chat ID ni oling:
curl "https://api.telegram.org/bot<TOKEN>/getUpdates" \
  | grep -o '"chat":{"id":[0-9-]*' | head -1
```

Vercel env'ga qo'shing: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` →
qayta deploy qiling.

Ilovada: **Sozlamalar → Eslatmalar → Telegram** ni yoqing.

✅ **Tekshiruv:** Actions → Cron → `reminder` → Telegram'ga xabar keladi.

---

## 8-qadam · Sheets'dan ma'lumotni ko'chirish (30 daqiqa)

### 8.1. Eksport skriptini qo'shing

Google Sheets → **Extensions → Apps Script** → `Code.gs` oxiriga
`oylik-byudjet-admin/scripts/apps-script-export.gs` faylining
mazmunini qo'shing va saqlang.

`doGet` funksiyasiga `action=export` ni ulang (kodda ko'rsatilgan).

### 8.2. JSON ni oling

```bash
curl "https://script.google.com/macros/s/.../exec?action=export&k=KALIT" \
  > ~/export.json
```

### 8.3. Avval quruq yurgizing (hech narsa yozilmaydi)

```bash
cd ~/oylik-byudjet-admin
FIREBASE_SERVICE_ACCOUNT=$(base64 -w0 ~/Downloads/key.json) \
  node scripts/import-from-sheets.mjs ~/export.json --uid=SIZNING_UID --dry
```

### 8.4. Haqiqiy import

```bash
FIREBASE_SERVICE_ACCOUNT=$(base64 -w0 ~/Downloads/key.json) \
  node scripts/import-from-sheets.mjs ~/export.json --uid=SIZNING_UID
```

Skript **oxirida Sheets'ning o'z yakunlari bilan avtomatik solishtiradi**.
Agar biror oyda `qoldiq` yoki `orttirgan` mos kelmasa — xato bilan
to'xtaydi va qaysi oy ekanini aytadi.

✅ **Tekshiruv:** admin panelda **🩺 Tekshirish** sahifasi — "Toza"
yozuvi chiqishi kerak.

> 📌 Tavsiya: 1 oy davomida Sheets'ni ham saqlab turing (faqat o'qish
> uchun), ikkalasini solishtirib yuring.

---

## 9-qadam · Reliz (keyinroq)

### 9.1. Prod loyihaga o'tish

1-qadamni `oylik-byudjet-prod` uchun takrorlang, so'ng:

```bash
cd ~/oylik-byudjet-app/app
flutterfire configure --project=oylik-byudjet-prod
```

Vercel env'larni prod qiymatlariga o'zgartiring.

### 9.2. Reliz kaliti

```bash
keytool -genkey -v -keystore ~/mywallet-release.jks \
  -keyalg RSA -keysize 2048 -validity 10000 -alias mywallet

cd ~/oylik-byudjet-app/app/android
cp key.properties.example key.properties   # to'ldiring
```

⚠️ `.jks` faylini **yo'qotmang** — busiz ilovani yangilab bo'lmaydi.
Zaxira nusxasini xavfsiz joyda saqlang.

Reliz kalitining SHA-1/SHA-256 ini ham Firebase'ga qo'shing (3.2 kabi).

### 9.3. Yig'ish va yuklash

```bash
cd ~/oylik-byudjet-app/app
flutter build appbundle --release
# → build/app/outputs/bundle/release/app-release.aab
```

Play Console → Create app → **My Wallet** → Internal testing →
`.aab` ni yuklang.

---

## 🔧 Nimadir ishlamasa

| Belgi | Sababi | Yechim |
|---|---|---|
| Android'da `ApiException: 10` | SHA fingerprint qo'shilmagan | 3.2-qadam; `google-services.json` ni qayta yuklang |
| `The query requires an index` | Indekslar deploy qilinmagan | 2-qadam |
| Vercel'da `FIREBASE_SERVICE_ACCOUNT berilmagan` | env qo'yilmagan yoki Preview uchun alohida qo'yilmagan | 4.4-qadam, ikkala muhitga ham |
| Admin panelga kirsam **403** | `ADMIN_UIDS` da UID yo'q | 3.4 dagi UID ni tekshiring |
| Kirish oynasi ochilib yopiladi | Domen Authorized domains'da yo'q | 4.5-qadam |
| `firebase deploy --only functions` xato | Blaze rejasi yoqilmagan | 1.4-qadam |
| Cron `HTTP 401` | `CRON_SECRET` Vercel va GitHub'da har xil | ikkalasini bir xil qiling |
| Push kelmayapti (iOS) | APNs kaliti yuklanmagan | Apple Developer → Keys → APNs → Firebase'ga yuklang |
| Xarajat qo'shdim, Xulosa o'zgarmadi | Agregat drifti (juda kam uchraydi) | 🩺 Tekshirish → Tuzatish |

---

## Yakuniy ro'yxat

- [ ] 1. Firebase: 2 ta loyiha, Firestore (`eur3`), Google auth, Blaze
- [ ] 2. Qoidalar va indekslar deploy qilindi
- [ ] 3. `flutterfire configure` + SHA fingerprint + aviarejim testi
- [ ] 4. Vercel: Root Directory=`admin`, 7 ta env, Authorized domain
- [ ] 5. GitHub secrets: `ADMIN_URL`, `CRON_SECRET` + qo'lda sinov
- [ ] 6. Cloud Functions deploy qilindi
- [ ] 7. Telegram (ixtiyoriy)
- [ ] 8. Sheets'dan import + 🩺 "Toza"
- [ ] 9. Reliz (prod loyiha, keystore, Play Console)

Har qadamdan keyin **✅ Tekshiruv** ni bajaring — keyingi qadamga
o'tishdan oldin xato topilgani ancha arzon.
