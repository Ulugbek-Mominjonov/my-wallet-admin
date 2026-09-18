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

## Byudjet va a'zolik (E05) — authenticated

| RPC | Kirish | Javob | Kim |
|---|---|---|---|
| `app_bootstrap()` | — | `{schema_version, is_platform_admin, profile{user_id, display_name, locale, last_household_id}, households[{id, name, role, base_currency, timezone}], app_config{min_android_version, maintenance, …}}` | har kim |
| `create_household(p_name)` | nom | `uuid` | har kim (owner bo'ladi) |
| `create_invite(p_household, p_role='member')` | byudjet, rol (`owner` emas) | `[{code, expires_at}]` | owner/admin |
| `accept_invite(p_code)` | 8 belgili kod (registr farqsiz) | byudjet `uuid` | har kim |
| `leave_household(p_household)` | byudjet | — | a'zo |
| `transfer_ownership(p_household, p_new_owner)` | byudjet, a'zo | — | owner |
| `set_member_role(p_household, p_user, p_role)` | rol (`owner` emas) | — | owner/admin (admin owner'ga tegolmaydi) |
| `remove_member(p_household, p_user)` | a'zo | — | owner/admin |
