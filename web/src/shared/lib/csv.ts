/** Excel UTF-8 ni to'g'ri o'qishi uchun fayl boshidagi belgi. */
const BOM = '﻿'
/** Jadval dasturlari formula deb o'qiydigan boshlanishlar (CSV injection). */
const FORMULA_START = /^[=+\-@\t\r]/
const NEEDS_QUOTES = /[",\n\r]/

/**
 * Bitta katak: foydalanuvchi matni formula bo'lib ishlamasin (`'` bilan), vergul,
 * qo'shtirnoq yoki qator uzilishi bo'lsa — qo'shtirnoqqa olinadi (RFC 4180).
 * Raqamlar o'zgarishsiz — manfiy summa formula emas.
 */
function cell(value: string | number | null): string {
  if (value === null) return ''
  if (typeof value === 'number') return String(value)
  const safe = FORMULA_START.test(value) ? `'${value}` : value
  return NEEDS_QUOTES.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe
}

/** Sarlavha va qatorlar → CSV matni (BOM bilan, CRLF — RFC 4180). */
export function toCsv(
  header: readonly string[],
  rows: readonly (readonly (string | number | null)[])[],
): string {
  return BOM + [header, ...rows].map((row) => row.map(cell).join(',')).join('\r\n') + '\r\n'
}
