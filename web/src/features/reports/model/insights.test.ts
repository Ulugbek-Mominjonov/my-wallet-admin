import { describe, expect, it } from 'vitest'

import type { YearReport } from '@/features/reports/api/reports-api'
import { busiestWeekday, yearSummary } from '@/features/reports/model/insights'

const month = (key: string, income: number, expense: number, hasRecords = true) => ({
  month: `${key}-01`,
  income,
  expense,
  allocated: 0,
  fund_spent: 0,
  balance: income - expense,
  forecast: income - expense,
  saved: income - expense,
  saved_ratio: income === 0 ? 0 : (income - expense) / income,
  spent_ratio: income === 0 ? 0 : expense / income,
  plan_ratio: null,
  closed: false,
  has_records: hasRecords,
})

const report = (months: YearReport['months']): YearReport => {
  const sum = (key: 'income' | 'expense' | 'saved') =>
    months.reduce((total, m) => total + m[key], 0)
  return {
    year: 2026,
    months,
    totals: {
      income: sum('income'),
      expense: sum('expense'),
      allocated: 0,
      fund_spent: 0,
      balance: sum('saved'),
      forecast: sum('saved'),
      saved: sum('saved'),
      saved_ratio: sum('income') === 0 ? 0 : sum('saved') / sum('income'),
      spent_ratio: 0,
      plan_ratio: null,
    },
  }
}

describe('yearSummary', () => {
  it("o'rtacha faqat yozuvi bor oylar bo'yicha; eng yaxshi va eng og'ir oy", () => {
    const data = report([
      month('2026-01', 1000, 400),
      month('2026-02', 1000, 900),
      month('2026-03', 0, 0, false),
    ])

    const summary = yearSummary(data)
    expect(summary).toMatchObject({ monthsCount: 2, avgIncome: 1000, avgExpense: 650 })
    expect(summary.best?.month).toBe('2026-01-01')
    expect(summary.worst?.month).toBe('2026-02-01')
  })

  it("bitta oy bo'lsa — eng og'ir oy ko'rsatilmaydi (o'zi bilan solishtirilmaydi)", () => {
    const summary = yearSummary(
      report([month('2026-01', 1000, 400), month('2026-02', 0, 0, false)]),
    )
    expect(summary.best?.month).toBe('2026-01-01')
    expect(summary.worst).toBeNull()
  })

  it("yozuvsiz yil — o'rtacha 0, oylar yo'q", () => {
    const summary = yearSummary(report([month('2026-01', 0, 0, false)]))
    expect(summary).toMatchObject({ monthsCount: 0, avgIncome: 0, avgExpense: 0, best: null })
  })
})

describe('busiestWeekday', () => {
  const week = (amounts: number[]) =>
    amounts.map((amount, index) => ({ dow: index + 1, amount, count: amount === 0 ? 0 : 1 }))

  it('eng ko‘p sarflangan kun (ISO raqami)', () => {
    expect(busiestWeekday(week([0, 100, 0, 0, 0, 900, 0]))).toBe(6)
  })

  it('xarajat bo‘lmasa — null', () => {
    expect(busiestWeekday(week([0, 0, 0, 0, 0, 0, 0]))).toBeNull()
  })
})
