import { describe, expect, it } from 'vitest'

import type { DebtsReport, GoalsReport } from '@/features/reports/api/reports-api'
import { monthReportRows, obligationsRows } from '@/features/reports/model/export-rows'
import { MONTH_REPORT } from '@/features/reports/testing'
import { i18n } from '@/shared/i18n'

const labels = {
  t: i18n.t,
  major: (minor: number) => minor / 100,
  month: (iso: string) => iso.slice(0, 7),
}

describe('monthReportRows (E24-T06)', () => {
  it('yakun, daromad turlari, kategoriyalar va to‘lanmaganlar — bo‘sh qator bilan ajratilgan', () => {
    const rows = monthReportRows({ ...MONTH_REPORT, by_type: [] }, labels)
    expect(rows[0]).toEqual(['Yakun', '2026-09'])
    // Summalar asosiy birlikda (jadval dasturi hisoblay oladi).
    expect(rows[1]).toEqual(['Daromad', 8000000])
    expect(rows.filter((row) => row.length === 0)).toHaveLength(3)
    const unpaid = rows.at(-1)
    expect(unpaid?.[0]).toBe('Ijara')
    // Summasi noma'lum reja — bo'sh katak.
    expect(unpaid?.[2]).toBeNull()
  })
})

describe('obligationsRows', () => {
  it('qarz va maqsad bo‘limlari; noma‘lum qiymatlar bo‘sh', () => {
    const debts = {
      debts: [
        {
          debt_id: 'd1',
          name: 'Kredit',
          direction: 'i_owe',
          currency: 'UZS',
          total: 100,
          paid_before: 0,
          monthly_payment: null,
          due_date: null,
          archived: false,
          paid_in_app: 0,
          pending_amount: 0,
          pending_count: 0,
          remaining: 100,
          progress: 0,
          months_left: null,
          end_month: null,
          status: 'unlinked',
        },
      ],
      totals: { i_owe: 100, owed_to_me: 0, monthly_obligation: 0, net: -100, paid_this_month: 0 },
    } as DebtsReport
    const goals = { avg_monthly_saved: 0, goals: [] } as GoalsReport
    const rows = obligationsRows(debts, goals, labels)
    expect(rows[1]).toEqual(['Kredit', 1, null, null, 'unlinked'])
  })
})
