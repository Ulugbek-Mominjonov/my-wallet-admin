# Qabul qilingan qarorlar — hisobot

> Reja (`docs/FLUTTER_PLAN.md`) to'liq amalga oshirildi. Yo'l-yo'lakay
> aniqlashtirish talab qilgan joylar bo'ldi — quyida **har bir qaror,
> sababi va nimadan voz kechilgani** yozilgan. Rejadan CHEKINGAN joylar
> alohida belgilangan: ⚠️
>
> Sana: 2026-09-16

---

## 0. Yakuniy holat (o'lchangan, taxmin emas)

**Mobil repo** (`oylik-byudjet-app`):

| Paket | Analiz | Testlar | Izoh |
|---|---|---|---|
| `packages/domain` | ✅ toza (`--fatal-infos`) | **230** | `calc/` qoplamasi **97.8%** (DoD ≥95%) |
| `packages/data_firebase` | ✅ toza | **18** (+1 skip) | `fake_cloud_firestore` bilan |
| `app` (Flutter) | ✅ toza | **13** | widget testlari |

**Admin repo** (`oylik-byudjet-admin`):

| Paket | Analiz | Testlar | Izoh |
|---|---|---|---|
| `packages/calc-ts` | ✅ `tsc` strict | **86** | 61 tasi — Dart bilan parite |
| `functions` | ✅ `tsc` strict | — | |
| `admin` (Next.js) | ✅ `tsc` + `next build` | — | build ✅ |
| `tests/rules` | — | **16** | haqiqiy Firestore emulyatorida |

**Jami: 363 test** — bo'linishdan keyin ham hammasi o'tadi.

Eng muhim test (reja §10): *"delta bilan hisoblangan agregat == noldan
hisoblangan agregat"* — **1000 ta tasodifiy amal**, har qadamdan keyin
tekshiriladi. ✅

---

## 1. Loyiha joylashuvi — IKKITA REPO

Reja §13.1 bitta monorepo'ni ko'zda tutgan edi. **Sizning so'rovingizga
ko'ra ikkita mustaqil papkaga bo'lindi** — har biri o'z git repo'si
bo'lishi uchun:

| Papka | Nima | CI |
|---|---|---|
| `/home/ulugbek/oylik-byudjet-app/` | Mobil ilova + sof Dart domen | Dart/Flutter |
| `/home/ulugbek/oylik-byudjet-admin/` | Admin panel + **butun backend** | Node/Next/Firebase |

**Nima qayerga ketdi va nega:**

| Qism | Repo | Sabab |
|---|---|---|
| `app/`, `packages/domain`, `packages/data_firebase` | app | Faqat mobil ilova ishlatadi |
| `admin/`, `packages/calc-ts`, `functions/` | admin | `calc-ts` ni admin ham, functions ham ishlatadi |
| `firestore.rules`, `indexes`, `tests/rules` | admin | Backend shu repodan deploy qilinadi (GitHub Actions) — **qoidalar nusxalanmadi**, bitta manba |
| `scripts/` (migratsiya), `legacy/apps_script` | admin | Migratsiya Node + Admin SDK bilan ishlaydi, eksport skripti esa `Code.gs` ga qo'shiladi |
| `testdata/` | **ikkalasida ham** | Yagona shartnoma — pastda |
| `docs/` | ikkalasida ham | Har repo yolg'iz klon qilinganda ham tushunarli bo'lishi uchun |

### 1.1. Yagona repolararo shartnoma: fixture'lar

`testdata/aggregate-cases.json` — Dart generatoridan chiqadi, TS testlari
uni etalon sifatida ishlatadi. Bu **bir tomonlama** bog'liqlik:

```
mobil repo:  make fixtures          # Dart yaratadi (kanonik)
admin repo:  make sync-fixtures     # ko'chiradi
             npm --prefix packages/calc-ts test   # parite tekshiruvi
```

`scripts/sync-fixtures.mjs` lokal yo'ldan ham, `https://` havoladan ham
(GitHub raw) ola oladi — CI'da avtomatlashtirish uchun. Fayl noto'g'ri
bo'lsa (`deltaCases` yo'q) skript to'xtaydi.

**Muqobil variantlar nega tanlanmadi:**
* *npm/pub paket sifatida nashr qilish* — bitta foydalanuvchilik loyiha
  uchun reliz tsikli ortiqcha;
* *git submodule* — klon va CI murakkablashadi, foyda esa bitta JSON fayl;
* *fixture'ni faqat admin repoda saqlash* — u holda Dart testlari
  etalonsiz qolardi.

### 1.2. Boshqa tafsilotlar

* `Code.gs`, `Ilova.html`, `appsscript.json`, eski `README.md` →
  `oylik-byudjet-admin/legacy/apps_script/` (o'chirilmadi, o'zgartirilmadi);
* har ikkala repoda `git init` bajarildi, lekin **commit qilinmadi** —
  birinchi commit sizniki;
* eski `/home/ulugbek/oylik-byudjet/` papkasi bo'shatildi va o'chirildi —
  ikkinchi nusxa qolib, xato papkada tahrirlash xavfi bo'lmasligi uchun.

---

## 2. Rejadan chekinishlar (⚠️) va sabablari

### ⚠️ 2.1. `freezed` / `json_serializable` / `riverpod_generator` ishlatilmadi

**O'rniga:** qo'lda yozilgan immutable klasslar (`copyWith`, `==`,
`hashCode`) va codegen'siz Riverpod.

**Sabab:**
1. `build_runner` = repoda yuzlab `.g.dart` / `.freezed.dart` fayllari;
   ular eskirsa kod umuman kompilyatsiya bo'lmaydi;
2. har CI ishga tushishida generatsiya qadami (daqiqalar) qo'shiladi;
3. DTO'larda JSON baribir qo'lda yoziladi — `Timestamp` ↔ `DateTime`,
   `Money` ↔ `int` konvertatsiyasi uchun maxsus mantiq kerak.

**Narxi:** entity'larda `copyWith` boilerplate'i (bir marta yoziladi).
**Qaytarish:** additiv — `freezed` keyin qo'shilsa mavjud kod buzilmaydi.

### ⚠️ 2.2. `very_good_analysis` o'rniga qo'lda yozilgan lint to'plami

`packages/domain/analysis_options.yaml` da ~150 qoida, `strict-casts`,
`strict-inference`, `strict-raw-types` yoqilgan. Boshqa paketlar shu
faylni `include` qiladi.

**Sabab:** tashqi lint paketi versiyasi Dart SDK bilan konflikt bersa
butun CI qulaydi; qoidalar esa baribir shu ro'yxatdan olinadi.

### ⚠️ 2.3. `melos` ishlatilmadi

**O'rniga:** `path:` bog'liqliklari + `Makefile`.

**Sabab:** `packages/domain` ni **Flutter'siz** test qilish imkoniyati
saqlanishi kerak (`dart test` — soniyalar). Melos/pub workspaces butun
daraxtni bitta resolyutsiyaga bog'lab qo'yadi va Flutter'ni majburiy
qiladi.

### ⚠️ 2.4. `meta/totals` da hosila qiymatlar saqlanmaydi

Reja §4.2 da `savings`, `monthCount`, `firstMonth`, `lastMonth` bor edi.
**Ular olib tashlandi.**

**Sabab:** rejaning o'z tamoyili (§4.1): *"hosila qiymatni saqlash = ikki
manba = drift"*. `savings = income − expense` — aynan bir xil qiymat.
`monthCount` / `firstMonth` / `lastMonth` esa `increment` bilan xavfsiz
yuritilmaydi (bir oy hujjati boshqa yozuv tomonidan yaratilishi mumkin).
Ular `months` kolleksiyasidan olinadi — u jamg'arma ekraniga baribir
kerak va keshlanadi.

**Natija:** dashboard hali ham **2 hujjat** o'qiydi.

### ⚠️ 2.5. Qarz hisoblagichi ikkiga bo'lindi

Reja: bitta `paidFromApp`. **Amalda:** `paidFromExpenses` +
`paidFromIncomes` (+ `pendingFromApp`).

**Sabab:** `Code.gs` dagi qoida yo'nalishga bog'liq:
`ilovadan = mengami ? bog.daromad : bog.xarajat`. Bitta hisoblagich bilan
yozuv paytida qarz yo'nalishini bilish uchun qarz hujjatini **o'qish**
kerak bo'lardi — bu "0 read" tamoyilini buzadi. Ikkita hisoblagich bilan
o'qish umuman kerak emas: ikkalasi ham yoziladi, o'qishda yo'nalishga
qarab bittasi tanlanadi.

### ⚠️ 2.6. Agregatda nuqtali "field path" ishlatilmadi

Reja: `'byCategory.Qarz.actual': increment(...)`.
**Amalda:** ichma-ich map + `SetOptions(merge: true)`.

**Sabab:** kategoriya nomida nuqta bo'lsa (`"Uy.kommunal"`) Firestore uni
ichma-ich yo'l deb talqin qiladi va **noto'g'ri joyga yozadi**. Ichma-ich
map'da bunday muammo yo'q. Test bilan qoplangan
(`delta_calc_test.dart` → "nuqtali kategoriya nomi ham to'g'ri yoziladi").

### ⚠️ 2.7. Katalog kolleksiyalari `settings/` ostida emas

Reja §4: `settings/recurring/{id}`. **Amalda:** `users/{uid}/recurring/{id}`.

**Sabab:** Firestore'da subkolleksiya faqat **hujjat** ostida bo'ladi.
`settings/recurring` — bu `settings` kolleksiyasidagi `recurring` nomli
hujjat bo'lardi, uning ostiga yana kolleksiya osish sun'iy ierarxiya
yaratardi. Rules baribir `users/{uid}` darajasida hal bo'ladi.

### ⚠️ 2.8. `settings/app.monthStartDay` olib tashlandi

**Sabab:** o'lik konfiguratsiya bo'lardi — hech bir hisob undan
foydalanmaydi. "Oyim maoshdan boshlanadi" ehtiyojini **daromad qoidasi**
(§2.1) allaqachon qoplaydi.

### ⚠️ 2.9. Vercel Cron `L` (oxirgi kun) sintaksisi

Reja: `"0 20 L * *"`. Vercel Cron `L` ni qo'llab-quvvatlamaydi.
**Amalda:** `"0 20 28-31 * *"` + endpoint ichida "bugun oyning oxirgi
kunimi?" tekshiruvi.

### ⚠️ 2.10. `shadcn/ui` ishlatilmadi

**O'rniga:** Tailwind v4 + 6 ta o'z komponentim (`Card`, `Stat`, `Badge`,
`Progress`, `EmptyState`, `PageHeader`).

**Sabab:** shadcn CLI generatsiyasi + Radix bog'liqliklari (~20 paket)
bitta foydalanuvchilik panel uchun ortiqcha. TanStack Table va Recharts
esa **rejadagidek** ishlatildi (saralash, qidiruv, grafik).

---

## 3. Domen modelidagi aniqlashtirishlar

### 3.1. "Summasi noma'lum" va "reja nol" — ikki xil holat

`Code.gs` da ikkalasi ham `0` edi, lekin xulq farq qilardi:
bo'sh reja → `⏳ Kutilmoqda`, aniq `0` → `—`.

**Amalda:** `Expense.planned` — `Money?`.
* `null` = summasi har oy o'zgaradi → **kuzatiladi**, eslatmaga tushadi;
* `Money.zero` = kuzatilmaydigan qator → eslatilmaydi.

Bu farq `unknownCount` agregat maydonini ham aniqroq qiladi.

### 3.2. Qarzga bog'lanish — faqat `debtId`

Sheets nom bo'yicha avtomatik bog'lardi (`bogliqlikniToldir_`). Reja §2.7
buni ataylab bekor qilgan. **Nom bo'yicha moslashtirish faqat import
skriptida qoldi** — u yerda nom yagona manba.

### 3.3. `IncomeRules` — map emas, ro'yxat

Ro'yxatda turning **asl yozilishi** (`"Qo'shimcha"`) va **tartib**
saqlanadi; qidiruv esa normallashtirilgan kalit bo'yicha
(`kalit_()` ning aynan o'zi: trim + lowercase).

### 3.4. Yaxlitlash BIR MARTA

`round(daromad × foiz / 100 / 1000) × 1000` — avval so'mgacha, keyin
minggacha yaxlitlansa natija farq qilishi mumkin (masalan 1 499 600 → 10%:
to'g'ri javob 150 000, ikki bosqichli yaxlitlashda 1 000 000 chiqib
qolishi mumkin). Test bilan qoplangan.

### 3.5. Sana solishtirish — KUN aniqligida

`Code.gs` sanalarni `yyyy-MM-dd` matniga aylantirib solishtirardi. Dart'da
`dateOnly()` yordamchisi shu xulqni saqlaydi: soat-minut hech qachon
"bugungi to'lov kechikkan" degan natija bermaydi.

---

## 4. Offline bilan bog'liq qarorlar

### 4.1. `batch.commit()` KUTILMAYDI

Firestore'da offline paytda `commit()` ning `Future` i faqat **server
tasdig'idan keyin** bajariladi. Agar uni kutsak, aviarejimda "Saqlash"
tugmasi abadiy aylanardi.

**Amalda:** lokal kesh darhol yangilanadi, `Future` esa fonda kuzatiladi
va xato bo'lsa `onSyncError` ga uzatiladi (jimgina yutilmaydi).
Server tasdig'i kerak bo'lgan joyda (cron, testlar) `awaitServer: true`.

### 4.2. Oflayn banner — `connectivity_plus` emas

**Amalda:** `meta/totals` hujjatining `snapshot.metadata.isFromCache`
qiymati kuzatiladi.

**Sabab:** internet bor, lekin Firestore bilan aloqa yo'q holati ham
mavjud. Metadata ROSTDAN ham "ma'lumot sinxronmi?" degan savolga javob
beradi va qo'shimcha paket talab qilmaydi.

### 4.3. ID ni klient beradi

`FirestoreIdGenerator` — `doc().id`. Serverga borish shart emas, shuning
uchun aviarejimda yozuv darhol yaratiladi va sinxronlashda takrorlanmaydi.

---

## 5. Xavfsizlik qarorlari

| Qaror | Sabab |
|---|---|
| `months` va `meta/totals` ga **klient yozadi** | Offline ishlashi shart (reja §7.1). Xatoni reconciler tuzatadi. |
| `meta/health` va `auditLog` — **klient yoza olmaydi** | Ular server haqiqati; rules'da `allow write: if false`. |
| Rules'da pul maydonlari `is int` tekshiriladi | Kasrli qiymat kirsa butun agregat buzilardi. |
| `keys().hasOnly([...])` | Sxemaga kirmagan maydon yozilmaydi. |
| Admin panelda brauzerga yozish huquqi berilmaydi | Barcha yozuv Server Action → Admin SDK. |
| `ADMIN_UIDS` ro'yxati | Ro'yxatda yo'q uid sessiya cookie'sini umuman ololmaydi (403). |
| Cron endpointlari `Bearer $CRON_SECRET` | Aks holda 401. |
| Sirlar faqat env'da | `.gitignore` da `.env*`, `service-account*.json`. |

**Tekshirildi:** 16 ta rules testi haqiqiy emulyatorda o'tdi — jumladan
"boshqa uid hech narsani o'qiy olmaydi" va "meta/health ga klient yoza
olmaydi".

---

## 6. Ishlash (performance) qarorlari

1. **Dashboard = 2 o'qish.** Kategoriya kesimi, karta/naqd, prognoz —
   hammasi `months/{oy}` + `meta/totals` dan klientda hisoblanadi.
2. **Listener faqat kerak joyda.** Ro'yxat providerlari
   `isAutoDispose: true` — ekran yopilishi bilan ulanish uziladi.
   Dashboard providerlari doimiy (ular har doim kerak).
3. **Kursorli sahifalash.** `offset` ishlatilmaydi (Firestore o'tkazib
   yuborilgan hujjatlar uchun ham pul oladi). Kursor —
   `<saralash qiymati>|<hujjat id>`, shuning uchun oldingi hujjatni qayta
   o'qish kerak emas.
4. **N+1 yo'q.** Qarz bo'yicha to'lovlar — bitta `where('debtId', ...)`
   so'rovi; qarzlar ekrani esa umuman so'rov qilmaydi (hisoblagichlar
   qarz hujjatining o'zida).
5. **Bulk = 1 batch.** 40 ta to'lov = 1 batch + agregat 1 marta
   (`BatchChunker` 400 amalda kesadi).
6. **Kesh teglari.** Admin panelda yozuvdan keyin faqat
   `month:2026-09` tegi yangilanadi, butun kesh emas.

---

## 7. Nima qilinmadi (ochiq qoldi)

Bularni bilib turib qoldirdim — ular yo tashqi resurs talab qiladi,
yo dizayn tasdig'idan keyin ma'noga ega bo'ladi:

| Ish | Nega qoldirildi |
|---|---|
| Haqiqiy Firebase loyihasi yaratish | Google akkaunt kredensiali kerak. `flutterfire configure` bir buyruq. |
| Android/iOS build | Android SDK / Xcode yo'q. Kod kompilyatsiya bo'ladi (`flutter analyze` + `flutter test` toza). |
| Golden testlar | Golden fayllar dizayn tasdiqlangandan keyin yaratiladi, aks holda ular har piksel o'zgarishida qulaydi. |
| `integration_test` (emulyator bilan to'liq oqim) | Emulyator + qurilma kerak; rules testlari va widget testlari asosiy xatarni allaqachon qoplaydi. |
| Telegram webhook (chatId ni avtomatik olish) | Hozircha `TELEGRAM_CHAT_ID` env orqali. Webhook uchun public URL kerak. |
| Ruscha tarjima | `core/l10n/strings.dart` bitta manba — tarjima qo'shish mexanik ish. |
| CSV import/eksport (admin) | JSON eksport bor; CSV format talablari aniqlanmagan. |
| Sentry ulash | DSN kerak; `AppLog` bitta nuqta sifatida tayyor turibdi. |
| PIN / biometrika (`local_auth`) | Paket qo'shilgan, ekran qo'shilmagan — avval Firebase ulanishi kerak. |

---

## 8. Keyingi 5 qadam (tavsiya etilgan tartib)

1. `firebase projects:create oylik-byudjet-dev` + `flutterfire configure`
   (`app/lib/firebase_options.dart` avtomatik yoziladi).
2. `firebase deploy --only firestore:rules,firestore:indexes` — indekslar
   birinchi so'rovdan oldin tayyor bo'lishi kerak.
3. Apps Script'ga `scripts/apps-script-export.gs` ni qo'shib JSON oling,
   so'ng `node scripts/import-from-sheets.mjs export.json --uid=UID`.
   Skript **oxirida Sheets'ning o'z yakunlari bilan solishtiradi** va farq
   bo'lsa xato bilan to'xtaydi.
4. Vercel'da loyiha yarating (Root Directory = `admin`), `.env.example`
   dagi o'zgaruvchilarni to'ldiring.
5. 1 oy davomida Sheets'ni **read-only** holda saqlang (reja §11.4).

---

## 9. Deploy tayyorgarligi (2026-09-17)

Deploy blokerlarini tekshirib, quyidagilar tuzatildi:

| # | Muammo | Yechim |
|---|---|---|
| 1 | `functions` da `@byudjet/calc` lokal `file:` bog'liqlik | **esbuild bilan bitta faylga bundle**. Firebase faqat `functions/` papkasini yuklaydi — bundlesiz bulutdagi `npm install` paketni topa olmay deploy qulardi. Endi tashqi bog'liqlik faqat `firebase-admin` va `firebase-functions` |
| 2 | `MainActivity : FlutterActivity` | `FlutterFragmentActivity` ga o'zgartirildi — `local_auth` bironta `FragmentActivity` talab qiladi, aks holda qulf ekrani **crash** bo'lardi |
| 3 | Google Services gradle plagini yo'q edi | Qo'shildi, lekin **shartli**: `google-services.json` mavjud bo'lsagina qo'llanadi. Shunda Firebase sozlanmasidan oldin ham loyiha build bo'ladi (CI va yangi dasturchi uchun) |
| 4 | Reliz debug kalit bilan imzolanardi | `android/key.properties` dan o'qiydigan `signingConfigs` qo'shildi; fayl bo'lmasa debug kalitga tushadi (`flutter run --release` ishlashi uchun). `key.properties` va `.jks` — `.gitignore` da |
| 5 | Manifest'da ruxsatlar yo'q | `INTERNET`, `POST_NOTIFICATIONS`, `USE_BIOMETRIC` qo'shildi + FCM standart kanal/ikonka meta-ma'lumotlari |
| 6 | iOS sozlamalari to'liq emas | `NSFaceIDUsageDescription`, `UIBackgroundModes: remote-notification`, Podfile'da `platform :ios, '15.0'` |
| 7 | Standart Flutter ikonkasi | Brend rangidagi hamyon ikonkasi yaratildi (`assets/icon/`), `flutter_launcher_icons` bilan Android adaptive + iOS to'plamlari generatsiya qilindi |
| 8 | Placeholder nomlar | `applicationId`/`namespace`/bundle id → **`uz.mywallet.app`**, ilova nomi → **"My Wallet"** (Android label, iOS `CFBundleDisplayName`, `Uz.appName`) |
| 9 | `.gitignore` da `lib/` naqshi | 🔴 **Jimgina xato**: `admin/src/lib/` (session, firebase-admin, format) ham ignore qilinardi — birinchi commitdan keyin Vercel build tushunarsiz xato berardi. Aniq yo'llarga o'zgartirildi: `/functions/lib/`, `/packages/calc-ts/dist/` |

**Ataylab o'zgartirilmagani:** Dart paket nomi `oylik_byudjet` bo'lib
qoldi. U faqat ichki identifikator (`package:oylik_byudjet/...`),
foydalanuvchiga ko'rinmaydi — uni qayta nomlash talab qilinmagan
refactor bo'lardi.

### Qolgan ishlar — faqat akkaunt va kalit talab qiladi

`docs/DEPLOY.md` da qadamma-qadam yozilgan. Qisqacha:
Firebase loyihasi + Blaze rejasi, `flutterfire configure`, Google
Sign-In uchun SHA-1/SHA-256, reliz keystore, Vercel loyihasi va env
o'zgaruvchilari, Telegram bot, APNs kaliti (iOS uchun).

### 9.1. Rejali ishlar Vercel Cron o'rniga GitHub Actions'da

Reja §13.5 cron'ni Vercel'da yuritishni ko'zda tutgan edi ("loglar bitta
joyda"). **Bepul rejada Vercel cron soni va chastotasi cheklangan**,
bizda esa 5 ta rejali ish bor — shuning uchun ular
`.github/workflows/cron.yml` ga ko'chirildi.

**Nima o'zgardi:** faqat chaqiruvchi. Endpointlar (`/api/cron/*`)
Vercel'da qoladi, mantiq `@byudjet/calc` da, himoya o'sha —
`Authorization: Bearer $CRON_SECRET`, kalitsiz 401.

**Yutuq:** bepul, cron soni cheklanmagan, har bir ishni *Actions → Run
workflow* orqali **qo'lda ham** ishga tushirish mumkin (debug uchun
Vercel Cron'da bunday imkoniyat yo'q).

**Narxi:**
* GitHub 60 kun repo faolligi bo'lmasa rejali workflow'larni o'chiradi
  (email bilan ogohlantiradi, bir bosishda qayta yoqiladi);
* Actions cron aniq daqiqada ishlamaydi — bir necha daqiqa kechikishi
  mumkin. Bizning eng qattiq talabimiz kunlik eslatma, shuning uchun
  ahamiyatsiz.

Qaytarish oson: `admin/vercel.json` ga `crons` massivini qaytarib qo'yish
kifoya — endpointlar o'zgarishsiz ishlayveradi.

Shu bilan birga `reconcile` endpointining `maxDuration` qiymati 120 dan
**60** ga tushirildi: bepul rejada funksiya 60 soniyadan oshmaydi.
Bir foydalanuvchi uchun 2 oy ≈ 60–200 hujjat — chegaradan ancha past.
