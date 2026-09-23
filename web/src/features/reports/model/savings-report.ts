import type { SavingsReport } from '@/features/reports/api/reports-api'
import type { AppLocale } from '@/shared/config/locale'
import { formatMonth } from '@/shared/lib/month'
import type { ChartPoint } from '@/shared/ui/chart/column-chart'

/** Grafikda ko'rsatiladigan oxirgi oylar soni. */
const CHART_MONTHS = 12

/** Jamg'arma grafigi: oylik orttirgan (ustun) va to'plangan (chiziq). */
export function savingsChartPoints(
  months: SavingsReport['months'],
  locale: AppLocale,
): ChartPoint[] {
  return months.slice(-CHART_MONTHS).map((row) => {
    const key = row.month.slice(0, 7)
    return {
      key,
      label: formatMonth(key, locale).split(' ')[0]?.slice(0, 3) ?? key,
      values: {
        // Manfiy oy ustunni o'qdan chiqarib yubormaydi.
        monthly: Math.max(row.balance, 0),
        accumulated: Math.max(row.accumulated, 0),
      },
    }
  })
}
