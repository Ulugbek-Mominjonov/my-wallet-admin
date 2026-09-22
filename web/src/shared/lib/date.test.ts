import { describe, expect, it } from 'vitest'

import { formatDate, formatDateTime, todayIso } from '@/shared/lib/date'

describe('formatDateTime', () => {
  const value = '2026-09-22T09:05:00Z'

  it('til bo‘yicha formatlaydi va yil, daqiqani saqlaydi', () => {
    for (const locale of ['uz', 'ru', 'en'] as const) {
      const text = formatDateTime(value, locale)
      expect(text).toContain('2026')
      expect(text).toMatch(/:05/)
    }
  })

  it('Date va ISO satr bir xil natija beradi', () => {
    expect(formatDateTime(new Date(value), 'en')).toBe(formatDateTime(value, 'en'))
  })
})

describe('todayIso', () => {
  it('byudjet vaqt zonasida (UTC 19:30 — Toshkentda ertasi kun)', () => {
    const now = new Date('2026-09-22T19:30:00Z')
    expect(todayIso('Asia/Tashkent', now)).toBe('2026-09-23')
    expect(todayIso('UTC', now)).toBe('2026-09-22')
  })
})

describe('formatDate', () => {
  it('sana-kalit kuni siljimaydi (vaqt zonasidan qat’i nazar)', () => {
    for (const locale of ['uz', 'ru', 'en'] as const) {
      const text = formatDate('2026-09-03', locale)
      expect(text).toContain('2026')
      expect(text).toMatch(/03/)
      expect(text).toMatch(/09/)
    }
  })
})
