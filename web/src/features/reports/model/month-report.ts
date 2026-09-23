import type { MonthReport } from '@/features/reports/api/reports-api'

/**
 * BR-092: daromad turlari matritsasiga tushmagan daromad (masalan oy siljishi
 * belgilanmagan kategoriya) — hisobotda ogohlantirish sifatida ko'rsatiladi.
 */
export function incomeOutsideTypes(report: MonthReport): number {
  const listed = report.by_type.reduce((sum, row) => sum + row.card + row.cash, 0)
  return Math.max(report.totals.income - listed, 0)
}
