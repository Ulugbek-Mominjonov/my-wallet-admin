import type { MonthReport } from '@/features/reports/api/reports-api'
import type { AppLocale } from '@/shared/config/locale'
import { formatMonth, type MonthKey } from '@/shared/lib/month'
import type { ChartPoint } from '@/shared/ui/chart/column-chart'

/** Grafikdagi oylar soni va yaqin to'lovlar ro'yxati uzunligi. */
export const FLOW_MONTHS = 12
export const UPCOMING_LIMIT = 5
/** Alohida ko'rsatiladigan kategoriyalar; qolgani "Boshqalar" ga yig'iladi. */
const TOP_CATEGORIES = 7

interface SavingsMonth {
  month: string
  income: number
  expense: number
  balance: number
}

/** So'nggi oylar: daromad, xarajat ustunlari va orttirgan chizig'i uchun nuqtalar. */
export function dashboardFlow(months: readonly SavingsMonth[], locale: AppLocale): ChartPoint[] {
  return months.slice(-FLOW_MONTHS).map((row) => {
    const key = row.month.slice(0, 7) as MonthKey
    return {
      key,
      // O'q tor: oy nomining qisqasi (Sentabr → Sen).
      label: formatMonth(key, locale).split(' ')[0]?.slice(0, 3) ?? key,
      values: { income: row.income, expense: row.expense, saved: Math.max(row.balance, 0) },
    }
  })
}

export interface TopCategory {
  id: string
  name: string
  amount: number
}

/**
 * Ko'p sarflangan kategoriyalar: faqat yuqori daraja (subkategoriyalar
 * `actual_total` ichida), kamayish bo'yicha; qolgani — "Boshqalar".
 */
export function topCategories(rows: MonthReport['by_category']): {
  items: TopCategory[]
  total: number
} {
  const roots = rows
    .filter((row) => row.parent_id === null && row.actual_total > 0)
    .map((row) => ({ id: row.category_id, name: row.name, amount: row.actual_total }))
    .sort((a, b) => b.amount - a.amount)
  const total = roots.reduce((sum, row) => sum + row.amount, 0)
  if (roots.length <= TOP_CATEGORIES + 1) return { items: roots, total }
  const top = roots.slice(0, TOP_CATEGORIES)
  const rest = roots.slice(TOP_CATEGORIES).reduce((sum, row) => sum + row.amount, 0)
  return { items: [...top, { id: 'other', name: 'other', amount: rest }], total }
}
