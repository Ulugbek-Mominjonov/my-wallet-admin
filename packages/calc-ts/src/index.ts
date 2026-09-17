/**
 * `@byudjet/calc` — Dart domen qatlamining TypeScript porti.
 *
 * Admin panel (Server Actions) va Vercel Cron shu paketdan foydalanadi.
 * Ikkala implementatsiya `testdata/aggregate-cases.json` fixture'lari
 * bilan tekshiriladi — shuning uchun platformalar orasida drift bo'lmaydi.
 */
export * from './types.js';
export * from './monthKey.js';
export * from './delta.js';
export * from './summary.js';
export * from './rules.js';
export * from './reconcile.js';
