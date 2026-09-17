# Arxitektura

## Ikkita repo va ular orasidagi chegara

Loyiha **ikkita mustaqil git repoga** bo'lingan — ular alohida jamoa,
alohida CI va alohida reliz tsikliga ega bo'lishi mumkin:

```
  ┌─── oylik-byudjet-app ────────┐   ┌─── oylik-byudjet-admin ──────────┐
  │                              │   │                                  │
  │  app/          (Flutter)     │   │  admin/       (Next.js → Vercel) │
  │      │                       │   │      │                           │
  │  packages/data_firebase      │   │  packages/calc-ts  (TS port)     │
  │      │                       │   │      │                           │
  │  packages/domain (SOF DART)  │   │  functions/ · tests/rules/       │
  │      │                       │   │  firestore.rules · indexes       │
  │      ▼                       │   │      ▲                           │
  │  testdata/  ────── generator │   │      │  sync-fixtures            │
  │      (KANONIK) ──────────────┼───┼──────┘                           │
  └──────────────────────────────┘   └──────────────────────────────────┘
```

**Repolar orasida KOD ULASHILMAYDI.** Yagona shartnoma —
`testdata/aggregate-cases.json`: Dart uni yaratadi, TS uni tekshiruv
etaloni sifatida ishlatadi. Fayl ikkala repoda ham commit qilinadi va
`make sync-fixtures` bilan ko'chiriladi; drift bo'lsa TS testlari qulaydi.

Nega shunday: ikki implementatsiyani bitta repoga qamash uchun Dart va
Node toolchain'larini bitta CI'da saqlash kerak bo'lardi. Fixture fayli
esa ikkalasini ham bog'lab turadi va **bir tomonlama**: mantiq haqiqati
Dart'da, TS unga ergashadi.

## Qatlamlar va bog'liqlik yo'nalishi

```
  ekranlar   app/ (Flutter)              admin/ (Next.js)
                 │                           │
  mantiq     data_firebase               calc-ts (port)
                 │                           │
  qoidalar   ────┴─── packages/domain ◄──────┘ (fixture orqali)
                      entities · value_objects · calc · usecases
```

**Bog'liqlik faqat pastga qarab ketadi.** `domain` paketi Flutter ham,
Firebase ham, JSON ham bilmaydi. Shu sababli:

* barcha qoidalar soniyalar ichida testdan o'tadi (Firebase emulyatori kerak emas);
* backend almashtirilsa faqat `data_*` paketi qayta yoziladi;
* bir xil mantiq TypeScript'ga ko'chirilib, umumiy fixture'lar bilan
  solishtiriladi — platformalar orasida drift bo'lmaydi.

## Yozuv yo'li (eng muhim oqim)

```
Foydalanuvchi "To'landi" tugmasini bosdi
   │
   ├─► usecase: MarkExpensePaid           (domain, sof Dart)
   │      ├─ validatsiya
   │      ├─ yangi holat: Expense(actual: …, status: paid)
   │      └─ AggregateDelta.forExpense(before, after)
   │             = hissa(after) − hissa(before)
   │
   ├─► WriteCommand { mutations: [UpsertExpense], delta }
   │
   └─► FirestoreBudgetWriter               (data_firebase)
          └─ BITTA WriteBatch:
               • expenses/{id}          ← to'liq hujjat
               • months/{YYYY-MM}       ← FieldValue.increment(...)
               • meta/totals            ← FieldValue.increment(...)
               • debts/{id}             ← FieldValue.increment(...)
```

`batch.commit()` KUTILMAYDI: offline'da u faqat server tasdig'idan keyin
bajariladi, lokal kesh esa allaqachon yangilangan — shuning uchun qoldiq
ekranda **darhol** o'zgaradi.

## O'qish narxi

| Ekran | Hujjat o'qish |
|---|---|
| Xulosa (dashboard) | **2** — `months/{oy}` + `meta/totals` |
| Jamg'arma | ≤ 36 (keshdan) |
| Oy ro'yxatlari | 20–60, faqat ekran ochiq bo'lganda |
| To'lovlar | `status` indeksidan, ≤ 100 |
| Qarzlar | 3–10 (bog'langan yozuvlar hisoblagichlardan — N+1 yo'q) |

## Drift bilan kurash (uch qatlamli himoya)

1. **Property test** — 1000 ta tasodifiy amaldan keyin delta agregati
   noldan hisoblangani bilan aynan teng bo'lishi shart.
2. **Kechki reconciler** — Vercel Cron 03:00 da joriy va oldingi oyni
   qayta hisoblaydi, farqni `meta/health` ga yozadi va tuzatadi.
3. **Umumiy fixture'lar** — Dart va TS implementatsiyalari bitta JSON
   fayldan o'qib, bir xil natija berishi CI'da tekshiriladi.

## Ikki mustaqil fond

|  | 👤 Shaxsiy fond | 🏦 Umumiy jamg'arma |
|---|---|---|
| Kirim | `Xarajat` dagi «O'zim uchun» (fakt) | har oyning qoldig'i |
| Chiqim | `personalSpends` yozuvlari | qo'lda yechish |
| Qoldiq | `personalAllocated − personalSpent` | `income − expense` |

Bu ikkisi **hech qanday ekranda qo'shilmaydi** va bitta «jami» sifatida
ko'rsatilmaydi. Test: `packages/domain/test/calc/funds_calc_test.dart`.
