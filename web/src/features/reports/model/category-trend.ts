import type { Category } from '@/entities/category'
import type { CategoryTrend } from '@/features/reports/api/reports-api'
import type { AppLocale } from '@/shared/config/locale'
import { formatMonth } from '@/shared/lib/month'
import type { ChartPoint } from '@/shared/ui/chart/column-chart'

export interface CompareRow {
  categoryId: string
  name: string
  actual: number
  prev: number
  avg3: number
  vsPrev: number | null
  vsAvg3: number | null
}

/** Taqqoslash jadvali: nomlar spravochnikdan, kamayish bo'yicha. */
export function compareRows(
  compare: CategoryTrend['compare'],
  categories: ReadonlyMap<string, Category>,
  missing: string,
): CompareRow[] {
  return compare
    .map((row) => ({
      categoryId: row.category_id,
      name: categories.get(row.category_id)?.name ?? missing,
      actual: row.actual,
      prev: row.prev,
      avg3: row.avg3,
      vsPrev: row.vs_prev,
      vsAvg3: row.vs_avg3,
    }))
    .sort((a, b) => b.actual - a.actual)
}

/**
 * Trend nuqtalari: kategoriya tanlansa — faqat o'sha, aks holda hamma
 * kategoriyalar yig'indisi (oyma-oy).
 */
export function trendPoints(
  series: CategoryTrend['series'],
  categoryId: string | null,
  locale: AppLocale,
): ChartPoint[] {
  const byMonth = new Map<string, number>()
  for (const row of series) {
    if (categoryId !== null && row.category_id !== categoryId) continue
    const key = row.month.slice(0, 7)
    byMonth.set(key, (byMonth.get(key) ?? 0) + row.actual)
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, actual]) => ({
      key,
      label: formatMonth(key, locale).split(' ')[0]?.slice(0, 3) ?? key,
      values: { actual },
    }))
}
