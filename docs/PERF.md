# Ishlash (performance) — hisobotlar

> E09-T07. Tekshiruv: `make perf` (`scripts/perf-check.sh`), CI `db` job'ida
> har push'da. Qoidalar: ARXITEKTURA 8 (DB yuklamasi), ADR-03.

## Usul

- **Yuk** (`scripts/gen-load.sql`): o'lchanadigan byudjet — 10 yil (2016-10 …
  2026-09), **25 000 amal** (daromad, naqd/karta xarajat, har oy fondga ajratma
  va fonddan sarf), har oy 12 reja (1 440). Haqiqiy yozuv yo'li bilan —
  triggerlar va cheklovlar ishlaydi.
- **Shovqin**: yana 9 byudjet × 25 000 amal (replica rejimida, tez) —
  o'lchanadigan byudjet jadvalning ~10% i. Busiz bitta byudjetda "household =
  X" butun jadvalga teng bo'lib, rejalovchi to'g'ri ravishda Seq Scan tanlaydi
  va tekshiruv hech narsani isbotlamaydi.
- **Rejalar**: `auto_explain` (`log_nested_statements`) — plpgsql funksiyalar
  ichidagi har so'rov rejasi; `transactions` yoki `planned_items` da **Seq Scan
  — xato**.
- **Vaqt**: bitta sessiyada 1 qizdirish + 5 o'lchov, mediana (PostgREST
  ulanishlari pool'da — plpgsql rejalari keshlangan holat). Maqsaddan oshsa —
  ogohlantirish, 2× dan oshsa — xato.

## Natijalar

Lokal (16 yadro, Docker'dagi Postgres 17), 2026-09-18:

| Hisobot | Maqsad | Mediana | Seq Scan |
|---|---|---|---|
| `report_month` | < 50 ms | 45 ms | yo'q |
| `report_year` | < 150 ms | 6 ms | yo'q |
| `report_savings` | < 150 ms | 53 ms | yo'q |
| `health_check` | < 100 ms | 23 ms | yo'q |
| `report_insights` (E32-T01, 2026-09-23) | < 80 ms | 3 ms | yo'q |

E23 amallar jadvali (2026-09-22, shu yukda; o'lchanadigan byudjet 25 000 amal):

| So'rov | Maqsad | Mediana | Seq Scan |
|---|---|---|---|
| `transactions_list` — birinchi sahifa | < 20 ms | 2 ms | yo'q |
| `transactions_list` — chuqur sahifa (keyset, 2019) | < 20 ms | 2 ms | yo'q |
| `transactions_list` — mos kelmaydigan qidiruv (eng yomon) | < 50 ms | 1 ms | yo'q |
| `transactions_summary` — oy | < 30 ms | 1 ms | yo'q |
| `payee_suggestions` — "kor" (10% qator mos) | < 30 ms | 5 ms | yo'q |

Qo'lda: keng tarqalgan qidiruv ("karzinka" — xato bilan, 10% qator) ro'yxat
va jami ≈ 12 ms; 2 harfli qidiruv ≈ 2 ms.

E25 audit jurnali (2026-09-23, shu yukda; byudjetda ~25 000 audit yozuvi —
sintetik yukda hammasining vaqti bir xil, ya'ni kursor faqat `id` bilan
ajratadi — eng og'ir holat):

| So'rov | Maqsad | Mediana | Seq Scan |
|---|---|---|---|
| `audit_list` — birinchi sahifa | < 20 ms | 1 ms | — |
| `audit_list` — chuqur sahifa (keyset, 12 000-yozuvdan keyin) | < 30 ms | 2 ms | — |

`audit_log` da Seq Scan tekshirilmaydi: shovqin byudjetlari triggersiz
yoziladi, shuning uchun jadvalning deyarli hammasi o'lchanadigan byudjetniki —
bunda Seq Scan rejalovchining to'g'ri tanlovi. Haqiqiy bazada yozuvlar vaqt
bo'yicha tarqaladi va `audit_log_household_at_idx` ishlaydi.


E28-T03 sinxron (2026-09-23, shu yukda; 25 000 amal, 14 jadval):

| So'rov | Maqsad | Mediana | Izoh |
|---|---|---|---|
| `sync_pull` — birinchi sahifa (500 qator) | < 50 ms | 32 ms | to'liq yuklashda takrorlanadi |
| `sync_pull` — kursor oxirida (0 qator) | < 10 ms | 3 ms | eng tez-tez chaqiruv (har qurilma, har sikl) |

Kundalik yuk aynan shu ikkinchi qator: qurilma sinxronni 6 soatda bir
(WorkManager) va yozuvdan keyin chaqiradi — bo'sh javob 3 ms turadi.
`sync_push` o'lchanmaydi: paket ≤ 100 mutatsiya va har biri o'z
savepoint'ida yoziladi — vaqt yozuv triggerlariga teng (amal yozish bilan
bir xil yo'l).

Mobil sovuq start (E20-T04, emulyator): ~1,5 s — maqsad < 2 s ✅.

## Topilgan va tuzatilgan muammolar

| Muammo | Sabab | Yechim |
|---|---|---|
| `health_check` 219 ms, butun jadval skaneri | `account_balances` / `debt_balances` (UNION ALL + GROUP BY) join sharti bilan chaqirilganda Postgres shartni ichkariga tushirmaydi — byudjetning barcha amallari yig'iladi | qoldiq har hisob uchun `private.account_balance(id)` — `account_id`/`to_account_id` indekslari; qarzlar — har qarz uchun lateral (`debt_id` indeksi) |
| "yopilgandan keyin tahrir" tekshiruvi — Seq Scan | `t.id::text = audit.record_id` — PK ishlatilmaydi | avval audit yozuvlari (byudjet + vaqt indeksi), keyin `t.id = record_id::uuid` |
| `report_month` 96 ms | oy yig'indilari ikki marta hisoblanardi (shu oy + barcha oylar) | bitta `month_facts` o'tishi (materialized CTE) |
| Amallar filtri — har sahifa byudjetning barcha amallarini aylanardi | "(filtr yo'q yoki shart)" statik so'rov + `set search_path` (funksiya inline bo'lmaydi) — umumiy rejada keyset indeksi ishlamaydi | dinamik SQL: faqat faol filtr shartlari (o'zgarmas matn, qiymatlar `using`), kursor doim qator taqqoslash — `transactions_list_idx` |
| Mos kelmaydigan qidiruv 36 ms (25 000 qator Filter) | RLS ostida trgm operatorlari (leakproof emas) indeks sharti bo'lmaydi | sahifa va jami — security definer + aniq a'zolik tekshiruvi; qidiruv — joy+izoh ifodasi bo'yicha bitta GIN indeks → 1 ms |
| O'lchov 2× sekin ko'rinardi | har chaqiruv yangi sessiyada — plpgsql rejalari keshlanmagan | bitta sessiyada qizdirish + o'lchov |

## Eslatmalar

- Eng og'ir qism — butun tarix bo'yicha oylar kesimi (jamg'arma BR-102,
  boshqa oylar o'rtacha daromadi BR-093): 25 000 qator index-only scan
  (`transactions_month_idx`, heap fetch 0) ≈ 12 ms. ADR-03 (agregat
  saqlanmaydi) saqlanadi; yuk 10 yildan oshsa — shu joy birinchi nomzod.
- Mobil ilova dashboard'ni lokal hisoblaydi (ARXITEKTURA 8, 1-qoida) — bu
  hisobotlar admin panel va oylik hisobot ishi uchun.
