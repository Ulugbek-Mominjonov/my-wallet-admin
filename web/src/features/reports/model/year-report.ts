import type { YearReport } from '@/features/reports/api/reports-api'
import type { AppLocale } from '@/shared/config/locale'
import { formatMonth } from '@/shared/lib/month'
import type { ChartPoint } from '@/shared/ui/chart/column-chart'

/** Yillik grafik nuqtalari: oy qisqartmasi, daromad/xarajat va orttirgan. */
export function yearChartPoints(months: YearReport['months'], locale: AppLocale): ChartPoint[] {
  return months.map((month) => {
    const key = month.month.slice(0, 7)
    return {
      key,
      label: formatMonth(key, locale).split(' ')[0]?.slice(0, 3) ?? key,
      values: {
        income: month.income,
        expense: month.expense,
        // Manfiy oy chiziqni o'qdan tashqariga olib chiqmaydi.
        saved: Math.max(month.saved, 0),
      },
    }
  })
}
