import { describe, expect, it } from 'vitest'

import type { MonthReport } from '@/features/reports/api/reports-api'
import { incomeOutsideTypes } from '@/features/reports/model/month-report'

const report = (income: number, types: { card: number; cash: number }[]) =>
  ({
    totals: { income },
    by_type: types.map((t, i) => ({ category_id: `c${String(i)}`, name: `T${String(i)}`, ...t })),
  }) as MonthReport

describe('incomeOutsideTypes (BR-092)', () => {
  it('ro‘yxatdagi turlardan ortiq daromad — farq', () => {
    expect(incomeOutsideTypes(report(1000, [{ card: 600, cash: 100 }]))).toBe(300)
  })

  it('hammasi ro‘yxatda yoki ortiq — nol (manfiy bo‘lmaydi)', () => {
    expect(incomeOutsideTypes(report(700, [{ card: 600, cash: 100 }]))).toBe(0)
    expect(incomeOutsideTypes(report(500, [{ card: 600, cash: 100 }]))).toBe(0)
  })
})
