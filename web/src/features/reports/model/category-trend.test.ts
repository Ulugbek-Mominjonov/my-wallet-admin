import { describe, expect, it } from 'vitest'

import type { Category } from '@/entities/category'
import { compareRows, trendPoints } from '@/features/reports/model/category-trend'

const categories = new Map<string, Category>([
  ['c1', { id: 'c1', name: 'Oziq-ovqat' } as Category],
  ['c2', { id: 'c2', name: 'Transport' } as Category],
])

describe('trendPoints (BR-095)', () => {
  const series = [
    { month: '2026-08-01', category_id: 'c1', actual: 300 },
    { month: '2026-08-01', category_id: 'c2', actual: 200 },
    { month: '2026-09-01', category_id: 'c1', actual: 400 },
  ]

  it('kategoriyasiz — oylar bo‘yicha yig‘indi, o‘sish tartibida', () => {
    expect(trendPoints(series, null, 'uz')).toEqual([
      { key: '2026-08', label: 'Avg', values: { actual: 500 } },
      { key: '2026-09', label: 'Sen', values: { actual: 400 } },
    ])
  })

  it('kategoriya tanlansa — faqat o‘sha', () => {
    expect(trendPoints(series, 'c2', 'uz')).toEqual([
      { key: '2026-08', label: 'Avg', values: { actual: 200 } },
    ])
  })
})

describe('compareRows', () => {
  it('nomlar spravochnikdan, kamayish bo‘yicha; noma’lum kategoriya belgilanadi', () => {
    const rows = compareRows(
      [
        { category_id: 'c1', actual: 100, prev: 50, avg3: 80, vs_prev: 1, vs_avg3: 0.25 },
        { category_id: 'c9', actual: 300, prev: 0, avg3: 0, vs_prev: null, vs_avg3: null },
      ],
      categories,
      "O'chirilgan",
    )
    expect(rows.map((r) => r.name)).toEqual(["O'chirilgan", 'Oziq-ovqat'])
    expect(rows[0]?.vsPrev).toBeNull()
    expect(rows[1]?.vsPrev).toBe(1)
  })
})
