/** Audit triggeri o'rnatilgan jadvallar (BR-008) — filtr ro'yxati shu. */
export const AUDITED_TABLES = [
  'transactions',
  'planned_items',
  'months',
  'accounts',
  'categories',
  'recurring_rules',
  'category_limits',
  'quick_actions',
  'tags',
  'transaction_tags',
  'debts',
  'goals',
  'attachments',
  'households',
  'household_members',
] as const

export type AuditedTable = (typeof AUDITED_TABLES)[number]

/**
 * Farqda ko'rsatilmaydigan texnik maydonlar: yozuvning o'zini bildiruvchi
 * (`id`, `household_id`) va trigger qo'yadigan xizmat maydonlari.
 * `row_version`/`updated_at` ni trigger allaqachon tashlaydi — bu yerda
 * insert/delete uchun.
 */
const HIDDEN_FIELDS = new Set([
  'id',
  'household_id',
  'created_at',
  'created_by',
  'updated_at',
  'row_version',
])

export interface DiffRow {
  field: string
  before: unknown
  after: unknown
}

type Values = Record<string, unknown> | null

/**
 * Eski va yangi qiymatlar → farq qatorlari. Insertda faqat yangi, o'chirishda
 * faqat eski to'ldiriladi; tahrirda trigger yozgan maydonlar (o'zgarganlari).
 * Bo'sh (null va bo'sh satr) maydonlar insert/deletе da tashlanadi — shovqin.
 */
export function diffRows(oldValues: Values, newValues: Values): DiffRow[] {
  const keys = [...new Set([...Object.keys(newValues ?? {}), ...Object.keys(oldValues ?? {})])]
  return keys
    .filter((field) => !HIDDEN_FIELDS.has(field))
    .map((field) => ({
      field,
      before: oldValues?.[field] ?? null,
      after: newValues?.[field] ?? null,
    }))
    .filter((row) => row.before !== null || row.after !== null)
    .sort((a, b) => a.field.localeCompare(b.field))
}
