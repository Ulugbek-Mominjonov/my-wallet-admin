import { z } from 'zod'

import { TRANSACTION_KINDS } from '@/entities/transaction'
import { isMonthKey, type MonthKey } from '@/shared/lib/month'

/** `month=all` — oy filtri yo'q (butun tarix). */
export const ALL_MONTHS = 'all'
/** Qidiruv matni chegarasi (URL va RPC). */
export const SEARCH_MAX_LENGTH = 100
/** Bitta ro'yxat filtridagi ID'lar chegarasi — URL cheksiz o'smasin. */
const MAX_FILTER_IDS = 50

/** Buzilgan yoki eskirgan havola sahifani yiqitmaydi — yaroqsiz maydon tashlanadi. */
const lenient = <T extends z.ZodType>(schema: T) => schema.optional().catch(undefined)

const idList = lenient(z.array(z.guid()).min(1).max(MAX_FILTER_IDS))
const minor = lenient(z.number().int().nonnegative())

/**
 * E23-T01: amallar filtri URL'da (ulashiladigan havola). Summalar — asosiy
 * valyutaning eng kichik birligida (BR-001).
 */
export const transactionSearchSchema = z.object({
  month: lenient(
    z.union([
      z.custom<MonthKey>((value) => typeof value === 'string' && isMonthKey(value)),
      z.literal(ALL_MONTHS),
    ]),
  ),
  from: lenient(z.iso.date()),
  to: lenient(z.iso.date()),
  kinds: lenient(z.array(z.enum(TRANSACTION_KINDS)).min(1)),
  accounts: idList,
  categories: idList,
  members: idList,
  tags: idList,
  min: minor,
  max: minor,
  q: lenient(z.string().trim().min(1).max(SEARCH_MAX_LENGTH)),
})

export type TransactionSearch = z.infer<typeof transactionSearchSchema>

export type Period =
  | { mode: 'month'; month: MonthKey }
  | { mode: 'all' }
  | { mode: 'range'; from: string | undefined; to: string | undefined }

/** Davr: sana oralig'i ustun, keyin `all`, aks holda oy (standart — joriy). */
export function periodOf(search: TransactionSearch, currentMonth: MonthKey): Period {
  if (search.from !== undefined || search.to !== undefined) {
    return { mode: 'range', from: search.from, to: search.to }
  }
  if (search.month === ALL_MONTHS) return { mode: 'all' }
  return { mode: 'month', month: search.month ?? currentMonth }
}

/** RPC filtri (`transactions_list` / `transactions_summary`, contracts/api.md). */
export type TransactionFilters = Partial<
  Record<'month' | 'from' | 'to' | 'q', string> &
    Record<'kinds' | 'accounts' | 'categories' | 'members' | 'tags', string[]> &
    Record<'min' | 'max', number>
>

const LIST_FILTERS = ['kinds', 'accounts', 'categories', 'members', 'tags'] as const

export function toRpcFilters(
  search: TransactionSearch,
  currentMonth: MonthKey,
): TransactionFilters {
  const period = periodOf(search, currentMonth)
  const filters: TransactionFilters = {}
  if (period.mode === 'month') filters.month = `${period.month}-01`
  if (period.mode === 'range') {
    if (period.from !== undefined) filters.from = period.from
    if (period.to !== undefined) filters.to = period.to
  }
  for (const key of LIST_FILTERS) {
    const value = search[key]
    if (value !== undefined) filters[key] = value
  }
  if (search.min !== undefined) filters.min = search.min
  if (search.max !== undefined) filters.max = search.max
  if (search.q !== undefined) filters.q = search.q
  return filters
}

/** Davrdan tashqari filtrlar soni ("Tozalash" tugmasi va bo'sh holat matni uchun). */
export function activeFilterCount(search: TransactionSearch): number {
  const lists = LIST_FILTERS.filter((key) => search[key] !== undefined).length
  const amount = search.min !== undefined || search.max !== undefined ? 1 : 0
  return lists + amount + (search.q === undefined ? 0 : 1)
}

/** Davrni saqlab, qolgan filtrlarni tozalaydi. */
export function clearFilters(search: TransactionSearch): TransactionSearch {
  return { month: search.month, from: search.from, to: search.to }
}
