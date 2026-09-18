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

## Topilgan va tuzatilgan muammolar

| Muammo | Sabab | Yechim |
|---|---|---|
| `health_check` 219 ms, butun jadval skaneri | `account_balances` / `debt_balances` (UNION ALL + GROUP BY) join sharti bilan chaqirilganda Postgres shartni ichkariga tushirmaydi — byudjetning barcha amallari yig'iladi | qoldiq har hisob uchun `private.account_balance(id)` — `account_id`/`to_account_id` indekslari; qarzlar — har qarz uchun lateral (`debt_id` indeksi) |
| "yopilgandan keyin tahrir" tekshiruvi — Seq Scan | `t.id::text = audit.record_id` — PK ishlatilmaydi | avval audit yozuvlari (byudjet + vaqt indeksi), keyin `t.id = record_id::uuid` |
| `report_month` 96 ms | oy yig'indilari ikki marta hisoblanardi (shu oy + barcha oylar) | bitta `month_facts` o'tishi (materialized CTE) |
| O'lchov 2× sekin ko'rinardi | har chaqiruv yangi sessiyada — plpgsql rejalari keshlanmagan | bitta sessiyada qizdirish + o'lchov |

## Eslatmalar

- Eng og'ir qism — butun tarix bo'yicha oylar kesimi (jamg'arma BR-102,
  boshqa oylar o'rtacha daromadi BR-093): 25 000 qator index-only scan
  (`transactions_month_idx`, heap fetch 0) ≈ 12 ms. ADR-03 (agregat
  saqlanmaydi) saqlanadi; yuk 10 yildan oshsa — shu joy birinchi nomzod.
- Mobil ilova dashboard'ni lokal hisoblaydi (ARXITEKTURA 8, 1-qoida) — bu
  hisobotlar admin panel va oylik hisobot ishi uchun.
