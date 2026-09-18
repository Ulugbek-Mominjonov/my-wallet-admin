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
