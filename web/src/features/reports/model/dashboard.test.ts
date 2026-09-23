import { describe, expect, it } from 'vitest'

import type { MonthReport } from '@/features/reports/api/reports-api'
import { dashboardFlow, topCategories } from '@/features/reports/model/dashboard'
import { shiftMonth } from '@/shared/lib/month'

const month = (m: string, income: number, expense: number) => ({
  month: `${m}-01`,
  income,
  expense,
  balance: income - expense,
})

describe('dashboardFlow (E24-T01)', () => {
  it('so‘nggi 12 oy, qisqa yorliq; orttirgan manfiy bo‘lmaydi', () => {
    // 2025-08 dan 2026-08 gacha (yil chegarasidan o'tadi).
    const months = Array.from({ length: 13 }, (_, i) => month(shiftMonth('2025-08', i), 1000, 400))
    const flow = dashboardFlow([...months, month('2026-09', 500, 900)], 'uz')

    expect(flow).toHaveLength(12)
    expect(flow.at(-1)).toEqual({
      key: '2026-09',
      label: 'Sen',
      values: { income: 500, expense: 900, saved: 0 },
    })
    expect(flow[0]?.key).toBe('2025-10')
  })
})

describe('topCategories', () => {
  const row = (id: string, name: string, actualTotal: number, parentId: string | null = null) =>
    ({
      category_id: id,
      name,
      parent_id: parentId,
      planned: 0,
      actual: actualTotal,
      actual_total: actualTotal,
      limit: null,
      limit_ratio: null,
      limit_status: null,
    }) satisfies MonthReport['by_category'][number]

  it('faqat yuqori daraja, kamayish bo‘yicha; nol va subkategoriyalar kirmaydi', () => {
    const { items, total } = topCategories([
      row('a', 'Oziq-ovqat', 300),
      row('b', 'Transport', 500),
      row('c', 'Taksi', 200, 'b'),
      row('d', 'Kiyim', 0),
    ])
    expect(items).toEqual([
      { id: 'b', name: 'Transport', amount: 500 },
      { id: 'a', name: 'Oziq-ovqat', amount: 300 },
    ])
    expect(total).toBe(800)
  })

  it('7 tadan ko‘pi — qolgani "Boshqalar" ga yig‘iladi', () => {
    const rows = Array.from({ length: 10 }, (_, i) => row(`c${String(i)}`, `K${String(i)}`, 10 - i))
    const { items } = topCategories(rows)
    expect(items).toHaveLength(8)
    expect(items.at(-1)).toEqual({ id: 'other', name: 'other', amount: 3 + 2 + 1 })
  })
})
