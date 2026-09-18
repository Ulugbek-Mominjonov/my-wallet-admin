# Golden fixture'lar (E09-T05)

Biznes qoidalarning **yagona tekshiruv to'plami**: server (SQL hisobotlar) va
mobil ilova (Dart — lokal hisob-kitob, ARXITEKTURA 8, 1-qoida) bir xil
holatdan bir xil natija chiqarishi shart.

- Server: `make contract-test` — har holatni lokal bazaga haqiqiy yozuv yo'li
  bilan yozadi (triggerlar, cheklovlar), RPC'ni chaqiradi va natijani
  solishtiradi (`scripts/contract/run.mjs`, har holat ROLLBACK bilan).
- Mobil: `wallet_domain` testlari shu fayllarni o'qib, o'z hisobini solishtiradi.

| Fayl | Nima |
|---|---|
| `month-legacy.json` | eski tizimning 40 ta tasodifiy oy holati — yangi modelga o'girilgan (arifmetika aynan eski tizimdek) |
| `month.json` | BR-091 misoli, BR-040 jadvali, reja holatlari, limitlar, prognoz |
| `savings.json` | jamg'arma jadvali, BR-092 invarianti, shaxsiy fond, yillik jami |
| `debts-goals.json` | qarzlar (4 holat), maqsadlar |

## Format

```jsonc
{
  "description": "…",
  "cases": [{
    "name": "…",                 // noyob, o'qiladigan nom
    "rules": ["BR-091"],         // tekshiriladigan qoidalar
    "today": "2026-08-31",       // byudjet vaqt zonasidagi "bugun"
    "setup": { … },              // boshlang'ich holat (quyida)
    "expect": [{                 // chaqiriladigan RPC'lar
      "rpc": "report_month",
      "args": { "month": "2026-08-01" },
      "result": { … }            // javobning QISMI (quyida)
    }]
  }]
}
```

**Summalar** — tiyinda (so'm × 100), asosiy valyuta UZS. **Oylar** — `YYYY-MM-01`.

### `setup`

Yangi foydalanuvchi ro'yxatdan o'tgan holatdan boshlanadi: standart
kategoriyalar (o'zbekcha nomlar, `contracts/api.md`) va hisoblar — kalitlari
`cash` (Naqd), `card` (Karta), `fund` (Shaxsiy fond); fond qoidasi 10%.

| Maydon | Qatorlar |
|---|---|
| `household.fund` | `{mode, percent, fixed_amount, day}` |
| `categories` | `{name, kind, month_shift?, parent?}` — qo'shimcha kategoriyalar |
| `accounts` | `{key, name, type, currency?, opening_balance?}` — qo'shimcha hisoblar |
| `opening_balances` | `{ "<hisob kaliti>": summa }` — standart hisoblar uchun |
| `limits` | `{category, amount}` |
| `debts` | `{key, name, direction, total, paid_before?, monthly_payment?}` |
| `goals` | `{name, target, saved?, monthly?, deadline?, account?}` |
| `plans` | `{key, kind, name, category?, account?, planned (null — noma'lum), due, month, debt?, system?}` |
| `transactions` | `{kind, account, to?, amount, to_amount?, category?, date, month?, plan?, settle?, debt?, payee?}` |

- `transactions[].month` berilsa — qo'lda tanlangan oy (`manual`); berilmasa
  server qoidasi (BR-040..046) hisoblaydi.
- `settle: true` — to'lovdan keyin reja qo'lda yopiladi (eski tizimda har
  qanday to'lov rejani to'lagan hisoblanardi).
- Fond hisobidan kategoriyasiz xarajat — "O'zim uchun" (BR-062).

### `result` — solishtirish qoidasi

- Obyektda faqat ko'rsatilgan kalitlar tekshiriladi (qolganlari e'tiborsiz).
- Javobdagi `name` maydonli obyektlar massivi (`by_type`, `by_category`,
  `unpaid`, `debts`, `goals`) kutilgan qiymatda **nom → obyekt** lug'ati
  sifatida yoziladi; nomlar to'plami aynan mos bo'lishi shart.
- Boshqa massivlar — uzunligi va tartibi bilan.
- Raqamlar aniq teng (nisbatlar 4 xonagacha yaxlitlangan).
