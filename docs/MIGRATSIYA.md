# Eski tizimdan ko'chirish (Google Sheets → My Wallet)

Eski byudjet Google Sheets'da yuritilgan (v1). Ko'chirish uch qadam:
**eksport** (Sheets → JSON) → **tekshiruv** (dry-run) → **import**.

> **Asosiy shart (BR-181):** har oy uchun Sheets hisoblagan `qoldiq` va
> `orttirgan` yangi tizimdagi qiymatlar bilan **aynan teng** bo'lishi kerak.
> Farq bo'lsa import tugmasi ochilmaydi.

## 1. Eksport (Sheets → JSON)

1. Byudjet jadvalini oching → **Kengaytmalar → Apps Script**.
2. Yangi fayl qo'shing (`+` → **Script**), nomi `Eksport`, ichiga
   `scripts/apps-script-export.gs` mazmunini joylashtiring. Fayl mavjud
   `Code.gs` yonida turishi kerak: yordamchi funksiyalar (`SH`,
   `hammaXulosalar_`, `sozlamalarniOl_` …) o'shanda.
3. Yuqoridagi ro'yxatdan `eksportniSaqla` ni tanlab **Run** bosing va
   so'ralgan ruxsatlarni bering (birinchi marta).
4. Drive'ingizda `my-wallet-export.json` paydo bo'ladi — yuklab oling.

Ma'lumot Google akkauntingizdan chiqmaydi: web-app ham, ommaviy havola ham
kerak emas. Fayl moliyaviy ma'lumot — uni ommaviy joyga qo'ymang.

Namunaviy (anonim) fayl: `scripts/fixtures/legacy-v1.json` — shakli shu.

## 2. Fayl tarkibi (v1)

| Bo'lim | Nimasi |
|---|---|
| `settings.personalFund` | 👤 fond qoidasi: `percent`/`fixed`, qiymat, usul, kun |
| `settings.incomeRules` | daromad turi → oy siljishi (`-1` yoki `0`) |
| `settings.limits` | kategoriya → oylik limit |
| `settings.recurring` | doimiy xarajatlar (nom, kategoriya, summa, kun, avto) |
| `settings.quickAdd` | tez tugmalar |
| `settings.reminders` | eslatma sozlamalari (kun, soat, oylik hisobot kuni) |
| `incomes[]` | `monthKey`, `paidAt`, `type`, `method`, `amount`, `note`, `debtName` |
| `expenses[]` | `monthKey`, `dueDate`, `name`, `category`, `method`, `planned`, `actual`, `note`, `debtName`, `manualMonth`, `autoPay` |
| `personalSpends[]` | fond sarflari: `monthKey`, `spentAt`, `amount`, `purpose`, `method` |
| `debts[]`, `goals[]` | qarzlar va maqsadlar |
| `expectedMonths[]` | Sheets o'zi hisoblagan oylik yakunlar — **etalon** |

Summalar **so'mda** (butun son). Yangi tizimda hamma summa tiyinda (BR-001):
import 100 ga ko'paytiradi.

## 3. Moslashtirish qoidalari (E27-T02)

| Eski | Yangi | Izoh |
|---|---|---|
| Daromad qatori | `transactions (kind=income)` | tur → daromad kategoriyasi; `monthKey` saqlanadi (`budget_month_source = manual`, BR-042) — eski oy taqsimoti o'zgarmaydi |
| Xarajat: reja bor | `planned_items` | `planned` → `planned_amount` (bo'sh — "summasi noma'lum"), `dueDate` → `due_date` |
| Xarajat: fakt bor | `transactions (kind=expense)` | reja bo'lsa — to'lov amali (`planned_item_id` bilan), aks holda oddiy amal |
| `category = "O'zim uchun"` | `transactions (kind=transfer)` | karta/naqd → 👤 fond hisobiga o'tkazma (BR-061); hisobotda `allocation` qatori |
| `personalSpends[]` | `transactions (kind=expense)`, hisob — 👤 fond | hisobotda `fund_spent` qatori (BR-063) |
| `method` | `Karta` / `Naqd` hisoblari | byudjetdagi shu nomli hisoblar (yo'q bo'lsa — yaratiladi) |
| `debtName` | `transactions.debt_id` | qarz nomi bo'yicha (registrsiz); topilmasa — ogohlantirish |
| `manualMonth` (K ustuni) | `budget_month_source = manual` | oy qo'lda tanlangan bo'lsa saqlanadi |
| `autoPay` | `recurring_rules.auto_pay` | doimiy rejadan |
| `debts[]` | `debts` | `total`, `paidBefore` → `paid_before`, `monthly` |
| `goals[]` | `goals` | `target`, `saved`, `monthly`, `deadline` |
| `settings.recurring` | `recurring_rules` | kun, summa, avto to'lov |
| `settings.limits` | `category_limits` | kategoriya bo'yicha |
| `settings.quickAdd` | `quick_actions` | |
| `settings.personalFund` | `households.personal_fund_*` | foiz yoki qat'iy summa, kun, manba hisobi |
| `settings.incomeRules` | `categories.month_shift` | daromad turi uchun (BR-031) |
| `settings.reminders` | `notification_prefs` | soat, necha kun oldin, oylik hisobot kuni |
| `expectedMonths[]` | tekshiruv | dry-run natijasida solishtiriladi |

Yopilgan oylar: import barcha oylarni `months` jadvalida ochiq qoldiradi —
eski oylarni keyin admin paneldan yopish mumkin (BR-150).

## 4. Tekshiruv va import

1. Admin panel → **Vositalar → Eski tizimdan import** (`/h/<byudjet>/legacy`).
2. Faylni tanlang → **Tekshirish (dry-run)**: hech narsa yozilmaydi,
   natija — oylar jadvali (Sheets `qoldiq`/`orttirgan` ↔ yangi tizim) va
   ogohlantirishlar.
3. Farq **0** bo'lgandagina **Import** tugmasi faollashadi.
4. Import bitta tranzaksiyada bajariladi; qayta ishga tushirish xavfsiz —
   har yozuvda `import_batch_id` bo'ladi, takroriy import eski paketni
   almashtiradi (idempotent).

## 5. Parallel davr

Import qilingandan keyin **1 oy** eski jadval faqat o'qish uchun qoldiriladi
(yozuv faqat yangi tizimda). Oy oxirida ikkala tizim yakunlari solishtiriladi
va Sheets arxivga olinadi.
