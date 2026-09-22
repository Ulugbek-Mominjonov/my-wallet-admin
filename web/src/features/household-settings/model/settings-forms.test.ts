import { describe, expect, it } from 'vitest'

import {
  fundFormDefaults,
  fundFormSchema,
  generalFormSchema,
} from '@/features/household-settings/model/settings-forms'

const settings = {
  id: 'h',
  name: 'Uy',
  baseCurrency: 'UZS',
  timezone: 'Asia/Tashkent',
  fundMode: 'percent' as const,
  fundPercent: 10,
  fundFixedAmount: 0,
  fundDay: 5,
  fundSourceAccountId: 'a-cash',
  autoOpenMonth: true,
  strictMonthLock: false,
}

describe('generalFormSchema', () => {
  it('nom 1–80, qirqiladi', () => {
    expect(generalFormSchema.parse({ name: ' Oila ', timezone: 'Asia/Tashkent' }).name).toBe('Oila')
    expect(generalFormSchema.safeParse({ name: 'x'.repeat(81), timezone: 'UTC' }).success).toBe(
      false,
    )
  })
})

describe('fundFormSchema (BR-060)', () => {
  const schema = fundFormSchema('UZS')
  it("foiz rejimi: vergul ham, manba bo'sh — null", () => {
    expect(
      schema.parse({ ...fundFormDefaults(settings), fundPercent: '12,5', fundSourceAccountId: '' }),
    ).toEqual({
      fundMode: 'percent',
      fundPercent: 12.5,
      fundFixedAmount: 0,
      fundDay: 5,
      fundSourceAccountId: null,
    })
  })

  it("qat'iy rejim: summa tiyinda", () => {
    expect(
      schema.parse({ ...fundFormDefaults(settings), fundMode: 'fixed', fundFixedAmount: '500 000' })
        .fundFixedAmount,
    ).toBe(50000000)
  })

  it.each([
    [{ fundPercent: '101' }, 'fundPercent'],
    [{ fundPercent: '10.555' }, 'fundPercent'],
    [{ fundPercent: 'abc' }, 'fundPercent'],
    [{ fundDay: '0' }, 'fundDay'],
    [{ fundDay: '32' }, 'fundDay'],
  ])('%j — %s xatosi', (patch, path) => {
    const issues = schema.safeParse({ ...fundFormDefaults(settings), ...patch }).error?.issues ?? []
    expect(issues.map((i) => i.path.join('.'))).toContain(path)
  })
})
