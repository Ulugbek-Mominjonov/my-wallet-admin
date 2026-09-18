# contracts/ — mobil ilova bilan shartnoma (ADR-14)

Bu papka **platforma repoda yaratiladi** va `my-wallet-mobil` repoga pinned
versiya bilan ko'chiriladi (`tool/sync_contracts.sh <commit>`). Mobil repoda
qo'lda o'zgartirilmaydi — CI `contracts.lock` dagi sha256 bilan tekshiradi.

| Fayl | Nima | Kim yangilaydi |
|---|---|---|
| `BIZNES-QOIDALAR.md` | biznes qoidalar (BR-xxx) — `docs/` dagi asl nusxadan | `scripts/contracts-publish.sh` |
| `api.md` | RPC imzolari, payloadlar, xato kodlari | qo'lda, RPC bilan birga (E08, E10) |
| `fixtures/*.json` | golden holatlar: kirish → kutilgan natija (Dart ⇄ SQL pariteti) | qo'lda, qoida bilan birga (E09-T05) |
| `schema-version` | API shartnomasi versiyasi = `private.api_schema_version()` | buzuvchi o'zgarishda +1 |

**Versiyalash qoidasi.** Buzuvchi o'zgarish (RPC imzosi/javobi o'zgarishi,
maydon o'chirilishi) → `schema-version` +1 va migratsiyada
`private.api_schema_version()` ham +1; qo'shimcha (additive) o'zgarish —
versiya o'zgarmaydi. Mobil ilova serverdan `health().schema_version` ni oladi
va mos kelmasa "Yangilash kerak" ko'rsatadi (BR-214).

**Tekshiruv:** `make contracts-check` — nusxa eskirmagan va versiya
migratsiya bilan mos (CI `db` job'ida).
