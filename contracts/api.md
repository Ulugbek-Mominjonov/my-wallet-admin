# API shartnomasi (RPC)

> Versiya: `schema-version` = 1. Umumiy ko'rinish: `docs/ARXITEKTURA.md` 5–6.
> Har RPC — `POST /rest/v1/rpc/<nom>`, JSON tana, `Authorization: Bearer <JWT>`
> (anon uchun faqat `apikey`).

## Xato formati

PostgREST: `{ "code": "<SQLSTATE>", "message": "...", "details": ..., "hint": ... }`.
Biznes xatolar `P0001` bilan va `message` = mashina o'qiydigan kod
(masalan `planned_already_paid`) — ro'yxat E08-T07 da to'ldiriladi.

## `health()` — anon

Keep-alive va smoke testlar.

```json
// javob
{ "ok": true, "time": "2026-09-18T07:30:00.123+00:00", "schema_version": 1 }
```

## Biznes xato kodlari (`P0001`, `message`)

| Kod | Ma'nosi |
|---|---|
| `unauthorized` | sessiya yo'q |
| `forbidden` | bu byudjetda rol yetarli emas |
| `invalid_name` | nom bo'sh yoki 80 belgidan uzun |
| `invalid_role` | ruxsat etilmagan rol (masalan taklifda `owner`) |
| `invite_not_found` / `invite_used` / `invite_expired` | taklif kodi holatlari (BR-012) |
| `already_member` | foydalanuvchi allaqachon a'zo |
| `not_member` | ko'rsatilgan foydalanuvchi a'zo emas |
| `last_owner` | oxirgi owner chiqib keta olmaydi / roli tushirilmaydi (BR-014) |
| `use_transfer_ownership` | owner roli faqat `transfer_ownership` orqali |
| `use_leave_household` | o'zini chiqarish — `leave_household` orqali |
| `invalid_target` | noto'g'ri nishon (masalan egalikni o'ziga o'tkazish) |
| `system_account` | 👤 shaxsiy fond hisobi: turi o'zgarmaydi, o'chirilmaydi, arxivlanmaydi (BR-020) |
| `system_category` | tizim kategoriyasi o'chirilmaydi, arxivlanmaydi, subkategoriya bo'lmaydi (BR-033) |
| `account_in_use` | hisob ishlatilmoqda (fond manbai, doimiy reja, tez tugma) — arxivlang (BR-024) |
| `category_in_use` | kategoriya ishlatilmoqda (subkategoriya, doimiy reja, limit, tez tugma) — arxivlang yoki birlashtiring (BR-036) |
| `account_deleted` / `category_deleted` | o'chirilgan hisob/kategoriyaga yangi havola |
| `category_kind_mismatch` | kategoriya turi mos emas (masalan xarajat rejasiga daromad turi) |
| `invalid_parent` | subkategoriya faqat bir daraja va ota bilan bir turda (BR-034) |
| `invalid_account` | bu amal uchun hisob yaroqsiz (masalan fond ajratmasi manbai — fondning o'zi) |
| `invalid_fund_source` | fond manbai — shu byudjetning tirik, arxivlanmagan, fond bo'lmagan hisobi (BR-060) |
| `account_currency_locked` | amali (yoki bog'langan maqsadi) bor hisob valyutasi o'zgarmaydi (BR-026) |
| `debt_deleted` / `debt_kind_mismatch` | o'chirilgan qarz; qarz yo'nalishi amal turiga mos emas (i_owe ← xarajat, owed_to_me ← daromad — BR-111) |
| `debt_in_use` | qarzga amal, reja yoki doimiy reja bog'langan — arxivlang |
| `currency_mismatch` | valyutalar mos emas (qarzga bog'langan amal, hisobga bog'langan maqsad) |
| `planned_deleted` / `planned_skipped` | o'chirilgan yoki o'tkazib yuborilgan rejaga to'lov |
| `planned_kind_mismatch` | reja va amal turi mos emas (ajratma rejasi — faqat byudjet hisobidan fondga o'tkazma) |
| `planned_in_use` | to'lovi bor reja o'chirilmaydi — o'tkazib yuboring (`skipped_at`) |
| `to_amount_required` | turli valyutali o'tkazmada manzil summasi majburiy (BR-193) |
| `fx_rate_missing` | amal sanasi uchun kurs yo'q — `fx_rate` kiriting (BR-191, BR-192) |
| `month_closed` | qattiq qulf: yopilgan oyga yozish/tahrirlash/o'chirish mumkin emas (BR-055) |
| `tag_deleted` | o'chirilgan teg qo'yilmaydi |
| `planned_not_found` / `planned_already_paid` | reja topilmadi; allaqachon to'langan (BR-073) |
| `amount_required` / `invalid_amount` | summa kiritilishi shart (summasiz reja yoki boshqa valyutadagi hisob); summa ≤ 0 |
| `account_required` / `account_not_found` | hisob tanlanmagan; nom/ID bo'yicha hisob topilmadi (`details` — nom) |
| `category_not_found` | kategoriya topilmadi (`details` — nom) |
| `preview_outdated` | preview'dan keyin ma'lumot o'zgargan — preview'ni qayta oling (BR-043) |
| `month_not_finished` | tugamagan oyni yopib bo'lmaydi (BR-150) |
| `month_shift_mismatch` | oy siljishi farqli daromad turlari birlashtirilmaydi (BR-036, BR-043) |
| `invalid_batch` / `invalid_device` | sinxron paketi massiv emas yoki 100 dan ortiq (`set_sort_order` — 1000, `bulk_transactions` — 500 dan ortiq); qurilma ID bo'sh/uzun |
| `invalid_table` | `set_sort_order` ga tartibli spravochnik bo'lmagan jadval |
| `invalid_action` | `bulk_transactions` ga noma'lum amal yoki qiymatsiz `set_category`/`add_tag` |
| `confirm_mismatch` | `delete_household` tasdiq nomi byudjet nomiga mos emas |
| `transaction_not_found` | `save_transaction`: tahrirlanayotgan amal yo'q (o'chirilgan yoki boshqa byudjetniki) |

Postgres standart kodlari: `23505` — nom band (cheklov nomi `message` da, masalan
`accounts_name_key`), `23514` — qiymat cheklovi (masalan bo'sh nom, summa ≤ 0),
`23503` — havola topilmadi (boshqa byudjet yozuvi ham), `42501` — huquq yo'q
(rol yetmaydi yoki ustun klientdan yozilmaydi).

## Byudjet va a'zolik (E05) — authenticated

| RPC | Kirish | Javob | Kim |
|---|---|---|---|
| `app_bootstrap()` | — | `{schema_version, is_platform_admin, profile{user_id, display_name, locale, last_household_id}, households[{id, name, role, base_currency, timezone, onboarded}], currencies[{code, name{uz,ru,en}, symbol, exponent, allocation_rounding}], app_config{min_android_version, maintenance, …}}` | har kim |
| `create_household(p_name)` | nom | `uuid` | har kim (owner bo'ladi) |
| `create_invite(p_household, p_role='member')` | byudjet, rol (`owner` emas) | `[{code, expires_at}]` | owner/admin |
| `accept_invite(p_code)` | 8 belgili kod (registr farqsiz) | byudjet `uuid` | har kim |
| `leave_household(p_household)` | byudjet | — | a'zo |
| `transfer_ownership(p_household, p_new_owner)` | byudjet, a'zo | — | owner |
| `set_member_role(p_household, p_user, p_role)` | rol (`owner` emas) | — | owner/admin (admin owner'ga tegolmaydi) |
| `remove_member(p_household, p_user)` | a'zo | — | owner/admin |
| `delete_household(p_household, p_confirm_name)` | byudjet, nomi (registrsiz) | — | owner (BR-014); ma'lumotlar kaskadda, chek fayllari `purge-files` bilan |

### `app_config` qiymatlari

| Kalit | Qiymat | Ma'nosi |
|---|---|---|
| `min_android_version` | `"1.2.3"` | BR-214: ilova versiyasi shundan kichik bo'lsa — "Yangilash kerak" ekrani (ilova ishlamaydi) |
| `maintenance` | `null` yoki `{"message": {"uz": …, "ru": …, "en": …}, "until": "2026-10-05T12:00:00Z"}` | texnik ishlar banneri (E26-T02); `until` ixtiyoriy, o'tgan bo'lsa banner ko'rsatilmaydi |

Noma'lum kalitlar e'tiborsiz qoldiriladi (qo'shimcha flaglar uchun joy).

## Spravochniklar (E06) — PostgREST jadvallari

Umumiy qoidalar (barcha sinxron jadvallar):

- `id` — UUIDv7, **klient yaratadi** (offline, ADR-07); berilmasa server yaratadi.
- O'chirish — `PATCH deleted_at = now()` (soft delete). `DELETE` huquqi yo'q:
  tombstone sinxron orqali boshqa qurilmalarga yetadi. Tiklash — `deleted_at = null`.
- Nom (`entity_name`): 1–60 belgi, chetida bo'shliqsiz (klient `trim` qiladi);
  byudjet ichida registrsiz yagona (o'chirilganlar hisobga olinmaydi) — BR-003.
- Summalar — `bigint`, eng kichik birlikda (tiyin), BR-001. Oy — oyning 1-kuni (`YYYY-MM-01`).
- `icon` — neytral kalit (quyidagi ro'yxat), `color` — `#RRGGBB` (katta harf).
- Server maydonlari (klient yozmaydi): `created_by`, `created_at`, `updated_at`, `row_version`.
- Bir byudjet yozuvlari faqat o'sha byudjet yozuviga havola qiladi (kompozit FK).

| Jadval | O'qish | Yozish | Klient yozadigan ustunlar (insert → update) |
|---|---|---|---|
| `currencies`, `category_templates`, `exchange_rates` | har kim | platforma admini (aal2) | — |
| `accounts` | a'zolar | owner/admin | `id, household_id, name, type, currency, opening_balance, opening_date, icon, color, sort_order` → `name, type, currency, opening_balance, opening_date, icon, color, sort_order, archived_at, deleted_at` |
| `categories` | a'zolar | owner/admin | `id, household_id, kind, name, parent_id, month_shift, icon, color, sort_order` → `name, parent_id, month_shift, icon, color, sort_order, archived_at, deleted_at` (`kind` o'zgarmaydi) |
| `recurring_rules` | a'zolar | owner/admin | `id, household_id, kind, name, category_id, account_id, amount, day_of_month, auto_pay, active, start_month, end_month, sort_order` → shular (`id, household_id` dan tashqari) + `deleted_at` |
| `category_limits` | a'zolar | owner/admin | `id, household_id, category_id, amount, alert_80, alert_100` → `amount, alert_80, alert_100, deleted_at` |
| `quick_actions` | a'zolar | owner/admin | `id, household_id, name, amount, category_id, account_id, payee, sort_order` → shular (`id, household_id` dan tashqari) + `deleted_at` |
| `tags` | a'zolar | yaratish — owner/admin/member; tahrir — owner/admin | `id, household_id, name, color` → `name, color, deleted_at` |

Asosiy cheklovlar:

| Jadval | Cheklov |
|---|---|
| `accounts` | `type`: `cash`, `card`, `bank`, `ewallet`, `deposit`, `personal_fund`, `other`; `personal_fund` byudjetda bitta (`accounts_personal_fund_key`) |
| `categories` | `month_shift` −1..1 faqat `income` da; `parent_id` — bir daraja, bir turda; `system_code = personal_allocation` — tizim kategoriyasi |
| `recurring_rules` | `kind`: `expense`/`income` — kategoriya majburiy va turi mos; `allocation` — kategoriyasiz, manba fond bo'lmagan hisob; `amount` NULL = o'zgaruvchan; `day_of_month` 1–31; `auto_pay` → summa va hisob majburiy; `end_month ≥ start_month` |
| `category_limits` | faqat `expense` kategoriyasiga, bittadan (`category_limits_category_key`); `amount > 0` |
| `quick_actions` | `amount > 0`; `expense` kategoriyasi; hisob majburiy |

Yangi byudjet (ro'yxatdan o'tish yoki `create_household`) standart to'plamni
foydalanuvchi tilida oladi: shablondagi 18 kategoriya, hisoblar **Naqd**,
**Karta**, **Shaxsiy fond**; fond qoidasi — 10%, 5-kun, manba — Naqd (BR-060).

### Tartib — `set_sort_order(p_household, p_table, p_ids)` (E22)

Drag & drop natijasi bitta so'rovda: `sort_order` = `p_ids` dagi o'rin (0 dan).
`p_table`: `accounts`, `categories`, `recurring_rules`, `quick_actions`
(owner/admin), `goals` (owner/admin/member). Boshqa byudjet yoki o'chirilgan
qatorlar e'tiborsiz; o'zgarmaganlari yozilmaydi (`row_version` oshmaydi).
Javob — yangilangan qatorlar soni. Xatolar: `forbidden`, `invalid_table`,
`invalid_batch` (> 1000 ID).

### Ikon kalitlari

| Guruh | Kalitlar |
|---|---|
| Moliya | `wallet`, `banknote`, `credit-card`, `bank`, `phone`, `piggy-bank`, `briefcase`, `trophy`, `plus-circle`, `percent`, `receipt` |
| Uy | `home`, `bolt`, `wifi`, `sofa`, `tools` |
| Ovqat | `cart`, `utensils`, `coffee` |
| Transport | `bus`, `car`, `fuel`, `taxi`, `plane` |
| Shaxsiy | `user`, `heart-pulse`, `graduation-cap`, `shirt`, `party`, `gift`, `baby`, `paw`, `dumbbell`, `book` |
| Boshqa | `dots` — noma'lum kalit uchun ham shu ikon |

## Amallar, rejalar, qarzlar, maqsadlar (E07) — PostgREST jadvallari

Umumiy qoidalar E06 bilan bir xil (UUIDv7 klientda, soft delete, `DELETE` yo'q).
**Valyuta:** amal summasi (`amount`) — hisob valyutasida; reja summalari
(`planned_amount`, `paid_amount`) va `amount_base` — byudjetning asosiy
valyutasida; qarz summalari — qarz valyutasida (bog'langan amallar ham shu valyutada).

| Jadval | O'qish | Yozish | Klient yozadigan ustunlar (insert → update) |
|---|---|---|---|
| `debts` | a'zolar | owner/admin/member | `id, household_id, name, direction, currency, total, paid_before, monthly_payment, due_date, note` → `name, total, paid_before, monthly_payment, due_date, note, archived_at, deleted_at` |
| `goals` | a'zolar | owner/admin/member | `id, household_id, name, currency, target, saved_manual, monthly_contribution, deadline, account_id, sort_order` → shular (`id, household_id, currency` dan tashqari) + `achieved_at, deleted_at` |
| `months` | a'zolar | — (RPC: `open_month`, `set_month_closed` — E08) | — |
| `planned_items` | a'zolar | owner/admin/member | `id, household_id, kind, name, category_id, account_id, planned_amount, due_date, budget_month, auto_pay, debt_id, recurring_rule_id, note` → `name, category_id, account_id, planned_amount, due_date, budget_month, auto_pay, debt_id, note, closed_at, skipped_at, deleted_at` |
| `transactions` | a'zolar | owner/admin/member | `id, household_id, kind, account_id, to_account_id, amount, to_amount, fx_rate, category_id, payee, occurred_on, budget_month, budget_month_source, planned_item_id, debt_id, note, source` → shular (`id, household_id` dan tashqari) + `deleted_at` |
| `transaction_tags` | a'zolar | owner/admin/member | `id, household_id, transaction_id, tag_id` → `deleted_at` |
| `attachments` | a'zolar | owner/admin/member | `id, household_id, transaction_id, storage_path, mime, size_bytes` → `deleted_at` |

**Server hisoblaydigan maydonlar** (javobdagi kanonik qiymat klientnikidan ustun):

| Maydon | Qoida |
|---|---|
| `transactions.budget_month` (`budget_month_source = auto`) | rejaga bog'langan → reja oyi (BR-044); daromad → sana oyi + kategoriya `month_shift` (BR-040); xarajat/o'tkazma → sana oyi (BR-041, BR-046). Kirishlar (tur, kategoriya, sana, reja) o'zgarmasa qayta hisoblanmaydi (BR-043) |
| `transactions.amount_base`, `fx_rate` | hisob valyutasi = asosiy → `amount`; aks holda `fx_rate` (qo'lda) yoki sanadagi/oldingi CBU kursi, bo'lmasa `fx_rate_missing` |
| `transactions.to_amount` | bir valyutali o'tkazmada = `amount` |
| `transactions.category_id` | 👤 fond hisobidan kategoriyasiz xarajat → "O'zim uchun" (BR-062) |
| `transactions.debt_id` | qarzga bog'langan rejaning to'lovi → o'sha qarz (BR-111) |
| `planned_items.paid_amount`, `settled_at` | bog'langan tirik amallar `amount_base` yig'indisi; to'landi = `paid ≥ planned` yoki summasiz rejaga to'lov yoki `closed_at` (BR-071, BR-073) |
| fond rejasi (`system_code = personal_allocation`) `planned_amount` | foiz rejimi: `round(oy daromadi × foiz / 100 / birlik) × birlik` (so'mda birlik 1000), daromad o'zgarsa qayta; qat'iy — sozlamadagi summa (BR-060) |

**Qoidalar:** daromad 👤 fond hisobiga yozilmaydi (BR-063); reja 👤 fond hisobiga
havola qilmaydi; ajratma rejasi faqat byudjet hisobidan fondga o'tkazma bilan
to'lanadi (BR-061); `strict_month_lock` yoqilgan byudjetda yopilgan oy yozuvlari
o'zgarmaydi (`month_closed`).

**Reja holati** (BR-071; saqlanmaydi, bugungi sana — byudjet vaqt zonasida):
`skipped_at` → `skipped`; `settled_at` → `paid`; `due_date < bugun` → `overdue`;
`paid_amount > 0` → `partial`; aks holda `pending`. Mobil ilova aynan shu
tartibni takrorlaydi (`private.planned_status`).

### O'qish view'lari

| View | Ustunlar | Qoida |
|---|---|---|
| `account_balances` | `household_id, account_id, balance` (hisob valyutasida) | BR-021 |
| `debt_balances` | `household_id, debt_id, paid_in_app, pending_amount, pending_count, remaining, progress, months_left, end_month, status` (`closed`/`paying`/`pending`/`unlinked`) | BR-112..116 |
| `goal_progress` | `household_id, goal_id, saved, remaining, progress, months_left, end_month, on_track` | BR-121, BR-122 |

### Admin amallar jadvali (E23) — a'zolar

Filtr (`p_filters jsonb`, hammasi ixtiyoriy): `month` (oy boshi, tegishli oy),
`from`/`to` (amal sanasi), `kinds[]`, `accounts[]` (manba **yoki** manzil),
`categories[]` (subkategoriyalari bilan), `members[]` (`created_by`), `tags[]`,
`min`/`max` (asosiy valyutada, chegaralar kiradi), `q` (joy yoki izoh: qism-matn,
3+ belgida xatoli yozuv ham — BR-202; `%`/`_` oddiy belgi). Ro'yxat va jami bir
xil filtrdan; a'zo bo'lmagan — `forbidden`.

- `transactions_list(p_household, p_filters = '{}', p_after_date, p_after_id, p_limit = 50)` —
  keyset sahifa, `(occurred_on, id)` bo'yicha kamayish; keyingi sahifa — oxirgi
  qatorning `occurred_on` va `id` si. `p_limit` 1..200. Qator: amal ustunlari +
  `tag_ids uuid[]`, `has_receipt boolean`.
- `transactions_summary(p_household, p_filters = '{}')` →
  `{count, income, expense, transfer}` (asosiy valyutada).
- `bulk_transactions(p_household, p_ids, p_action, p_value)` — owner/admin/member;
  `p_action`: `set_category` (`p_value` — kategoriya), `add_tag` (`p_value` — teg,
  idempotent), `delete`. Har qator alohida: biri rad etilsa qolganlari bajariladi.
  Javob — `{done: [id], skipped: [{id, reason}]}`; `reason` — biznes kod
  (`month_closed`, `category_kind_mismatch`, ...), `not_found` (boshqa byudjet
  yoki o'chirilgan) yoki SQLSTATE. Xatolar: `forbidden`, `invalid_action`,
  `invalid_batch` (> 500 ID).

### Amal formasi (E23-T02)

- `save_transaction(p_household, p_kind, p_account_id, p_amount, p_occurred_on,
  p_to_account_id, p_to_amount, p_fx_rate, p_category_id, p_payee, p_budget_month,
  p_planned_item_id, p_debt_id, p_note, p_tag_ids, p_id)` → amal `id`. `p_id` yo'q —
  yaratish (`source = manual`), bor — to'liq tahrirlash. Amal va teglari bitta
  tranzaksiyada: ro'yxatda yo'q teglar o'chiriladi (tombstone). `p_budget_month`
  berilsa — qo'lda (BR-042), aks holda avto; avto tahrirda saqlangan oy faqat
  kirishlar o'zgarsa qayta hisoblanadi (BR-043). Qolgan tekshiruvlar — amal
  triggeri (yuqoridagi xato kodlari). Owner/admin/member.
- `payee_suggestions(p_household, p_query, p_kind = 'expense', p_limit = 8)` —
  BR-056: `{payee, category_id, account_id, last_used}`, har nom bir marta
  (oxirgi kategoriya/hisob bilan), boshidan mos kelganlari oldin. A'zolar.

### Chek rasmlari (Storage)

- Bucket `receipts` (yopiq), fayl ≤ 1 MB, `image/jpeg`, `image/png`, `image/webp` (BR-201).
- Yo'l: `{household_id}/{transaction_id}/{uuid}.{jpg|png|webp}`; o'qish — a'zolar,
  yuklash/o'chirish — amal yozuvchilar.
- Yuklangandan keyin `attachments` qatori yoziladi; amal o'chirilsa (soft)
  biriktirmalar ham o'chiriladi, undo'da qaytadi; fayllarni server tozalaydi (E11).

## Biznes RPC'lar (E08) — authenticated

Oy — `YYYY-MM-01`; sana — `YYYY-MM-DD` (standart — byudjet vaqt zonasidagi bugun).
Summalar tiyinda. Ichki nomlar (onboarding) byudjet ichida registrsiz qidiriladi.

| RPC | Javob | Kim |
|---|---|---|
| `open_month_preview(p_household, p_month)` | `{month, closed, new, existing, items[{kind, name, planned_amount, due_date, recurring_rule_id, system_code, exists}]}` | a'zolar |
| `open_month(p_household, p_month)` | `{month, created, skipped, items[{id, kind, name, planned_amount, due_date}]}` — idempotent (BR-081, BR-082) | owner/admin/member |
| `pay_planned(p_item, p_amount?, p_account?, p_date?, p_settle=false)` | `{transaction_id, paid_amount, remaining, status}` — summa standart = qolgan (asosiy valyutadagi hisobda); ajratma → fondga o'tkazma (BR-073, BR-061) | owner/admin/member |
| `skip_planned(p_item, p_skipped=true)` | `{id, status}` (BR-071) | owner/admin/member |
| `bulk_pay_planned(p_items[], p_date?, p_account?)` | `{paid: [id], skipped: [{id, reason}]}`; `reason`: `not_found`, `forbidden`, `skipped`, `already_paid`, `amount_unknown`, `account_required`, `account_not_found`, `currency_mismatch` (BR-074) | owner/admin/member |
| `recalc_income_months_preview(p_household)` | `{count, moves[{from_month, to_month, count, amount_base}]}` (BR-043) | owner/admin |
| `recalc_income_months_apply(p_household, p_expected_count)` | `{moved}` — son preview bilan mos bo'lmasa `preview_outdated` | owner/admin |
| `month_close_check(p_household, p_month)` | `{month, unpaid_count, unpaid_amount, unknown_count}` (BR-153) | a'zolar |
| `set_month_closed(p_household, p_month, p_closed)` | `{month, closed}` — yopish faqat tugagan oy uchun (BR-150) | owner/admin |
| `merge_categories(p_from, p_to)` | `{children, transactions, plans, recurring_rules, quick_actions}` — manba o'chiriladi, maqsad limiti ustun (BR-036) | owner/admin |
| `onboarding_apply(p_household, p_payload)` | `{applied: true, accounts, income_types, recurring_rules}` yoki qayta chaqirilsa `{applied: false}` | owner/admin |

`onboarding_apply` payload (mobil sozlash oynasi, E14):

```json
{
  "accounts": [
    {"name": "Naqd", "type": "cash", "opening_balance": 150000000},
    {"name": "Humo", "type": "card", "opening_balance": 200000000},
    {"name": "Shaxsiy fond", "type": "personal_fund", "opening_balance": 30000000}
  ],
  "income_types": [
    {"name": "Oylik", "month_shift": -1, "expected_day": 2, "expected_amount": 800000000, "account": "Humo"}
  ],
  "recurring": [
    {"kind": "expense", "name": "Ijara", "category": "Ijara", "account": "Naqd", "amount": 300000000, "day_of_month": 5, "auto_pay": false}
  ],
  "fund": {"mode": "percent", "percent": 10, "fixed_amount": 0, "day": 5, "source_account": "Naqd"}
}
```

- Hisob nomi mavjud bo'lsa — joriy qoldiq (`opening_balance`, bugungi sana); fond
  hisobi turi bo'yicha topiladi; yo'q bo'lsa yangi hisob (asosiy valyutada).
- Daromad turi mavjud bo'lsa — `month_shift` yangilanadi, yo'q bo'lsa yaratiladi;
  `expected_day` berilsa — kutilayotgan daromad doimiy rejasi (BR-077).
- Shu nomli doimiy reja bo'lsa — o'tkaziladi (ustiga yozilmaydi).
- Eslatma sozlamalari — E11 (`notification_prefs`) bilan qo'shiladi.

## Hisobotlar (E09) — a'zolar (`security invoker`)

Barcha summalar — asosiy valyutada (`amount_base`), tiyinda; nisbatlar — 4
xonagacha. "Bugun" — byudjet vaqt zonasida. Hisob-kitob golden fixture'lar
bilan qat'iy tekshiriladi (`contracts/fixtures`), mobil ilova ham shu qoidalar
bo'yicha lokal hisoblaydi:

| Qator | Qaysi amallar | Karta/naqd (BR-022) |
|---|---|---|
| daromad | `income` | hisob `cash` → naqd, qolgan turlar → karta |
| xarajat | fond bo'lmagan hisobdan `expense` + ajratmalar | manba hisob turi |
| ajratma | fondga o'tkazma (+), fonddan byudjet hisobiga (−); kategoriyasi "O'zim uchun" | fonddan qaytishda — manzil turi |
| fond sarfi | fond hisobidan `expense` — byudjetga kirmaydi | — |

`planned` — xarajat va ajratma rejalari summasi (noma'lum = 0; o'tkazib
yuborilgan va daromad rejalari kirmaydi); `unpaid` — to'lanmagan rejalarning
qoldig'i (`planned − paid`), `unknown_count` — summasi noma'lum to'lanmaganlar.

| RPC | Javob (asosiy maydonlar) |
|---|---|
| `report_month(p_household, p_month)` | `{month, closed, is_current, totals{income, income_card, income_cash, expense, expense_card, expense_cash, planned, unpaid, unknown_count, allocated, fund_spent}, derived{balance, forecast, saved, saved_ratio, spent_ratio, plan_ratio, card, cash}, projection{days_in_month, days_elapsed, daily_spend, month_end_spend, income_received, income_expected, income_pending, month_end_balance, per_day_available}, by_type[{category_id, name, card, cash}], by_category[{category_id, name, parent_id, planned, actual, actual_total, limit, limit_ratio, limit_status}], unpaid[{id, kind, name, category_id, planned_amount, paid_amount, due_date, auto_pay, status}], fund{allocated, spent, balance}, savings{before, this_month, total}, debts{i_owe, owed_to_me, monthly_obligation, net, paid_this_month}, goals[{goal_id, name, saved, remaining, progress}]}` |
| `report_year(p_household, p_year)` | `{year, months[12 × {month, income, expense, allocated, fund_spent, closed, has_records, balance, forecast, saved, saved_ratio, …}], totals{…}}` |
| `report_savings(p_household)` | `{months[{month, income, expense, balance, accumulated, is_current}], summary{months_count, total_income, total_expense, total_balance, total_saved, avg_monthly_saved, avg_monthly_expense}}` |
| `report_personal_fund(p_household, p_from, p_to)` | `{balance, total_allocated, total_spent, months[{month, allocated, spent}], spends[{id, occurred_on, amount, category_id, payee, note}]}` |
| `report_debts(p_household)` | `{debts[{debt_id, name, direction, currency, total, paid_before, monthly_payment, due_date, archived, paid_in_app, pending_amount, pending_count, remaining, progress, months_left, end_month, status}], totals{i_owe, owed_to_me, monthly_obligation, net, paid_this_month}}` |
| `report_goals(p_household)` | `{avg_monthly_saved, goals[{goal_id, name, currency, target, saved, remaining, progress, monthly, monthly_source (goal/average), months_left, end_month, deadline, on_track, account_id, achieved_at}]}` |
| `report_category_trend(p_household, p_from, p_to, p_category?)` | `{series[{month, category_id, actual}], compare[{category_id, actual, prev, avg3, vs_prev, vs_avg3}]}` (BR-095) |
| `health_check(p_household)` | `{problems[{code, …}], warnings[{code, …}], info{transactions, planned_items, first_month, opened_months, closed_months, income_rules}}` |

Formulalar: BR-090..095 (`BIZNES-QOIDALAR.md` 10-bo'lim). `limit_status`:
`ok` < 80%, `near` 80–100%, `over` > 100% (ota-kategoriya — subkategoriyalar
bilan, `actual_total`). `per_day_available` — faqat joriy oy.

`health_check` kodlari: muammolar — `month_not_opened` (`count`),
`debt_unlinked` (`suggestions[{transaction_id, occurred_on, amount, payee}]` —
nomi o'xshash amallar), `debt_plans_overdue`; ogohlantirishlar —
`no_active_rules`, `negative_cash` (`account_id, balance`), `long_overdue`
(`count, days`), `edited_after_close`, `fx_rate_stale` (`currency,
last_rate_date`). Bildirishnoma, rejali ish va sinxron tekshiruvlari — E10/E11.

## Sinxron protokoli (E10) — mobil (ARXITEKTURA 6)

Sinxron jadvallar (`t`): `households` (byudjetning o'zi), `accounts`,
`categories`, `recurring_rules`, `category_limits`, `quick_actions`, `tags`,
`debts`, `goals`, `months`, `planned_items`, `transactions`,
`transaction_tags`, `attachments`. Qator — jadvalning to'liq qatori (JSON).

### `sync_pull(p_household, p_cursor, p_limit = 500)` — a'zolar

```json
{ "changes": [{ "t": "transactions", "row": { "id": "…", "row_version": 1042, "deleted_at": null, … } }],
  "next_cursor": 1042, "has_more": false, "resync_required": false }
```

- `row_version > p_cursor` bo'yicha, versiya tartibida, ≤ 500 ta; `has_more` —
  yana bor, darhol keyingi sahifani `next_cursor` bilan so'rang.
- `p_cursor = 0` — birinchi yuklash: tombstone'lar (`deleted_at` bor) yuborilmaydi.
  Keyingi so'rovlarda o'chirilganlar `deleted_at` bilan keladi — lokal o'chiring.
- `resync_required: true` — kursor tozalangan versiyadan eski (90 kunlik
  tombstone'lar o'chirilgan): lokal bazani tozalab, `p_cursor = 0` dan qayta yuklang.
- Kafolat: bir byudjet yozuvlari commit tartibida versiyalanadi — kursor hech
  narsani o'tkazib yubormaydi (`make sync-test`).

### `sync_push(p_household, p_device, p_mutations)` — amal yozuvchilar

```json
// kirish (≤ 100 ta mutatsiya)
[{ "mutation_id": "uuid", "table": "transactions", "op": "upsert",
   "id": "uuid (v7, klientda)", "base_version": 1042, "data": { "amount": 150000000, … } },
 { "mutation_id": "uuid", "table": "transactions", "op": "delete", "id": "uuid", "base_version": 1043 }]
// javob — har mutatsiyaga bittadan, shu tartibda
{ "results": [{ "mutation_id": "…", "status": "ok", "row": { … kanonik qator … } },
              { "mutation_id": "…", "status": "conflict", "row": { … server qatori … } },
              { "mutation_id": "…", "status": "rejected", "code": "invalid_account", "message": "…" }] }
```

| Holat | Qachon | Klient nima qiladi |
|---|---|---|
| `ok` | yozildi | lokal qatorni `row` bilan almashtiradi (server hisoblagan `budget_month`, `amount_base`, `row_version`) |
| `conflict` | `base_version` ≠ serverdagi versiya; yoki yangi (`base_version: null`) deb yuborilgan qator serverda bor | "Bu yozuv boshqa qurilmada o'zgartirilgan" (BR-006): `row` ni ko'rsatadi, foydalanuvchi tanlaydi |
| `rejected` | cheklov/huquq/biznes qoida xatosi; `code` — biznes kod yoki SQLSTATE (`42501` huquq, `23514` qiymat, `23505` nom band…), `not_found`, `household_mismatch`, `invalid_mutation` | o'zgarishni qaytaradi, xabar ko'rsatadi |

- **Idempotent:** bir xil `mutation_id` qayta yuborilsa — aynan birinchi natija
  (30 kun saqlanadi). Har mutatsiya alohida savepoint'da — biri rad etilsa
  qolganlari yoziladi.
- **Yoziladigan maydonlar** — foydalanuvchining ustun huquqlari (yuqoridagi
  "Klient yozadigan ustunlar" jadvallari); boshqa kalitlar e'tiborsiz
  qoldiriladi (masalan `amount_base`, `row_version`). `id`, `household_id` —
  mutatsiyadan; boshqa byudjet `household_id` si — rad.
- `delete` — soft delete (`deleted_at`). `months` — faqat RPC orqali.
- Jurnal: `sync_mutations` (owner/admin o'qiydi) — qurilma, holat, natija.


## Bildirishnomalar (E11) — authenticated

Navbat, kanallar va rejali ishlar — `docs/ARXITEKTURA.md` 7. Mobil faqat
sozlaydi va qurilmani ro'yxatdan o'tkazadi; yuborish — server (outbox →
`notify-dispatch`). Offline mahalliy eslatma (BR-168) — mobilning o'zida.

### Sozlamalar — `notification_prefs` (PostgREST)

Har a'zo × byudjet uchun bitta qator (a'zolik bilan avtomatik yaratiladi).
O'qish — faqat o'ziniki; yozish — `update` (qator qo'shilmaydi/o'chmaydi).

| Ustun | Standart | Qoida |
|---|---|---|
| `push`, `telegram`, `email` | `true`, `false`, `false` | kanallar (BR-163); email — server sozlangan bo'lsa |
| `reminder_hour` | 9 | 0–23, byudjet vaqt zonasida (BR-160) |
| `days_ahead` | 3 | 0–14 — kunlik eslatmada necha kun oldinga |
| `monthly_report`, `report_day` | `true`, 21 | 1–28 — o'tgan oy hisoboti kuni (BR-161) |
| `limit_alerts`, `income_missing` | `true`, `true` | BR-133, BR-165 |

### Qurilma (FCM push)

- `register_device(p_token, p_platform, p_app_version = null)` — ilova
  ochilganda va token yangilanganda; token boshqa akkauntda bo'lsa — ko'chadi.
- `unregister_device(p_token)` — chiqishda.
- Push: `notification { title, body }` (tayyor matn, foydalanuvchi tilida) +
  `data { type }`: `daily_reminder` | `monthly_report` | `limit_alert` |
  `income_missing` | `test` — ilova bosilganda tegishli ekranni ochadi.
  Eskirgan token server tomonda o'chiriladi.

### Telegram (BR-163)

- `telegram_link_token()` → `{ "token": "…32 belgi…", "expires_at": "…" }`
  (15 daqiqa, bir martalik) → `https://t.me/<bot>?start=<token>` ni oching.
- Holat: `telegram_links` (o'z qatori: `linked_at`) — bor bo'lsa "Ulangan".
- `telegram_unlink()` — uzish (botda `/stop` ham).

### Test xabar va "hozir yuborish" (BR-164)

- `test_notification(p_household)` →
  `[{ "channel": "push", "queued": true, "reason": null }, { "channel": "telegram", "queued": false, "reason": "not_linked" }, …]`.
  `reason`: `disabled` (sozlamada o'chiq) | `no_device` | `not_linked` | `not_configured` (server kanalni qo'llamaydi).
- `send_monthly_report_now(p_household, p_month)` → `{ "report": {…}, "channels": [ … yuqoridagidek … ] }`.

### Jurnallar

- `notification_outbox` (o'ziniki): `channel`, `type`, `status`
  (`pending` | `sending` | `sent` | `failed` | `skipped`), `error` (sabab kodi,
  masalan `no_device`), `created_at`, `sent_at` — 90 kun (BR-166).
- `monthly_reports` (byudjet a'zolari, BR-167): `month`, `generated_at`,
  `payload`: `income`, `expense`, `balance`, `saved`, `saved_ratio` (0–1),
  `fund_balance`, `savings_total`, `debts_remaining`,
  `top_categories [{name, actual}]` (5 ta), `limits_exceeded [{name, actual, limit}]`,
  `suspicious` (BR-162).

### Akkauntni o'chirish (BR-015) — Edge Function

`POST /functions/v1/delete-account`, sarlavhalar `Authorization: Bearer <JWT>`,
`apikey: <publishable>`:

| Javob | Ma'nosi | Klient |
|---|---|---|
| `200 { "deleted_households": 1 }` | yolg'iz byudjetlar o'chirildi, qolganlaridan chiqdi, akkaunt o'chdi | lokal bazani tozalab, kirish ekraniga |
| `401 { "error": "unauthorized" }` | sessiya yaroqsiz | qayta kirish |
| `409 { "error": "last_owner" }` | boshqa a'zolari bor byudjetning yagona egasi (BR-014) | avval egalikni o'tkazish |

Chek rasmlari server tomonda tozalanadi (kunlik ish, byudjeti yo'q fayllar — darhol).
