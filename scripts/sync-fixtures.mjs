#!/usr/bin/env node
/**
 * Umumiy fixture'larni mobil repodan ko'chiradi.
 *
 * `testdata/aggregate-cases.json` — ikki repo o'rtasidagi YAGONA
 * shartnoma. U `oylik-byudjet-app` repoda Dart generatori tomonidan
 * yaratiladi va shu yerdagi TypeScript porti aynan shu fayl bilan
 * tekshiriladi. Shuning uchun:
 *
 *   mobil repo:  make fixtures
 *   bu repo:     make sync-fixtures && npm --prefix packages/calc-ts test
 *
 * Ishlatish:
 *   node scripts/sync-fixtures.mjs [manba]
 *
 * `manba` — mobil repo yo'li (standart: `../oylik-byudjet-app`) yoki
 * `https://` bilan boshlanuvchi to'g'ridan-to'g'ri havola (masalan
 * GitHub raw URL) — CI uchun qulay.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { argv, exit } from 'node:process';

const RELATIVE_PATH = 'testdata/aggregate-cases.json';
const target = resolve(
  new URL('..', import.meta.url).pathname,
  RELATIVE_PATH,
);

const hash = (text) =>
  createHash('sha256').update(text).digest('hex').slice(0, 12);

const readSource = async (source) => {
  if (source.startsWith('https://')) {
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`Yuklab bo'lmadi: ${response.status} ${source}`);
    }
    return response.text();
  }
  const path = source.endsWith('.json')
    ? resolve(source)
    : join(resolve(source), RELATIVE_PATH);
  if (!existsSync(path)) {
    throw new Error(
      `Topilmadi: ${path}\n` +
        `Mobil repo yo'lini bering: make sync-fixtures APP_REPO=/path/to/oylik-byudjet-app`,
    );
  }
  return readFileSync(path, 'utf8');
};

const main = async () => {
  const source = argv[2] ?? '../oylik-byudjet-app';
  const incoming = await readSource(source);

  // Fayl haqiqatan ham fixture ekanini tekshiramiz — noto'g'ri faylni
  // ko'chirib qo'yish testlarni tushunarsiz tarzda buzardi.
  const parsed = JSON.parse(incoming);
  if (!parsed.deltaCases || !parsed.aggregateCases) {
    throw new Error("Bu fayl fixture emas: deltaCases/aggregateCases yo'q");
  }

  const current = existsSync(target) ? readFileSync(target, 'utf8') : '';
  if (current === incoming) {
    console.log(`✅ Fixture'lar allaqachon bir xil (${hash(incoming)})`);
    console.log(
      `   ${parsed.deltaCases.length} delta + ${parsed.aggregateCases.length} agregat holati`,
    );
    return;
  }

  writeFileSync(target, incoming);
  console.log(`🔄 Fixture'lar yangilandi: ${hash(current)} → ${hash(incoming)}`);
  console.log(
    `   ${parsed.deltaCases.length} delta + ${parsed.aggregateCases.length} agregat holati`,
  );
  console.log('   Endi: npm --prefix packages/calc-ts test');
};

main().catch((error) => {
  console.error(`❌ ${error.message}`);
  exit(1);
});
