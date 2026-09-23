import type { TFunction } from 'i18next'

import type { ExportedPlan } from '@/features/tools/api/export-api'
import type { CsvRow } from '@/shared/lib/csv'

/** Reja holati (eksportda qisqa kod — jadvalda saralash oson). */
const status = (plan: ExportedPlan): string => {
  if (plan.skipped_at !== null) return 'skipped'
  if (plan.settled_at !== null) return 'paid'
  return plan.paid_amount > 0 ? 'partial' : 'open'
}

/** Rejalar CSV qatorlari: summalar asosiy birlikda, oy `YYYY-MM`. */
export function planRows(plans: readonly ExportedPlan[], t: TFunction): CsvRow[] {
  return [
    [
      t('export.columns.kind'),
      t('export.columns.name'),
      t('export.columns.month'),
      t('export.columns.due'),
      t('export.columns.planned'),
      t('export.columns.paid'),
      t('export.columns.status'),
    ],
    ...plans.map((plan): CsvRow => [
      plan.kind,
      plan.name,
      plan.budget_month.slice(0, 7),
      plan.due_date,
      plan.planned_amount === null ? null : plan.planned_amount / 100,
      plan.paid_amount / 100,
      status(plan),
    ]),
  ]
}
