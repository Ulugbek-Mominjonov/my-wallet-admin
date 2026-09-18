# My Wallet — platforma. `make` yoki `make help` — buyruqlar ro'yxati.
# Har bir maqsad CI'dagi qadam bilan bir xil ishlaydi (lokal = CI).

.DEFAULT_GOAL := help
.PHONY: help check lint test fmt dev e2e contracts contracts-check contract-test sync-test perf web-env web-lint web-test web-e2e web-build db-start db-stop db-status db-reset db-test db-lint db-types db-types-check

help: ## Buyruqlar ro'yxati
	@grep -E '^[a-zA-Z_-]+:.*## ' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

check: lint test ## Barcha tekshiruvlar (PR'dan oldin majburiy)

lint: db-lint web-lint contracts-check ## Lint, format, tiplar va shartnoma

test: db-test contract-test sync-test web-test ## Barcha testlar

fmt: ## Kodni formatlash (web)
	pnpm --filter @my-wallet/web format

dev: db-start web-env ## Lokal muhit (Supabase + admin panel)
	pnpm --filter @my-wallet/web dev

# ─── Admin panel (web) ─────────────────────────────────────────────────────
web-env: ## web/.env.local ni lokal Supabase qiymatlaridan yaratish
	@$(SUPABASE) status -o env | awk -F= ' \
		$$1 == "API_URL" { gsub(/"/, "", $$2); print "VITE_SUPABASE_URL=" $$2 } \
		$$1 == "PUBLISHABLE_KEY" { gsub(/"/, "", $$2); print "VITE_SUPABASE_PUBLISHABLE_KEY=" $$2 }' > web/.env.local
	@echo "VITE_APP_ENV=local" >> web/.env.local
	@echo "web/.env.local yaratildi"

web-lint: ## Web: format, ESLint va tip tekshiruvi
	pnpm --filter @my-wallet/web format:check
	pnpm --filter @my-wallet/web lint
	pnpm --filter @my-wallet/web typecheck

web-test: ## Web: unit testlar (Vitest)
	pnpm --filter @my-wallet/web test

web-e2e: ## Web: Playwright e2e (build + preview, desktop va mobil)
	pnpm --filter @my-wallet/web e2e

e2e: web-e2e ## Barcha e2e testlar

web-build: ## Web: production build
	pnpm --filter @my-wallet/web build

# ─── Mobil bilan shartnoma (contracts/) ────────────────────────────────────
contracts: ## contracts/ ni yangilash (BIZNES-QOIDALAR nusxasi)
	scripts/contracts-publish.sh

contracts-check: ## contracts/ eskirmagan va schema-version mos (CI)
	scripts/contracts-publish.sh --check

contract-test: ## Golden fixture'lar: RPC natijasi kutilgan qiymat bilan (lokal Supabase)
	node scripts/contract/run.mjs

sync-test: ## Sinxron kursori parallel yozuvda qator o'tkazib yubormaydi (lokal Supabase)
	node scripts/contract/sync-concurrency.mjs

perf: ## Hisobotlar ishlashi: 10 yillik yukda vaqt va Seq Scan tekshiruvi (lokal Supabase)
	scripts/perf-check.sh

# ─── Ma'lumotlar bazasi (lokal Supabase, Docker) ───────────────────────────
SUPABASE := pnpm exec supabase

db-start: ## Lokal Supabase'ni ishga tushirish (Docker)
	$(SUPABASE) start

db-stop: ## Lokal Supabase'ni to'xtatish
	$(SUPABASE) stop

db-status: ## Lokal URL va kalitlar
	$(SUPABASE) status

db-reset: ## Bazani noldan qurish: migratsiyalar + seed
	$(SUPABASE) db reset

db-test: ## pgTAP testlari (lokal Supabase ishlab turishi kerak)
	$(SUPABASE) test db

db-lint: ## Migratsiya xavfsizligi (squawk) + SQL funksiyalar tekshiruvi
	pnpm exec squawk supabase/migrations/*.sql
	$(SUPABASE) db lint --local --level warning --fail-on warning

DB_TYPES := web/src/shared/api/database.types.ts

db-types: ## TypeScript tiplarini bazadan generatsiya qilish
	@mkdir -p $(dir $(DB_TYPES))
	$(SUPABASE) gen types typescript --local --schema public > $(DB_TYPES)

db-types-check: db-types ## Tiplar commit qilinganiga mosligini tekshirish (CI)
	git diff --exit-code -- $(DB_TYPES)
