import { describe, expect, it } from 'vitest'

import type { YearReport } from '@/features/reports/api/reports-api'
import { yearChartPoints } from '@/features/reports/model/year-report'

const month = (m: string, income: number, expense: number, saved: number) =>
  ({
    month: `${m}-01`,
    income,
    expense,
    allocated: 0,
    fund_spent: 0,
    balance: income - expense,
    forecast: 0,
    saved,
    saved_ratio: 0,
    spent_ratio: 0,
    plan_ratio: null,
    closed: false,
    has_records: true,
  }) satisfies YearReport['months'][number]

describe('yearChartPoints (E24-T03)', () => {
  it('oy qisqartmasi va qatorlar; manfiy orttirgan — nol', () => {
    const points = yearChartPoints(
      [month('2026-01', 1000, 400, 600), month('2026-02', 500, 900, -400)],
      'uz',
    )
    expect(points).toEqual([
      { key: '2026-01', label: 'Yan', values: { income: 1000, expense: 400, saved: 600 } },
      { key: '2026-02', label: 'Fev', values: { income: 500, expense: 900, saved: 0 } },
    ])
  })
})
