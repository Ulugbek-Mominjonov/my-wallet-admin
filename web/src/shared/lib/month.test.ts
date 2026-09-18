import { describe, expect, it } from 'vitest'

import { currentMonthKey, formatMonth, isMonthKey, shiftMonth } from '@/shared/lib/month'

describe('oy kaliti', () => {
  it('YYYY-MM formatini tekshiradi', () => {
    expect(isMonthKey('2026-09')).toBe(true)
    expect(isMonthKey('2026-13')).toBe(false)
    expect(isMonthKey('2026-9')).toBe(false)
  })

  it('BR-040: oldingi oyga surish yil chegarasidan o‘tadi', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2025-12', 1)).toBe('2026-01')
    expect(shiftMonth('2026-09', -13)).toBe('2025-08')
  })

  it('BR-002: joriy oy byudjet vaqt zonasida (Toshkent = UTC+5)', () => {
    // 2026-09-30 20:30 UTC = 2026-10-01 01:30 Toshkent
    expect(currentMonthKey(new Date('2026-09-30T20:30:00Z'))).toBe('2026-10')
    expect(currentMonthKey(new Date('2026-09-30T18:30:00Z'))).toBe('2026-09')
  })

  it('oy nomi tilga qarab', () => {
    expect(formatMonth('2026-09')).toBe('Sentabr 2026')
    expect(formatMonth('2026-09', 'ru')).toBe('Сентябрь 2026')
    expect(formatMonth('2026-09', 'en')).toBe('September 2026')
  })
})
