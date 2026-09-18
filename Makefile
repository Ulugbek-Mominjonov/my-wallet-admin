# My Wallet — platforma. `make` yoki `make help` — buyruqlar ro'yxati.
# Har bir maqsad CI'dagi qadam bilan bir xil ishlaydi (lokal = CI).

.DEFAULT_GOAL := help
.PHONY: help check lint test fmt dev db-start db-stop db-status db-reset db-test db-lint db-types db-types-check

help: ## Buyruqlar ro'yxati
	@grep -E '^[a-zA-Z_-]+:.*## ' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

check: lint test ## Barcha tekshiruvlar (PR'dan oldin majburiy)

lint: db-lint ## Lint, format va tip tekshiruvi (web — E02)

test: db-test ## Barcha testlar (web — E02)

fmt: ## Kodni formatlash
	@echo "fmt: formatlovchilar E01/E02 da qo'shiladi"

dev: db-start ## Lokal muhit (Supabase + admin panel)
	@echo "dev: admin panel E02 da qo'shiladi (pnpm dev)"

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
