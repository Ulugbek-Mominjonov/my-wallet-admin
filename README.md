# 🖥 Oylik byudjet — admin panel va backend

Katta ekran uchun panel (Next.js → Vercel) + **butun backend**: Firestore
qoidalari, indekslar, Cloud Functions, Vercel Cron va Sheets'dan
migratsiya skriptlari.

> **Ishga tushirmoqchimisiz?** → [`docs/YORIQNOMA.md`](docs/YORIQNOMA.md)
> — qadamma-qadam, ~2 soat, har qadamda tekshiruvi bilan.
>
> Mobil ilova va sof Dart domen qatlami **alohida repoda**:
> `oylik-byudjet-app`.

---

## Tuzilma

```
oylik-byudjet-admin/
├── admin/                    # Next.js 15 (Vercel Root Directory = admin)
│   ├── src/app/              #   17 ta route + 5 ta cron endpoint
│   ├── src/server/           #   Server Actions, delta yozuvchi, so'rovlar
│   └── vercel.json           #   cron jadvali
├── packages/calc-ts/         # ★ Domen mantiqining TypeScript porti
├── functions/                # Cloud Functions — faqat onCall + FCM
├── tests/rules/              # Firestore qoidalari testlari (emulyator)
├── scripts/                  # Sheets → Firestore migratsiyasi
├── legacy/apps_script/       # Eski Sheets ilovasi (manba, o'zgartirilmaydi)
├── testdata/                 # Dart repodan sinxronlanadigan fixture'lar
├── firestore.rules
├── firestore.indexes.json
└── firebase.json
```

## Ishga tushirish

```bash
make get                                  # barcha npm bog'liqliklari
make analyze test                         # tip tekshiruvi + testlar
make rules                                # qoidalar testlari (Java kerak)

cd admin && cp .env.example .env.local && npm run dev
```

## Nima qayerda ishlaydi

| Qism | Qayerda | Qanday deploy |
|---|---|---|
| Admin panel | Vercel (Root Directory = `admin`) | har push → preview, `main` → prod |
| Cron (5 ta ish) | **GitHub Actions** (`.github/workflows/cron.yml`) | bepul; `CRON_SECRET` bilan himoyalangan |
| Cloud Functions | Firebase (`onCall` + FCM) | GitHub Actions (`deploy.yml`) |
| Rules / indekslar | Firebase | GitHub Actions (`deploy.yml`) |

### Cron jadvali (UTC, Toshkent = UTC+5)

Rejali ishlar **GitHub Actions** da yuritiladi (Vercel'ning bepul rejasida
cron soni cheklangan). Endpointlar Vercel'da qoladi — Actions ularni
`CRON_SECRET` bilan chaqiradi.

| Endpoint | UTC | Toshkent | Nima qiladi |
|---|---|---|---|
| `/api/cron/payment-sweep` | `10 19 * * *` | 00:10 | avto to'lov + holat yangilash |
| `/api/cron/reminder` | `0 4 * * *` | 09:00 | kunlik eslatma (FCM + Telegram) |
| `/api/cron/reconcile` | `0 22 * * *` | 03:00 | 🩺 agregatni qayta hisoblash |
| `/api/cron/monthly-report` | `0 4 21 * *` | 21-kuni 09:00 | oylik hisobot |
| `/api/cron/open-month` | `0 20 28-31 * *` | oy oxiri 01:00 | keyingi oyni tayyorlash |

Har birini **qo'lda ham** ishga tushirish mumkin:
*Actions → Cron → Run workflow → endpoint tanlash*.

## ⚠️ Fixture'lar — mobil repo bilan shartnoma

`packages/calc-ts` — Dart domen qatlamining porti. Ikkalasi **bir xil
natija berishi** `testdata/aggregate-cases.json` orqali kafolatlanadi.
Fayl **`oylik-byudjet-app` repoda yaratiladi** (Dart generatori), bu yerga
sinxronlanadi:

```bash
make sync-fixtures                    # standart: ../oylik-byudjet-app dan
make sync-fixtures APP_REPO=/boshqa/yo'l
npm --prefix packages/calc-ts test    # parite tekshiruvi
```

Dart tomonda `calc/` o'zgarsa, avval u yerda `make fixtures`, keyin bu
yerda `make sync-fixtures` — aks holda TS testlari qulaydi (shu ataylab).

## Migratsiya (Sheets → Firestore)

```bash
# 1. legacy/apps_script/Code.gs ga scripts/apps-script-export.gs ni qo'shing
# 2. JSON oling:
curl "https://script.google.com/.../exec?action=export&k=KALIT" > export.json
# 3. Import (oxirida Sheets yakunlari bilan AVTOMATIK solishtiriladi):
FIREBASE_SERVICE_ACCOUNT=$(base64 -w0 key.json) \
  node scripts/import-from-sheets.mjs export.json --uid=UID
```

## Testlar

| Nima | Qayerda | Soni |
|---|---|---|
| TS port + Dart pariteti | `packages/calc-ts/test/fixtures.test.ts` | 61 |
| TS qoidalar | `packages/calc-ts/test/rules.test.ts` | 25 |
| Xavfsizlik qoidalari | `tests/rules/` (emulyator) | 16 |

**Yo'riqnoma:** [`docs/YORIQNOMA.md`](docs/YORIQNOMA.md) — 9 qadamlik
to'liq ro'yxat (ikkala repo uchun).
**Texnik tafsilotlar:** [`docs/DEPLOY.md`](docs/DEPLOY.md).

Arxitektura va qarorlar: [`docs/ARXITEKTURA.md`](docs/ARXITEKTURA.md),
[`docs/QARORLAR.md`](docs/QARORLAR.md).
