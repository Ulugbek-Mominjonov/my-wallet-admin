import { describe, expect, it } from 'vitest'

import { formatDateTime } from '@/shared/lib/date'

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
