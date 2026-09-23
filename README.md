# 💰 My Wallet — platforma (backend + admin panel)

Oilaviy va shaxsiy byudjet tizimi. Bu repo:

- **`supabase/`** — ma'lumotlar bazasi (Postgres), xavfsizlik (RLS), biznes
  qoidalar (triggerlar, SQL funksiyalar), rejali ishlar (pg_cron), Edge
  Functions (push, Telegram, valyuta kurslari);
- **`web/`** — admin panel: spravochniklar, hisobotlar, vositalar (React SPA);
- **`contracts/`** — mobil ilova bilan shartnoma (API, golden fixture'lar).

Mobil ilova — alohida repo: `my-wallet-mobil`.

## Hujjatlar

| Hujjat | Nima |
|---|---|
| [`docs/PLAN.md`](docs/PLAN.md) | yo'l xaritasi, epiklar va vazifalar (checkbox bilan), ish tartibi |
| [`docs/BIZNES-QOIDALAR.md`](docs/BIZNES-QOIDALAR.md) | biznes qoidalar spetsifikatsiyasi (BR-xxx) |
| [`docs/ARXITEKTURA.md`](docs/ARXITEKTURA.md) | arxitektura, ADR'lar, ma'lumotlar modeli, API, sinxron |
| [`docs/DEPLOY.md`](docs/DEPLOY.md) | bepul deploy uchun akkaunt va kalitlarni tayyorlash |
| [`docs/QOLLANMA.md`](docs/QOLLANMA.md) | foydalanuvchi qo'llanmasi (mobil va admin panel) |
| [`docs/MIGRATSIYA.md`](docs/MIGRATSIYA.md) | eski Google Sheets byudjetini ko'chirish |

## Lokal ishga tushirish

```bash
make help     # barcha buyruqlar
make dev      # Supabase (Docker) + admin panel
make check    # lint + testlar — PR'dan oldin majburiy
```

Talablar: Docker, Node 24, pnpm. Batafsil: [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md).

## Holat

Platforma yadrosi, mobil ilova va admin panel tayyor (E01–E27); hozir —
production relizi (E28). Batafsil: [`docs/PLAN.md`](docs/PLAN.md).
