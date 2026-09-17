# Oylik Byudjet — Flutter + Firebase mobil ilova rejasi

> Manba: `Code.gs` (v28, Google Apps Script) + `Ilova.html` (mobil web-app).
> Maqsad: Sheets'dagi **butun biznes logikani** to'liq qamrab olgan, kengayadigan,
> offline ishlaydigan native mobil ilova.
>
> Sana: 2026-09-16 · Holat: **reja (implementatsiya boshlanmagan)**

---

## 0. Qisqacha xulosa (TL;DR)

| Qatlam | Tanlov | Sabab |
|---|---|---|
| UI | Flutter 3.x (Material 3) | bitta kod — Android + iOS |
| State | Riverpod 2 (codegen) + freezed | testlanadigan, compile-time xavfsiz DI |
| Navigatsiya | go_router | deep-link, bottom-nav shell |
| DB | Cloud Firestore | offline-first, realtime, per-user izolyatsiya |
| Auth | Firebase Auth (Google + anonim) | bitta foydalanuvchi, keyin ko'p qurilma |
| Backend | Vercel Cron (rejali ishlar) + Cloud Functions `onCall` | biznes logika klientda — offline ishlashi shart |
| Hisob-kitob | **Pure Dart `domain/calc`** | Firebase'siz, 100% unit-test bilan qoplangan |
| Bildirishnoma | FCM + flutter_local_notifications + Telegram Bot | Sheets'dagi funksiyaning davomi |
| Admin panel | Next.js 15 + Tailwind + shadcn/ui | katta ekranda jadval, import, tahlil |
| Hosting | **Vercel** (admin + cron) + Firebase | preview deploy, instant rollback, Cron |

**Eng muhim arxitektura qarori:** Sheets'da har safar *barcha qatorlar* qayta o'qilib
hisoblanadi. Firestore'da bu qimmat (har hujjat = 1 read). Shuning uchun:

> **Oylik agregat hujjatlari (`months/{YYYY-MM}`) yoziladigan paytda `FieldValue.increment()`
> bilan delta-yangilanadi.** Dashboard = **2 ta hujjat o'qish**, N ta emas.
> Xatolikni tuzatish uchun kechasi ishlaydigan **reconciler** bor (Sheets'dagi
> `🩺 Tekshirish va tuzatish` ning aynan analogi).

---

## 1. Domen modeli (Sheets → Dart)

### 1.1 Asosiy tushunchalar

| Sheets | Dart entity | Izoh |
|---|---|---|
| `Daromad` | `Income` | avans / oylik / KPI / qo'shimcha; karta yoki naqd |
| `Xarajat` | `Expense` | reja + fakt; doimiy yoki bir martalik |
| `O'zim uchun` | `PersonalSpend` | shaxsiy fonddan sarf |
| `Jamg'arma` | `MonthSummary.carried` | **hisoblanadi, saqlanmaydi** |
| `Qarzlar` | `Debt` | ikki yo'nalish: men qarzdorman / menga qarzdor |
| `Maqsadlar` | `Goal` | to'planish maqsadi + prognoz |
| `Sozlamalar` | `AppSettings`, `RecurringExpense`, `CategoryLimit`, `QuickAdd`, `IncomeRule` | |
| `Hisobot` / `Yillik` | `MonthSummary`, `OverallTotals` | agregat hujjatlar |

### 1.2 Pul turi

```dart
/// Pul HAR DOIM butun son (so'm). double ishlatilmaydi — yaxlitlash xatosi bo'lmasin.
extension type const Money(int soum) implements int {
  Money operator +(Money o) => Money(soum + o.soum);
  Money operator -(Money o) => Money(soum - o.soum);
  static const zero = Money(0);
}
```

### 1.3 Oy kaliti (`monthKey`)

```dart
/// 'YYYY-MM' — Firestore'da string, indeks va tenglik so'rovi uchun ideal.
extension type const MonthKey(String value) {
  static final _re = RegExp(r'^\d{4}-(0[1-9]|1[0-2])$');
  MonthKey shift(int months) { ... }   // oySurish_() ning analogi
  static MonthKey of(DateTime d) => MonthKey(DateFormat('yyyy-MM').format(d));
}
```

---

## 2. Biznes qoidalar (Code.gs'dan 1:1 ko'chirilgan)

Bularning **hammasi** `packages/domain/lib/calc/` ichida **sof funksiya** sifatida
yoziladi — Firebase'siz, DateTime.now()'siz (vaqt parametr sifatida uzatiladi).

### 2.1 Daromadning tegishli oyi — `daromadOyi_`

```
tegishliOy = monthOf(olinganSana).shift(qoida[turi])
```

| Tur | Siljish | Sabab (foydalanuvchi) |
|---|---|---|
| Oylik (1–3-sana) | **−1** | oldingi oyning oyligi |
| KPI (5–8-sana) | **−1** | oldingi oyning KPI'si |
| Avans (15–17-sana) | **0** | joriy oyniki |
| Qo'shimcha (15–20) | **−1** | oldingi oyning puli |

Qoidalar `settings/incomeRules` da — foydalanuvchi o'zgartira oladi.
**Muhim:** qoida o'zgarsa eski yozuvlarning `monthKey` i **qayta hisoblanishi** kerak
(§6.5 — `recalcMonthKeys` batch job).

### 2.2 Xarajatning tegishli oyi — `xarajatOyi_`

```
tegishliOy = qo'lda ko'rsatilgan oy ?? monthOf(to'lovSanasi)
```
`monthKeySource: auto | manual` maydoni bilan saqlanadi.
(Misol: 5-oktabrdagi mashina to'lovi → `manual: 2026-09`.)

### 2.3 Oylik yakun — `yakunla_`

```
qoldiq      = daromad − xarajat
prognoz     = qoldiq − to'lanmaganJami
karta       = daromadKarta − xarajatKarta
naqd        = daromadNaqd  − xarajatNaqd
orttirgan   = qoldiq + ozimAjratma − ozimSarf     ← "o'zim uchun" sarf emas, cho'ntak almashdi
orttirganFoiz = daromad > 0 ? orttirgan / daromad : 0
```

### 2.4 Ikki mustaqil fond — **ARALASHMAYDI**

| | 👤 Shaxsiy fond | 🏦 Umumiy jamg'arma |
|---|---|---|
| Kirim | `Xarajat` dagi `O'zim uchun` kategoriyasi (fakt) | har oyning `qoldiq` i |
| Chiqim | `PersonalSpend` yozuvlari | qo'lda yechish (kelajakda) |
| Qoldiq | `ajratilgan − sarflangan` | `Σ qoldiq` (xronologik) |
| Saqlash | `meta/totals.personal*` | `meta/totals.savings` |

> Bu ikkisi **hech qachon qo'shilmaydi** va bitta ekranda jami ko'rsatilmaydi.

### 2.5 Jamg'armaning to'planishi

```
toplangan[i] = toplangan[i-1] + qoldiq[oy_i]      // oylar xronologik tartibda
```
Oy hujjatlari kam (yiliga 12 ta) — **klientda** prefix-sum bilan hisoblanadi,
Firestore'da saqlanmaydi (aks holda bir oy o'zgarsa keyingi hammasini yozish kerak bo'lardi).

### 2.6 To'lov holati — `ustunlarniToldir_`

```
fakt > 0                         → ✅ To'landi
fakt == 0 && sana < bugun        → ⚠️ Muddati o'tdi
fakt == 0                        → ⏳ Kutilmoqda
```
**Avto to'lov:** `autoPay == true && reja > 0 && sana <= bugun && fakt == 0` → `fakt = reja`.

> Klientda holat **sanadan real-time hisoblanadi** (ko'rsatish uchun), Firestore'da esa
> so'rov qilish uchun `status` maydoni saqlanadi va kunlik funksiya yangilaydi.

### 2.7 Qarzlar — `qarzlarniHisobla_`

```
ilovadan = menQarzdorman ? Σ(bog'langan XARAJAT fakt) : Σ(bog'langan DAROMAD summa)
qolgan   = max(0, umumiy − oldinTolangan − ilovadan)
qolganOy = oylik > 0 ? ceil(qolgan / oylik) : 0
```
Bog'lanish **aniq `debtId` orqali** (nom bo'yicha taxmin qilinmaydi).
`Fakt` bo'sh bo'lsa qarz kamaymaydi — `pending` sifatida alohida ko'rsatiladi.

### 2.8 Maqsadlar — `maqsadlarniHisobla_`

```
qolgan  = max(0, kerak − yigilgan)
foiz    = min(1, yigilgan / kerak)
oyiga   = maqsadOyligi ?? o'rtachaOrttirish
oylar   = ceil(qolgan / oyiga)
```

### 2.9 Prognoz — `prognozHisobla_`

```
kunlik        = xarajat / o'tganKunlar
oyOxiriSarf   = joriyOy ? kunlik × oydagiKunlar : xarajat
ortachaDaromad= (umumiyDaromad − joriyOyDaromadi) / boshqaOylarSoni
kutilayotgan  = joriyOy ? max(joriyDaromad, ortachaDaromad) : daromad
oyOxiriQoldiq = kutilayotgan − oyOxiriSarf
```
> Daromad oy davomida bo'lib tushgani uchun joriy oyda "hali kelmagan daromad" kutiladi.

### 2.10 "O'zim uchun" rejasi

```
Foiz rejimi:  round(daromad × foiz / 100 / 1000) × 1000     // 1000 so'mgacha yaxlitlanadi
Qat'iy rejim: sozlamadagi summa
```

### 2.11 Yangi oy ochish — `oyniTayyorla_`

Doimiy xarajatlar + "O'zim uchun" qatori yangi oyga ko'chiriladi.
**Idempotent:** bir xil nom shu oyda bor bo'lsa — o'tkazib yuboriladi.
Summasi bo'sh doimiy xarajat = "har oy o'zgaradi" (foydalanuvchi qo'lda kiritadi).

### 2.12 Oyni yopish

`months/{YYYY-MM}.closed = true` → o'sha oy yozuvlarini tahrirlashda ogohlantirish.

---

## 3. Flutter loyiha strukturasi

Feature-first + clean architecture. **Domain qatlami Firebase'ni bilmaydi.**

```
oylik_byudjet/
├── melos.yaml                      # monorepo (ixtiyoriy, lekin tavsiya)
├── packages/
│   ├── domain/                     # ❶ SOF DART — Flutter ham, Firebase ham yo'q
│   │   └── lib/
│   │       ├── entities/           # Income, Expense, Debt, Goal, MonthSummary...
│   │       ├── value_objects/      # Money, MonthKey, PaymentMethod, IncomeType
│   │       ├── calc/               # ★ §2 dagi BARCHA qoidalar — sof funksiyalar
│   │       │   ├── month_attribution.dart
│   │       │   ├── month_summary_calc.dart
│   │       │   ├── delta_calc.dart          # agregat delta (§5.2)
│   │       │   ├── debt_calc.dart
│   │       │   ├── goal_calc.dart
│   │       │   └── forecast_calc.dart
│   │       ├── repositories/       # faqat abstract interfeyslar
│   │       └── usecases/           # AddExpense, MarkPaid, OpenMonth, CloseMonth...
│   └── data_firebase/              # ❷ domain interfeyslarining Firestore implementatsiyasi
│       └── lib/
│           ├── dto/                # freezed + json_serializable, toFirestore/fromFirestore
│           ├── refs.dart           # ★ barcha collection yo'llari YAGONA joyda
│           ├── batch/              # WriteBatch yig'uvchilar (§5.2)
│           └── repositories/
└── app/                            # ❸ Flutter ilova
    └── lib/
        ├── main.dart
        ├── core/  (theme, router, l10n, formatters, errors, logging)
        └── features/
            ├── dashboard/          # Xulosa
            ├── income/
            ├── expenses/
            ├── payments/           # To'lovlar (to'lanmaganlar ro'yxati)
            ├── personal_fund/      # 👤
            ├── savings/            # 🏦
            ├── debts/              # 💳
            ├── goals/              # 🎯
            ├── settings/
            └── notifications/
```

Har bir feature ichida: `presentation/` (screens, widgets), `application/`
(Riverpod providerlar/notifierlar). `data/` va `domain/` — yuqoridagi umumiy paketlarda.

### 3.1 Paketlar

```yaml
flutter_riverpod, riverpod_annotation      # state + DI
freezed, json_serializable                 # immutable modellar
go_router                                  # navigatsiya
firebase_core, firebase_auth, cloud_firestore, firebase_messaging
google_sign_in
intl                                       # uz/ru lokalizatsiya + son formatlash
fl_chart                                   # grafiklar
flutter_local_notifications                # lokal eslatmalar
shared_preferences                         # UI holati (tanlangan oy, tema)
# dev:
build_runner, riverpod_generator, custom_lint, riverpod_lint
very_good_analysis                         # qattiq lint
mocktail, fake_cloud_firestore             # testlar
```

---

## 4. Firestore ma'lumotlar modeli

Hamma narsa `users/{uid}` ostida — bitta foydalanuvchi butun daraxtni egallaydi,
security rules bir qatorda hal bo'ladi, kelajakda oila/jamoa qo'shilsa `members` bilan kengayadi.

```
users/{uid}
│
├── (doc fields)  displayName, email, timezone, currency, createdAt
│
├── meta/
│   ├── totals              ← ★ GLOBAL AGREGAT (1 ta hujjat)
│   └── health              ← reconciler natijasi (oxirgi tekshiruv, drift)
│
├── settings/
│   ├── app                 { locale, theme, monthStartDay }
│   ├── personalFund        { mode: 'percent'|'fixed', value, method, day }
│   ├── incomeRules         { avans: 0, oylik: -1, kpi: -1, qoshimcha: -1 }
│   ├── reminders           { telegramEnabled, chatIdRef, email, daysAhead, hour,
│   │                         monthlyEnabled, reportDay }
│   └── (subcollections)
│       ├── limits/{id}     { category, monthlyLimit }
│       ├── recurring/{id}  { name, category, amount?, method, day, autoPay, active }
│       ├── quickAdd/{id}   { name, amount, category, method, order }
│       └── categories/{id} { name, icon, color, kind: 'expense'|'income', order }
│
├── months/{YYYY-MM}        ← ★ OYLIK AGREGAT (§4.1)
│
├── incomes/{id}
├── expenses/{id}
├── personalSpends/{id}
├── debts/{id}
└── goals/{id}
```

### 4.1 `months/{YYYY-MM}` — oylik agregat (dashboard'ning yagona manbai)

```jsonc
{
  "monthKey": "2026-09",
  "income": 12000000, "incomeCard": 8000000, "incomeCash": 4000000,
  "expense": 9500000, "expenseCard": 6000000, "expenseCash": 3500000,
  "planned": 10200000,          // reja jami
  "unpaidTotal": 700000,        // fakt bo'sh qatorlarning rejasi
  "unknownCount": 1,            // rejasi ham yo'q (summasi o'zgaruvchi)
  "personalAllocated": 1500000, // "O'zim uchun" kategoriyasi (fakt)
  "personalSpent": 400000,      // PersonalSpend yozuvlari
  "byType":     { "Oylik": {"card":..,"cash":..}, "KPI": {...} },
  "byCategory": { "Oziq-ovqat": {"planned":..,"actual":..} },
  "closed": false,
  "version": 1,                 // reconciler uchun
  "updatedAt": <serverTimestamp>
}
```

`balance`, `saved`, `forecast` — **saqlanmaydi**, klientda `MonthSummaryCalc` hisoblaydi
(§2.3). Sabab: hosila qiymatni saqlash = ikki manba = drift.

### 4.2 `meta/totals`

```jsonc
{
  "income": .., "expense": ..,
  "personalAllocated": .., "personalSpent": ..,   // 👤 fond = allocated − spent
  "savings": ..,                                  // 🏦 = Σ(oylik qoldiq)
  "monthCount": 14,
  "firstMonth": "2025-08", "lastMonth": "2026-09",
  "updatedAt": ..
}
```

### 4.3 `expenses/{id}`

```jsonc
{
  "name": "Mashina to'lovi",
  "category": "Qarz",
  "method": "card",
  "planned": 5300000,
  "actual": 5300000,              // 0 yoki null = to'lanmagan
  "dueDate": <Timestamp>,
  "monthKey": "2026-09",          // ★ so'rov kaliti
  "monthKeySource": "manual",     // auto | manual
  "status": "paid",               // paid | pending | overdue   ← so'rov uchun
  "debtId": "debt_mashina",       // null bo'lishi mumkin
  "recurringId": "rec_mashina",   // qaysi doimiy shablondan
  "autoPay": true,
  "note": "",
  "createdAt": .., "updatedAt": ..
}
```

### 4.4 Kerakli composite indekslar

| Kolleksiya | Indeks | Nima uchun |
|---|---|---|
| `expenses` | `monthKey` ↑, `dueDate` ↑ | oy bo'yicha ro'yxat |
| `expenses` | `status` ↑, `dueDate` ↑ | to'lanmaganlar / avto to'lov skani |
| `expenses` | `debtId` ↑, `dueDate` ↓ | qarz tarixi |
| `expenses` | `monthKey` ↑, `category` ↑ | kategoriya drill-down |
| `incomes` | `monthKey` ↑, `paidAt` ↓ | oy daromadi |
| `personalSpends` | `monthKey` ↑, `spentAt` ↓ | fond tarixi |

> `firestore.indexes.json` loyihada saqlanadi va CI'da deploy qilinadi.

---

## 5. ★ DB yuklamasini kamaytirish strategiyasi

> Bu bo'lim global qoidalarning (`N+1 yo'q`, `faqat kerakli ustun`, `bulk/batch`,
> `index`, `kesh`) Firestore'ga moslashtirilgani.

### 5.1 Muammo

Sheets'da `hammaXulosalar_()` **hamma qatorni** o'qib qayta hisoblaydi.
Firestore'da 3 yil ma'lumot ≈ 3000+ hujjat → har ochilishda 3000 read → qimmat va sekin.

### 5.2 Yechim: **delta bilan yangilanadigan agregat** (write-time aggregation)

Har bir yozuv (qo'shish / tahrirlash / o'chirish) **bitta `WriteBatch`** da ketadi:

```dart
// data_firebase/lib/batch/expense_write.dart
WriteBatch buildExpenseWrite(
  WriteBatch b, { Expense? before, Expense? after }) {

  final deltas = AggregateDelta.forExpense(before: before, after: after); // sof Dart, §2
  // deltas: { '2026-09': {expense: +5300000, expenseCard: +5300000,
  //                       'byCategory.Qarz.actual': +5300000, ...},
  //           '2026-10': {...}  }  ← monthKey o'zgargan bo'lsa ikkala oy

  if (after != null) b.set(refs.expense(after.id), after.toFirestore());
  else               b.delete(refs.expense(before!.id));

  for (final e in deltas.entries) {
    b.set(refs.month(e.key),
          { for (final f in e.value.entries) f.key: FieldValue.increment(f.value),
            'monthKey': e.key, 'updatedAt': FieldValue.serverTimestamp() },
          SetOptions(merge: true));
  }
  b.set(refs.totals, deltas.totals.incrementMap(), SetOptions(merge: true));
  if (after?.debtId != null || before?.debtId != null) {
    b.set(refs.debt(...), {'paidFromApp': FieldValue.increment(deltas.debtDelta)},
          SetOptions(merge: true));
  }
  return b;
}
```

**Nega aynan shunday:**

| Xususiyat | Foyda |
|---|---|
| `FieldValue.increment()` | **read qilmasdan** yozadi — 0 ta o'qish, atomar |
| `WriteBatch` | bitta atomar operatsiya, `transaction` dan farqli — **offline ishlaydi** |
| Delta sof Dart'da | 100% unit-test bilan qoplanadi, Firebase kerak emas |
| `merge: true` | oy hujjati yo'q bo'lsa o'zi yaratiladi |

> ⚠️ `runTransaction` **offline ishlamaydi** (serverga murojaat talab qiladi).
> Shuning uchun agregat yangilash uchun **batch + increment** ishlatiladi, transaction emas.

### 5.3 O'qish narxi

| Ekran | Hujjat o'qish | Izoh |
|---|---|---|
| **Dashboard (Xulosa)** | **2** | `months/{oy}` + `meta/totals` |
| Jamg'arma (barcha oylar) | ≤ 24 | `months` kolleksiyasi, keshdan |
| Daromad ro'yxati (oy) | 5–15 | faqat ochilganda, `limit(50)` + pagination |
| Xarajat ro'yxati (oy) | 20–60 | faqat ochilganda |
| To'lovlar | 0–20 | `status != paid` filtri |
| Qarzlar / Maqsadlar | 3–10 | kichik kolleksiya, uzoq kesh |

**Sheets'dagi variant:** har ochilishda ~3000 o'qish → **Firebase variantida 2 ta.**

### 5.4 Amaliy qoidalar (majburiy)

1. **Listener faqat kerakli joyda.** Dashboard'da `snapshots()` faqat `months/{joriyOy}`
   va `meta/totals` ga. Ro'yxatlarga `snapshots()` **faqat ekran ochiq bo'lganda**
   (`ref.autoDispose` + `keepAlive` faqat joriy oy uchun).
2. **N+1 yo'q.** Qarz tarixi kerak bo'lsa — `where('debtId', isEqualTo: id)` bitta so'rov,
   har qarz uchun alohida so'rov **emas**.
3. **`limit()` majburiy.** Cheksiz ro'yxat yo'q — `limit(50)` + `startAfterDocument()`.
4. **Faqat kerakli maydon.** Ro'yxatda og'ir maydonlar (uzun izoh, biriktirma) kerak emas —
   kelajakda ular alohida `expenseDetails/{id}` ga chiqariladi.
5. **Offline persistence yoqilgan** (`Settings(persistenceEnabled: true)`),
   `cacheSizeBytes: 100MB`. Bir marta o'qilgan oy — qayta o'qilmaydi.
6. **`GetOptions(source: Source.cache)`** — statik ma'lumot uchun (kategoriyalar, limitlar).
7. **Batch ≤ 500 operatsiya.** "Yangi oy ochish" 30 ta doimiy xarajat yozsa ham bitta batch.
8. **Yozuv sonini kamaytir:** hot document (`meta/totals`) sekundiga ~1 yozuvdan oshmasin.
   Bitta foydalanuvchi uchun bu hech qachon muammo emas; oilaviy rejimda `totals` shardlanadi.
9. **Denormalizatsiya ataylab:** `byCategory` / `byType` map'lari oy hujjati ichida —
   kategoriya kesimi uchun alohida so'rov kerak emas.

### 5.5 Reconciler (drift tuzatuvchi) — `🩺` ning analogi

Client-side agregat tezkor, lekin nazariy jihatdan xato yig'ilishi mumkin
(app crash batch o'rtasida, qo'lda Firestore konsolidan tahrirlash, migratsiya).

**Yechim:** `reconcileMonth` Cloud Function:
- **Trigger:** har kecha 03:00 (joriy + oldingi oy) yoki foydalanuvchi "🩺 Tekshirish" tugmasini bossa.
- **Ish:** o'sha oy hujjatlarini to'liq o'qib agregatni **noldan** hisoblaydi va solishtiradi.
- **Natija:** `meta/health` ga yoziladi: `{lastRun, checkedMonths, drift: {...}, fixed: n}`.
- **Narx:** oyiga ~60 ta hujjat o'qish × 2 oy = arzon, kunda 1 marta.

> Bu Sheets'dagi `tashxisSkan_` + `tamirla_` falsafasining aynan davomi:
> **avtomatik aniqla → avtomatik tuzat → hisobot ko'rsat.**

---

## 6. Cloud Functions (TypeScript, 2nd gen)

Funksiyalar **minimal** — biznes logika klientda (sof Dart'da) turadi, chunki u
offline ham ishlashi kerak. Serverda faqat klient qila olmaydigan ish qoladi.

| Funksiya | Trigger | Vazifa |
|---|---|---|
| `dailyPaymentSweep` | Scheduler 00:10 (Asia/Tashkent) | `status: pending && dueDate <= bugun` → `overdue`; `autoPay` bo'lsa `actual = planned`, agregat delta |
| `dailyReminder` | Scheduler, sozlamadagi soat | Kechikkan / bugungi / yaqin to'lovlar → FCM + Telegram |
| `monthlyReport` | Scheduler, `reportDay` (default **21**) | O'tgan oy yakuni → Telegram + email |
| `reconcileAggregates` | Scheduler 03:00 + `onCall` | §5.5 |
| `recalcMonthKeys` | `onCall` | `incomeRules` o'zgarganda eski yozuvlarni qayta joylash |
| `openNextMonth` | Scheduler oyning 1-sanasi + `onCall` | Doimiy xarajatlarni yangi oyga ko'chirish (idempotent) |
| `exportBackup` | Scheduler haftalik | JSON backup → Cloud Storage |

> ⚠️ **Yangilanish (§13.5):** admin panel Vercel'da bo'lgani uchun yuqoridagi
> **rejali (Scheduler) ishlar Vercel Cron'ga ko'chiriladi** — loglar bitta joyda bo'ladi.
> Cloud Functions'da faqat `onCall` (`reconcileAggregates`, `recalcMonthKeys`) va
> FCM yuborish qoladi. Mantiq `packages/calc-ts` da bo'lgani uchun ikki tomonga ham
> ko'chirish arzon.

**Muhim:** `onWrite` triggeri agregat uchun **ishlatilmaydi** — klient batch allaqachon
delta yozdi, trigger ham yozsa **ikki marta hisoblanadi**. Serverda faqat reconciler.

**Sirlar:** Telegram bot token, chat ID → **Secret Manager**
(`defineSecret('TELEGRAM_BOT_TOKEN')`). Kodga hech qachon yozilmaydi.
*(Global qoida: "Secret/token/parol kodga yozilmaydi — env/config orqali".)*

### 6.1 Hisobot kuni nega 21?

Foydalanuvchining daromadi oyning ~20-sanasigacha to'liq tushadi (oylik 1–3, KPI 5–8,
avans 15–17, qo'shimcha 15–20). 1-sanada hisobot yuborilsa oldingi oy **to'liq emas** bo'ladi.
Shuning uchun default `reportDay = 21` + "daromad odatdagidan 40% kam" ogohlantirishi saqlanadi.

---

## 7. Xavfsizlik

### 7.1 Firestore rules

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;

      match /{document=**} {
        allow read: if request.auth != null && request.auth.uid == uid;
        allow write: if request.auth != null && request.auth.uid == uid
                     && validPayload();
      }
      // meta/health — faqat server yozadi
      match /meta/health { allow write: if false; }
    }
    function validPayload() {
      return request.resource.data.keys().hasOnly(ALLOWED)
          && (!('planned' in request.resource.data)
              || request.resource.data.planned is int);
    }
  }
}
```

- Rules **emulator testlari** bilan qoplanadi (`@firebase/rules-unit-testing`).
- App Check (Play Integrity / DeviceCheck) yoqiladi.
- `months` va `meta/totals` ga klient yozadi (delta) — bu **ataylab**, offline uchun.
  Xatoni reconciler tuzatadi. Agar keyinchalik ko'p foydalanuvchi qo'shilsa, bu
  hujjatlar server-only qilinadi va delta `onWrite` triggeriga ko'chiriladi.

### 7.2 Boshqa

- Auth: Google Sign-In; anonim boshlab keyin link qilish mumkin.
- Lokal himoya: PIN / biometrika (`local_auth`) — moliyaviy ilova uchun.
- `google-services.json` / `GoogleService-Info.plist` — `.gitignore`da emas
  (public config), lekin **API key restrictions** Firebase konsolida yoqiladi.

---

## 8. Ekranlar (Ilova.html ning davomi va kengaytmasi)

Pastki navigatsiya — **5 ta** (mavjud ilovadagidek, lekin native):

| # | Ekran | Tarkib |
|---|---|---|
| 1 | **Xulosa** | Oy tanlash (swipe), QOLDIQ hero, Orttirgan, 4 ta stat (daromad/xarajat/karta/naqd), byudjet progress-bar, prognoz kartasi, daromad turlari bar-chart, kategoriyalar (limit rangi bilan), 👤/🏦 fond plitalari, barcha oylar |
| 2 | **＋ Daromad** | Summa, tur, usul, sana → **"→ Sentabr 2026 oyining daromadi"** live hint; haq/qarzga bog'lash |
| 3 | **－ Xarajat** | Tez qo'shish chiplari, joy, kategoriya, usul, reja/fakt, sana, qarzga bog'lash, **"Qaysi oyning byudjetiga?"** chiplari |
| 4 | **To'lovlar** | To'lanmaganlar (⚠️ kechikkan qizil), summa kiritish + "To'landi", avto to'lov belgisi |
| 5 | **Fondlar** | 👤 shaxsiy fond (qoldiq + sarf formasi + tarix), 🏦 jamg'arma (oylar ro'yxati), 💳 qarzlar (3 holat: bog'lanmagan / bog'langan-to'lanmagan / to'langan), 🎯 maqsadlar |

Sozlamalar — profil ikonkasi orqali: doimiy xarajatlar, limitlar, tez tugmalar,
daromad qoidalari, eslatmalar, oyni yopish/ochish, 🩺 tekshirish, eksport.

**Dizayn:** Material 3, dinamik rang (Material You), dark mode, gradient header,
katta raqamlar uchun `tabular figures`, so'm formatlash `#,##0`, haptic feedback,
skeleton loading, offline banner ("📴 Oflayn — o'zgarishlar saqlandi, sinxron bo'ladi").

---

## 9. Bildirishnomalar

| Kanal | Nima uchun |
|---|---|
| **FCM push** | Telefon eslatmasi (asosiy) |
| **flutter_local_notifications** | Offline holatda ham ishlaydigan lokal eslatma |
| **Telegram bot** | Mavjud odatni saqlash — kunlik eslatma + oylik hisobot |
| **Email** (`nodemailer` yoki SendGrid) | Oylik hisobot nusxasi |

Telegram integratsiyasi `settings/reminders` da `telegramEnabled` bilan yoqiladi,
token/chatId esa **Secret Manager** da (foydalanuvchi bir marta `/start` bosadi →
`telegramWebhook` funksiyasi chatId ni saqlaydi).

---

## 10. Testlar

| Turi | Qamrov | Vosita |
|---|---|---|
| **Unit (domain/calc)** | **≥ 95%** — §2 dagi har bir qoida | `test` |
| Delta testlari | qo'shish/tahrirlash/o'chirish/oy ko'chirish → agregat to'g'riligi | `test` |
| **Property-based** | tasodifiy 1000 ta yozuv → delta agregati == noldan hisoblangan agregat | `test` + generator |
| Repository | `fake_cloud_firestore` | `test` |
| Rules | Firebase emulator | `@firebase/rules-unit-testing` |
| Widget | asosiy ekranlar | `flutter_test` |
| Integration | to'liq oqim (daromad qo'shish → dashboard yangilanishi) | `integration_test` + emulator |
| Golden | dizayn regressiyasi | `golden_toolkit` |

> **Eng muhim test:** *"delta bilan hisoblangan agregat = noldan hisoblangan agregat"*.
> Bu §5.2 ning to'g'riligini kafolatlaydi va Sheets'dagi barcha "hisob noto'g'ri" xatolarini oldini oladi.

**CI (GitHub Actions):** `analyze` → `test` → `build apk` → emulator rules test.
Lint: `very_good_analysis` + `riverpod_lint` + `custom_lint`.

---

## 11. Sheets → Firebase migratsiyasi

1. **Eksport:** Apps Script'ga `doGet?action=export&k=<kalit>` qo'shiladi — barcha
   sheetlarni JSON qilib beradi (Daromad, Xarajat, O'zim uchun, Qarzlar, Maqsadlar, Sozlamalar).
2. **Import:** bir martalik Dart/Node skript:
   - `monthKey` **saqlanadi** (Sheets allaqachon hisoblab qo'ygan — qayta hisoblanmaydi);
   - hujjatlar ≤500 talik **batch**larda yoziladi;
   - oxirida `reconcileAggregates` chaqiriladi → `months` va `meta/totals` noldan quriladi.
3. **Solishtirish:** import'dan keyin har oy uchun Sheets'dagi `qoldiq`/`orttirgan`
   bilan Firestore agregatini **avtomatik solishtiruvchi** skript ishlaydi. Farq bo'lsa — xato.
4. **Parallel davr:** 1 oy davomida Sheets ham ishlaydi (read-only backup sifatida).

---

## 12. Admin panel (web) — Next.js

Telefon ilovasi **kundalik** foydalanish uchun. Ba'zi ishlar esa katta ekran va
klaviatura talab qiladi — Sheets'ning o'rnini aynan shu bosadi.

### 12.1 Kerakmi? — Ha

Sheets'dan voz kechilsa, quyidagilar uchun boshqa joy qolmaydi:

| Ish | Nega telefonda noqulay |
|---|---|
| Ko'p qatorni tez kiritish / tuzatish | jadval va klaviatura kerak |
| Doimiy xarajatlar shabloni, limitlar, tez tugmalar | ko'p maydonli forma |
| Yillik tahlil, kategoriya kesimi, oylarni taqqoslash | keng ekran, grafiklar |
| 🩺 Tekshirish / reconciler natijasi, drift hisoboti | texnik ma'lumot |
| Import / eksport (CSV, JSON, Sheets'dan ko'chirish) | fayl bilan ishlash |
| Daromad qoidasi o'zgarganda "nechta yozuv ko'chadi" preview | jadval ko'rinishi |

### 12.2 Texnologiya

| | Tanlov | Sabab |
|---|---|---|
| Framework | **Next.js 15 (App Router)** | Vercel'ning native platformasi, RSC + Server Actions |
| Til | TypeScript (strict) | domen turlari bilan mos |
| UI | Tailwind CSS + shadcn/ui | tez, yengil, dark mode tayyor |
| Jadval | TanStack Table v8 | virtualizatsiya, inline tahrirlash, saralash |
| Grafik | Recharts | Flutter'dagi `fl_chart` bilan vizual mos |
| Ma'lumot | **Firebase Admin SDK** (server) + Web SDK (faqat realtime joyda) | yozuv huquqi brauzerga berilmaydi |
| Auth | Firebase Auth (Google) + **session cookie** | `middleware.ts` da tekshiriladi |
| Forma | react-hook-form + zod | validatsiya sxemasi domen bilan bitta manbadan |

### 12.3 Ma'lumot oqimi (muhim)

```
Browser ──(Server Action)──► Next.js server ──(Admin SDK)──► Firestore
   ▲                                                            │
   └──────────── realtime listener (faqat dashboard) ◄──────────┘
```

- **Yozuv har doim Server Action orqali** — Admin SDK bilan. Batch/delta mantiq
  serverda bir joyda turadi, brauzerga yozish huquqi berilmaydi.
- **Delta mantiq ikki marta yozilmaydi.** Uni umumiy TS paketiga chiqaramiz:
  `packages/calc-ts/`. Dart (`packages/domain`) va TS implementatsiyalari
  **bir xil JSON fixture'lar** bilan tekshiriladi — `testdata/aggregate-cases.json`.
  Shunda ikki platforma o'rtasida drift bo'lmaydi.
- Realtime faqat dashboard'da (`onSnapshot` → `months/{oy}` + `meta/totals`).
  Qolgan joylarda **RSC + `revalidateTag`** — ortiqcha listener va ortiqcha o'qish yo'q.

### 12.4 Sahifalar

```
/                      → login (Google)
/dashboard             → joriy oy: qoldiq, orttirgan, prognoz, kategoriyalar
/months                → barcha oylar jadvali + jamg'arma to'planishi (prefix-sum)
/months/[key]          → bitta oy: daromad + xarajat jadvali, inline tahrirlash
/incomes               → filtr (oy, tur, usul), bulk tahrirlash, CSV eksport
/expenses              → filtr (oy, kategoriya, holat), bulk "To'landi", CSV import
/personal-fund         → 👤 ajratma va sarflar (alohida hisob)
/savings               → 🏦 oylik qoldiqlar va to'planish grafigi
/debts                 → qarzlar + bog'langan to'lovlar ro'yxati
/goals                 → maqsadlar + prognoz
/settings/recurring    → doimiy xarajatlar shabloni
/settings/limits       → kategoriya limitlari
/settings/quick        → tez qo'shish tugmalari
/settings/income-rules → daromad turi → oy siljishi (+ "nechta yozuv ko'chadi" preview)
/settings/reminders    → Telegram / email / kun / soat / hisobot kuni
/tools/health          → 🩺 reconciler: drift, oxirgi tekshiruv, "Tuzatish" tugmasi
/tools/import          → Sheets JSON / CSV import (preview → tasdiqlash → batch)
/tools/export          → JSON / CSV backup
/tools/audit           → oxirgi 200 o'zgarish (audit log)
```

### 12.5 DB yuklamasi — admin panelda ham o'sha qoidalar

1. **Server-side rendering + kesh.** Ro'yxat sahifalari RSC'da o'qiladi,
   `unstable_cache` bilan keshlanadi, yozuvdan keyin faqat
   `revalidateTag('month:2026-09')` — butun kesh emas.
2. **Cursor pagination.** `startAfter(lastDoc)`; `offset` **ishlatilmaydi**
   (Firestore offset'da o'tkazib yuborilgan hujjatlar uchun ham pul oladi).
3. **Bulk = bitta batch.** 40 ta to'lovni "To'landi" qilish = 1 batch (41 yozuv),
   40 ta alohida so'rov emas. Agregatga ham **bitta** yig'ma delta.
4. **Agregat sahifalari raw hujjat o'qimaydi** — `months/*` va `meta/totals` yetarli.
5. **Yillik tahlil** = 12 ta oy hujjati, keshda 1 soat.
6. **Audit log alohida kolleksiyada** (`auditLog/{id}`, TTL 90 kun) — asosiy
   so'rovlarni og'irlashtirmaydi.

### 12.6 Xavfsizlik

- `middleware.ts`: session cookie tekshiriladi; `ADMIN_UIDS` ro'yxatida bo'lmasa → 403.
- Admin SDK service-account kaliti **faqat Vercel env** da
  (`FIREBASE_SERVICE_ACCOUNT`, base64 JSON). Repoda yo'q.
- Har bir Server Action: `zod` input validatsiyasi + `uid` tekshiruvi.
- Yozuv operatsiyalari `auditLog` ga tushadi (kim, qachon, nima, eski → yangi).
- Rate limit: `@upstash/ratelimit` + Vercel KV (import/eksport uchun).

---

## 13. Vercel deploy rejasi

### 13.1 Repo tuzilmasi

```
oylik-byudjet/                  # bitta monorepo
├── app/                        # Flutter ilova
├── packages/domain/            # Dart domen (calc)
├── packages/data_firebase/
├── packages/calc-ts/           # ★ TS delta/calc — admin va cron uchun umumiy
├── admin/                      # ★ Next.js → Vercel
├── functions/                  # Cloud Functions (faqat onCall)
├── testdata/                   # Dart va TS uchun UMUMIY fixture'lar
└── firestore.rules, firestore.indexes.json
```

Vercel loyihasida **Root Directory = `admin`**.
`turbo.json` orqali `admin` ↔ `packages/calc-ts` bog'lanadi (Vercel Turborepo'ni taniydi).

### 13.2 Muhitlar

| Vercel muhiti | Firebase loyihasi | Domen |
|---|---|---|
| **Production** (`main`) | `oylik-byudjet-prod` | `byudjet.<domen>.uz` |
| **Preview** (har PR) | `oylik-byudjet-dev` | avtomatik `*.vercel.app` |
| **Development** (lokal) | Firebase **emulator** | `localhost:3000` |

> Preview hech qachon prod ma'lumotiga ulanmaydi — env orqali qattiq ajratilgan.

### 13.3 Environment variables (Vercel dashboard)

| Nom | Turi | Izoh |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | **Secret**, server-only | base64(JSON) |
| `FIREBASE_PROJECT_ID` | plain | |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | public | faqat Auth/realtime uchun |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | public | |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | public | |
| `ADMIN_UIDS` | Secret | vergul bilan ajratilgan uid'lar |
| `TELEGRAM_BOT_TOKEN` | Secret | admin'dan test xabar va cron hisobot |
| `TELEGRAM_CHAT_ID` | Secret | |
| `CRON_SECRET` | Secret | Cron endpoint himoyasi |

Hammasi **Vercel Environment Variables** da. `.env.local` faqat emulator uchun va
`.gitignore` da. *(Global qoida: secret kodga yozilmaydi.)*

### 13.4 Deploy oqimi

```
git push (feature branch)
   ├► Vercel Preview build ─┬─ next build
   │                        ├─ tsc --noEmit
   │                        ├─ eslint
   │                        └─ vitest (calc-ts fixture testlari)
   └► GitHub Actions       ─┬─ dart analyze + flutter test
                            ├─ firebase emulator: rules testlari
                            └─ firestore.indexes.json diff tekshiruvi

PR merge → main
   ├► Vercel Production deploy (avtomatik)
   └► GitHub Actions: firebase deploy --only functions,firestore:rules,firestore:indexes
```

- `vercel.json`: `"regions": ["fra1"]` — Firestore `eur3` bo'lsa latency eng kam.
- **Instant Rollback** yoqiladi — buzilgan deploy bitta tugma bilan qaytariladi.
- Deploy Protection: Preview'lar faqat login bilan ochiladi.

### 13.5 Vercel Cron — rejali ishlar shu yerda

Rejali ishlarni Cloud Scheduler o'rniga **Vercel Cron**'da qilamiz: loglar bitta
joyda, debug oson, alohida hisob-kitob kerak emas.

```json
// vercel.json
{
  "crons": [
    { "path": "/api/cron/payment-sweep",  "schedule": "10 19 * * *" },
    { "path": "/api/cron/reminder",       "schedule": "0 4 * * *"   },
    { "path": "/api/cron/reconcile",      "schedule": "0 22 * * *"  },
    { "path": "/api/cron/monthly-report", "schedule": "0 4 21 * *"  },
    { "path": "/api/cron/open-month",     "schedule": "0 20 L * *"  }
  ]
}
```

> Vaqtlar **UTC**da. Asia/Tashkent = UTC+5 → `19:10 UTC` = `00:10` Toshkent,
> `04:00 UTC` = `09:00` Toshkent (kunlik eslatma), `04:00 UTC 21-sana` = oylik hisobot.

Har bir endpoint birinchi qatorda `Authorization: Bearer ${CRON_SECRET}` ni tekshiradi,
aks holda 401. Mantiq `packages/calc-ts` da — endpoint faqat **o'ram**, shuning uchun
kerak bo'lsa Cloud Functions'ga ko'chirish 10 daqiqalik ish.

**Cloud Functions'da nima qoladi:** faqat `onCall` (ilovadan chaqiriladigan
`reconcile`, `recalcMonthKeys`) va FCM yuborish — chunki ular Firebase Auth
kontekstini to'g'ridan-to'g'ri oladi.

### 13.6 Monitoring

- Vercel Analytics + Speed Insights (bepul tarif yetarli).
- Sentry: `@sentry/nextjs` + `sentry_flutter` — ikkala platforma bitta loyihada.
- Cron natijasi `meta/health` ga yoziladi, admin `/tools/health` da ko'rinadi;
  xato bo'lsa **Telegram'ga ogohlantirish**.

---

## 14. Bosqichlar (roadmap)

| Bosqich | Ish | Natija |
|---|---|---|
| **0. Poydevor** (3–4 kun) | monorepo, lint, CI, Firebase loyiha, Auth, tema, router | bo'sh, lekin ishlaydigan skelet |
| **1. Domen yadrosi** (4–5 kun) | `packages/domain` — §2 ning **hammasi** + testlar | Firebase'siz, 95% qoplama |
| **2. Data qatlami** (3 kun) | DTO, `refs.dart`, batch yozuvchilar, repozitoriylar, rules, indekslar | CRUD + delta agregat ishlaydi |
| **3. Asosiy oqim** (5–7 kun) | Xulosa, Daromad, Xarajat, To'lovlar | kundalik foydalanish mumkin |
| **4. Fondlar** (3–4 kun) | 👤 shaxsiy fond, 🏦 jamg'arma, oylar tarixi | ikki mustaqil hisob |
| **5. Qarz & Maqsad** (3 kun) | bog'lanish, prognoz, progress | |
| **6. Sozlamalar** (3 kun) | doimiy xarajatlar, limitlar, tez tugmalar, daromad qoidalari, oy ochish/yopish | |
| **7. Funksiyalar** (3–4 kun) | avto to'lov, eslatma, oylik hisobot, reconciler, Telegram | |
| **8. calc-ts** (2 kun) | delta/calc mantiqni TS'ga port qilish + umumiy fixture testlari | Dart va TS bir xil natija beradi |
| **9. Admin panel** (5–7 kun) | Next.js: dashboard, oy jadvallari, sozlamalar, import/eksport, 🩺 health | Sheets butunlay almashtirildi |
| **10. Vercel + Cron** (2 kun) | preview/prod muhitlar, env, cron endpointlar, Sentry | avtomatik ishlar serverda |
| **11. Migratsiya** (2 kun) | eksport + import + solishtirish | Sheets ma'lumoti ko'chdi |
| **12. Sayqal** (3–5 kun) | dark mode, animatsiya, offline banner, golden testlar, Play Store | reliz |

**Jami: ~40–52 ish kuni** (bitta dasturchi). Mobil ilova 1–7-bosqichda allaqachon to'liq ishlaydi — admin panel undan keyin qo'shiladi.

---

## 15. Kengayish nuqtalari (bugundan hisobga olingan)

| Kelajak talab | Bugungi tayyorgarlik |
|---|---|
| Oila / umumiy byudjet | Hamma narsa `users/{uid}` ostida → `households/{id}` ga ko'chirish oson; `members` map qo'shiladi |
| Ko'p valyuta | `Money` value object + `currency` maydoni allaqachon bor |
| Bank SMS / chek skaneri | `Expense.source: manual|sms|scan` maydoni bo'sh joyi qoldiriladi |
| Web versiya | Flutter Web — bitta kod bazasi; `data_firebase` o'zgarmaydi |
| Boshqa backend (Supabase/PostgreSQL) | Domain qatlami Firebase'ni bilmaydi → faqat `data_*` paketi almashtiriladi |
| Kategoriya ierarxiyasi | `categories/{id}.parentId` qo'shiladi, agregat `byCategory` kaliti o'zgarmaydi |
| Byudjet konvertlari (envelope) | `months` hujjatiga `envelopes` map qo'shiladi |

---

## 16. Xavf-xatarlar va ularning yechimi

| Xavf | Ehtimollik | Yechim |
|---|---|---|
| Agregat drift (delta xatosi) | o'rta | Property-based test + kunlik reconciler + `meta/health` |
| `incomeRules` o'zgarishi eski yozuvlarni buzadi | past | `recalcMonthKeys` batch job + oldin "nechta yozuv ko'chadi" preview |
| Offline uzoq davom etsa konflikt | past | Firestore last-write-wins; agregat `increment` — konfliktsiz (kommutativ) |
| Hot document (`meta/totals`) | juda past | 1 foydalanuvchi; kerak bo'lsa shardlash |
| Firestore narxi | past | §5.3 — dashboard 2 read; bepul kvota ichida |
| Telegram bot tokeni oshkor bo'lishi | past | Secret Manager, kodda yo'q, repoda yo'q |

---

## 17. "Bajarildi" mezonlari (Definition of Done)

- [ ] `packages/domain` da §2 ning **har bir qoidasi** unit-test bilan qoplangan
- [ ] Property-based test: delta agregat == noldan hisoblangan agregat (1000 ta tasodifiy holat)
- [ ] Dashboard ochilishi **≤ 2 hujjat o'qish** (Firebase konsolida o'lchangan)
- [ ] Aviarejimda daromad/xarajat qo'shish ishlaydi va qoldiq **darhol** yangilanadi
- [ ] 👤 shaxsiy fond va 🏦 jamg'arma **hech qanday ekranda qo'shilmaydi**
- [ ] 1-sentabrda kiritilgan "Oylik" → **avgust** byudjetiga tushadi
- [ ] 5-oktabrdagi mashina to'lovi qo'lda **sentabr**ga biriktirilishi mumkin
- [ ] Qarzga bog'langan xarajat **fakt kiritilgandagina** qarzni kamaytiradi
- [ ] Avto to'lov sanasi kelganda status o'zi o'zgaradi (ilova ochilmasa ham)
- [ ] Rules emulator testlari: boshqa `uid` hech narsani o'qiy olmaydi
- [ ] Sheets'dan import qilingan har oy uchun `qoldiq` va `orttirgan` **aynan mos**
- [ ] `packages/domain` (Dart) va `packages/calc-ts` (TS) **bir xil fixture'larda bir xil natija**
- [ ] Admin panelda 40 ta to'lovni bulk "To'landi" qilish = **1 batch**, agregat bir marta yangilanadi
- [ ] Vercel Preview deploy prod Firestore'ga **ulanmaydi** (env bilan tekshirilgan)
- [ ] Har bir cron endpoint `CRON_SECRET` siz **401** qaytaradi
- [ ] `ADMIN_UIDS` da bo'lmagan foydalanuvchi admin panelning hech bir sahifasini ocholmaydi

