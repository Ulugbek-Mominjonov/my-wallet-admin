import { parseMoney } from '@/shared/lib/money'

/** Import uchun kerakli va ixtiyoriy ustunlar. */
export const IMPORT_FIELDS = [
  'occurred_on',
  'amount',
  'payee',
  'category',
  'account',
  'note',
] as const
export type ImportField = (typeof IMPORT_FIELDS)[number]

/** Ustun tartibi: maydon → CSV ustuni indeksi (`null` — tanlanmagan). */
export type ImportMapping = Record<ImportField, number | null>

/** Sarlavhadan taxmin qilish uchun kalit so'zlar (uz/ru/en). */
const HINTS: Record<ImportField, readonly string[]> = {
  occurred_on: ['sana', 'дата', 'date', 'vaqt'],
  amount: ['summa', 'сумма', 'amount', 'debit', 'kredit', 'qiymat'],
  payee: ['joy', 'nomi', 'место', 'назначение', 'payee', 'description', 'izoh_joy', 'merchant'],
  category: ['kategoriya', 'категория', 'category'],
  account: ['hisob', 'счёт', 'счет', 'account', 'karta'],
  note: ['izoh', 'заметка', 'note', 'comment'],
}

/** Sarlavha qatoridan ustunlarni taxmin qiladi (topilmasa — tanlanmagan). */
export function guessMapping(header: readonly string[]): ImportMapping {
  const mapping = Object.fromEntries(IMPORT_FIELDS.map((field) => [field, null])) as ImportMapping
  const used = new Set<number>()
  for (const field of IMPORT_FIELDS) {
    const index = header.findIndex((cell, i) => {
      if (used.has(i)) return false
      const name = cell.trim().toLowerCase()
      return HINTS[field].some((hint) => name.includes(hint))
    })
    if (index >= 0) {
      mapping[field] = index
      used.add(index)
    }
  }
  return mapping
}

/**
 * Sana: ISO (`YYYY-MM-DD`) yoki `DD.MM.YYYY` / `DD/MM/YYYY`. Boshqasi —
 * `null` (server qatorni xato deb belgilaydi).
 */
export function normalizeDate(text: string): string | null {
  const value = text.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const match = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(value)
  if (!match) return null
  const [, day, month, year] = match
  return `${year ?? ''}-${(month ?? '').padStart(2, '0')}-${(day ?? '').padStart(2, '0')}`
}

/** Serverga yuboriladigan qator (summa — eng kichik birlikda, ishorasi bilan). */
export interface ImportRow {
  occurred_on: string | null
  amount: number | null
  payee: string
  category: string
  account: string
  note: string
}

const cell = (row: readonly string[], index: number | null): string =>
  index === null ? '' : (row[index] ?? '').trim()

/** CSV qatorlari + moslashtirish → import qatorlari (sarlavha tashlanadi). */
export function toImportRows(
  rows: readonly (readonly string[])[],
  mapping: ImportMapping,
  currency: string,
): ImportRow[] {
  return rows.map((row) => {
    const amountText = cell(row, mapping.amount)
    return {
      occurred_on: normalizeDate(cell(row, mapping.occurred_on)),
      amount: amountText === '' ? null : parseMoney(amountText, currency),
      payee: cell(row, mapping.payee),
      category: cell(row, mapping.category),
      account: cell(row, mapping.account),
      note: cell(row, mapping.note),
    }
  })
}
