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

export type CsvCell = string | number | null
export type CsvRow = readonly CsvCell[]

/** Qatorlar (birinchisi — sarlavha) → CSV matni (BOM bilan, CRLF — RFC 4180). */
export function toCsvRows(rows: readonly CsvRow[]): string {
  return BOM + rows.map((row) => row.map(cell).join(',')).join('\r\n') + '\r\n'
}

/** Sarlavha va qatorlar → CSV matni. */
export function toCsv(header: readonly string[], rows: readonly CsvRow[]): string {
  return toCsvRows([header, ...rows])
}

/**
 * CSV matnini qatorlarga ajratadi (RFC 4180): qo'shtirnoq ichidagi vergul va
 * qator uzilishi saqlanadi, `""` — bitta qo'shtirnoq. Ajratgich topilmasa
 * vergul ishlatiladi (`;` va tabulyatsiya ham qo'llab-quvvatlanadi).
 */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, '')
  const delimiter = detectDelimiter(clean)
  const rows: string[][] = []
  let row: string[] = []
  let value = ''
  let quoted = false

  for (let i = 0; i < clean.length; i++) {
    const char = clean.charAt(i)
    if (quoted) {
      if (char === '"') {
        if (clean.charAt(i + 1) === '"') {
          value += '"'
          i++
        } else quoted = false
      } else value += char
      continue
    }
    if (char === '"') quoted = true
    else if (char === delimiter) {
      row.push(value)
      value = ''
    } else if (char === '\n' || char === '\r') {
      // CRLF — bitta qator uzilishi.
      if (char === '\r' && clean.charAt(i + 1) === '\n') i++
      row.push(value)
      rows.push(row)
      row = []
      value = ''
    } else value += char
  }
  if (value !== '' || row.length > 0) {
    row.push(value)
    rows.push(row)
  }
  // Bo'sh qatorlar (fayl oxiridagi yangi qator) tashlanadi.
  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ''))
}

/** Birinchi qatordagi eng ko'p uchraydigan ajratgich. */
function detectDelimiter(text: string): string {
  const line = text.slice(0, text.search(/\r|\n/) === -1 ? text.length : text.search(/\r|\n/))
  const counts = [',', ';', '\t'].map((d) => [d, line.split(d).length - 1] as const)
  const best = counts.reduce((a, b) => (b[1] > a[1] ? b : a))
  return best[1] > 0 ? best[0] : ','
}
