import type { TFunction } from 'i18next'

import type { Category } from '@/entities/category'
import type {
  CategoryTrend,
  DebtsReport,
  GoalsReport,
  MonthReport,
  SavingsReport,
  YearReport,
} from '@/features/reports/api/reports-api'
import type { CompareRow } from '@/features/reports/model/category-trend'
import type { CsvRow } from '@/shared/lib/csv'

/** Eksport uchun yorliqlar va formatlash (sahifadagi til bilan bir xil). */
export interface ExportLabels {
  t: TFunction
  /** Eng kichik birlik → asosiy birlikdagi son (jadval dasturi hisoblay olsin). */
  major: (minor: number) => number
  month: (isoMonth: string) => string
}

const BLANK: CsvRow = []

/** Oylik hisobot: yakun, daromad turlari, kategoriyalar va to'lanmaganlar. */
export function monthReportRows(report: MonthReport, labels: ExportLabels): CsvRow[] {
  const { t, major, month } = labels
  const { totals, derived, projection } = report
  return [
    [t('report.summary.title'), month(report.month)],
    [t('report.summary.income'), major(totals.income)],
    [t('report.summary.expense'), major(totals.expense)],
    [t('report.summary.allocated'), major(totals.allocated)],
    [t('report.summary.planned'), major(totals.planned)],
    [t('report.summary.unpaid'), major(totals.unpaid)],
    [t('report.summary.balance'), major(derived.balance)],
    [t('report.summary.forecast'), major(derived.forecast)],
    [t('report.projection.monthEndBalance'), major(projection.month_end_balance)],
    BLANK,
    [t('report.income.type'), t('report.income.card'), t('report.income.cash')],
    ...report.by_type.map((row): CsvRow => [row.name, major(row.card), major(row.cash)]),
    BLANK,
    [
      t('report.categories.category'),
      t('report.categories.planned'),
      t('report.categories.actual'),
      t('report.categories.limit'),
    ],
    ...report.by_category.map((row): CsvRow => [
      row.name,
      major(row.planned),
      major(row.actual_total),
      row.limit === null ? null : major(row.limit),
    ]),
    BLANK,
    [t('report.unpaid.name'), t('report.unpaid.due'), t('report.unpaid.remaining')],
    ...report.unpaid.map((row): CsvRow => [
      row.name,
      row.due_date,
      row.planned_amount === null ? null : major(Math.max(row.planned_amount - row.paid_amount, 0)),
    ]),
  ]
}

/** Yillik ko'rinish: 12 oy va JAMI. */
export function yearReportRows(report: YearReport, labels: ExportLabels): CsvRow[] {
  const { t, major, month } = labels
  return [
    [
      t('report.year.month'),
      t('report.year.income'),
      t('report.year.expense'),
      t('report.year.allocated'),
      t('report.year.balance'),
    ],
    ...report.months.map((row): CsvRow => [
      month(row.month),
      major(row.income),
      major(row.expense),
      major(row.allocated),
      major(row.balance),
    ]),
    [
      t('report.year.total'),
      major(report.totals.income),
      major(report.totals.expense),
      major(report.totals.allocated),
      major(report.totals.balance),
    ],
  ]
}

/** Jamg'arma: oylar va to'planish. */
export function savingsRows(report: SavingsReport, labels: ExportLabels): CsvRow[] {
  const { t, major, month } = labels
  return [
    [
      t('report.savingsPage.month'),
      t('report.savingsPage.income'),
      t('report.savingsPage.expense'),
      t('report.savingsPage.monthly'),
      t('report.savingsPage.accumulated'),
    ],
    ...report.months.map((row): CsvRow => [
      month(row.month),
      major(row.income),
      major(row.expense),
      major(row.balance),
      major(row.accumulated),
    ]),
  ]
}

/** Qarzlar va maqsadlar bitta faylda (ikki bo'lim). */
export function obligationsRows(
  debts: DebtsReport,
  goals: GoalsReport,
  labels: ExportLabels,
): CsvRow[] {
  const { t, major, month } = labels
  return [
    [
      t('report.debtsPage.name'),
      t('report.debtsPage.remaining'),
      t('report.debtsPage.monthly'),
      t('report.debtsPage.end'),
      t('report.debtsPage.status'),
    ],
    ...debts.debts.map((row): CsvRow => [
      row.name,
      major(row.remaining),
      row.monthly_payment === null ? null : major(row.monthly_payment),
      row.end_month === null ? null : month(row.end_month),
      row.status,
    ]),
    BLANK,
    [
      t('report.goalsPage.name'),
      t('report.goalsPage.saved'),
      t('report.goalsPage.remaining'),
      t('report.goalsPage.end'),
      t('report.goalsPage.deadline'),
    ],
    ...goals.goals.map((row): CsvRow => [
      row.name,
      major(row.saved),
      major(row.remaining),
      row.end_month === null ? null : month(row.end_month),
      row.deadline,
    ]),
  ]
}

/** Kategoriya tahlili: solishtirish jadvali va oyma-oy qatorlar. */
export function categoryTrendRows(
  trend: CategoryTrend,
  compare: readonly CompareRow[],
  categories: ReadonlyMap<string, Category>,
  labels: ExportLabels,
): CsvRow[] {
  const { t, major, month } = labels
  return [
    [
      t('report.categoriesPage.category'),
      t('report.categoriesPage.actual'),
      t('report.categoriesPage.prev'),
      t('report.categoriesPage.avg3'),
    ],
    ...compare.map((row): CsvRow => [
      row.name,
      major(row.actual),
      major(row.prev),
      major(row.avg3),
    ]),
    BLANK,
    [
      t('report.categoriesPage.category'),
      t('chart.month'),
      t('report.categoriesPage.actualSeries'),
    ],
    ...trend.series.map((row): CsvRow => [
      categories.get(row.category_id)?.name ?? t('report.categoriesPage.unknown'),
      month(row.month),
      major(row.actual),
    ]),
  ]
}
