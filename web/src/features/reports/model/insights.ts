import type { Insights, YearReport } from '@/features/reports/api/reports-api'

/** Yil xulosasi — yozuvi bor oylar bo'yicha (bo'sh oylar o'rtachani pasaytirmasin). */
export interface YearSummary {
  income: number
  expense: number
  saved: number
  savedRatio: number
  monthsCount: number
  avgIncome: number
  avgExpense: number
  /** Eng ko'p va eng kam orttirilgan oylar (yozuvi bor oylardan). */
  best: YearReport['months'][number] | null
  worst: YearReport['months'][number] | null
}

/** E32-T02: yillik ko'rinish ustidagi qisqa yakun — `report_year` dan hisoblanadi. */
export function yearSummary(data: YearReport): YearSummary {
  const months = data.months.filter((month) => month.has_records)
  const count = months.length
  const sorted = [...months].sort((a, b) => a.saved - b.saved)
  return {
    income: data.totals.income,
    expense: data.totals.expense,
    saved: data.totals.saved,
    savedRatio: data.totals.saved_ratio,
    monthsCount: count,
    avgIncome: count === 0 ? 0 : Math.round(data.totals.income / count),
    avgExpense: count === 0 ? 0 : Math.round(data.totals.expense / count),
    best: sorted.at(-1) ?? null,
    worst: count > 1 ? (sorted[0] ?? null) : null,
  }
}

/** Obunalarning yiliga tushadigan summasi — "oyiga X · yiliga 12X" izohi uchun. */
export const yearlyTotal = (monthly: number): number => monthly * 12

/** Hafta kunlari eng ko'p sarflangan kun (yozuv bo'lmasa — `null`). */
export function busiestWeekday(weekdays: Insights['weekdays']): number | null {
  const top = [...weekdays].sort((a, b) => b.amount - a.amount)[0]
  return top && top.amount > 0 ? top.dow : null
}
