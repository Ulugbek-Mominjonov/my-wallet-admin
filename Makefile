# My Wallet — platforma. `make` yoki `make help` — buyruqlar ro'yxati.
# Har bir maqsad CI'dagi qadam bilan bir xil ishlaydi (lokal = CI).

.DEFAULT_GOAL := help
.PHONY: help check lint test fmt dev

help: ## Buyruqlar ro'yxati
	@grep -E '^[a-zA-Z_-]+:.*## ' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

check: lint test ## Barcha tekshiruvlar (PR'dan oldin majburiy)

lint: ## Lint, format va tip tekshiruvi
	@echo "lint: tekshiruvlar E01 (db) va E02 (web) da qo'shiladi"

test: ## Barcha testlar
	@echo "test: testlar E01 (pgTAP) va E02 (vitest) da qo'shiladi"

fmt: ## Kodni formatlash
	@echo "fmt: formatlovchilar E01/E02 da qo'shiladi"

dev: ## Lokal muhit (Supabase + admin panel)
	@echo "dev: E01 (supabase start) va E02 (pnpm dev) da qo'shiladi"
