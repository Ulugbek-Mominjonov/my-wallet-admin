# Oylik byudjet — admin panel va backend.
#
# Mobil repo yo'li (fixture sinxronlash uchun):
#   make sync-fixtures APP_REPO=/path/to/oylik-byudjet-app
APP_REPO ?= ../oylik-byudjet-app

.PHONY: help get analyze test build rules sync-fixtures clean

help:
	@echo "get            — npm bog'liqliklari (calc-ts, functions, admin, rules)"
	@echo "analyze        — tip tekshiruvi (tsc --noEmit)"
	@echo "test           — calc-ts testlari (Dart bilan parite)"
	@echo "rules          — Firestore qoidalari testlari (emulyator, Java kerak)"
	@echo "build          — calc-ts, functions va admin build"
	@echo "sync-fixtures  — mobil repodan fixture'larni ko'chiradi"

get:
	cd packages/calc-ts && npm install && npm run build
	cd functions && npm install
	cd admin && npm install
	cd tests/rules && npm install

analyze:
	cd packages/calc-ts && npx tsc --noEmit
	cd functions && npx tsc --noEmit
	cd admin && npx tsc --noEmit

test:
	cd packages/calc-ts && npm test

rules:
	cd tests/rules && npx firebase emulators:exec --only firestore \
	  --project demo-byudjet "npx vitest run"

build:
	cd packages/calc-ts && npm run build
	cd functions && npm run build
	cd admin && npm run build

sync-fixtures:
	node scripts/sync-fixtures.mjs "$(APP_REPO)"

clean:
	rm -rf packages/calc-ts/dist functions/lib admin/.next
