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

Postgres standart kodlari: `23505` — nom band (cheklov nomi `message` da, masalan
`accounts_name_key`), `23514` — qiymat cheklovi (masalan bo'sh nom, summa ≤ 0),
`23503` — havola topilmadi (boshqa byudjet yozuvi ham), `42501` — huquq yo'q
(rol yetmaydi yoki ustun klientdan yozilmaydi).

## Byudjet va a'zolik (E05) — authenticated

| RPC | Kirish | Javob | Kim |
|---|---|---|---|
| `app_bootstrap()` | — | `{schema_version, is_platform_admin, profile{user_id, display_name, locale, last_household_id}, households[{id, name, role, base_currency, timezone}], currencies[{code, name{uz,ru,en}, symbol, exponent}], app_config{min_android_version, maintenance, …}}` | har kim |
| `create_household(p_name)` | nom | `uuid` | har kim (owner bo'ladi) |
| `create_invite(p_household, p_role='member')` | byudjet, rol (`owner` emas) | `[{code, expires_at}]` | owner/admin |
| `accept_invite(p_code)` | 8 belgili kod (registr farqsiz) | byudjet `uuid` | har kim |
| `leave_household(p_household)` | byudjet | — | a'zo |
| `transfer_ownership(p_household, p_new_owner)` | byudjet, a'zo | — | owner |
| `set_member_role(p_household, p_user, p_role)` | rol (`owner` emas) | — | owner/admin (admin owner'ga tegolmaydi) |
| `remove_member(p_household, p_user)` | a'zo | — | owner/admin |

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

### Ikon kalitlari

| Guruh | Kalitlar |
|---|---|
| Moliya | `wallet`, `banknote`, `credit-card`, `bank`, `phone`, `piggy-bank`, `briefcase`, `trophy`, `plus-circle`, `percent`, `receipt` |
| Uy | `home`, `bolt`, `wifi`, `sofa`, `tools` |
| Ovqat | `cart`, `utensils`, `coffee` |
| Transport | `bus`, `car`, `fuel`, `taxi`, `plane` |
| Shaxsiy | `user`, `heart-pulse`, `graduation-cap`, `shirt`, `party`, `gift`, `baby`, `paw`, `dumbbell`, `book` |
| Boshqa | `dots` — noma'lum kalit uchun ham shu ikon |
