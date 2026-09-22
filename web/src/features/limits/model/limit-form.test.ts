import { describe, expect, it } from 'vitest'

import { limitFormSchema } from '@/features/limits/model/limit-form'

describe('limitFormSchema (BR-130)', () => {
  const schema = limitFormSchema('UZS')
  it('summa tiyinda, ogohlantirishlar', () => {
    expect(
      schema.parse({ categoryId: 'c', amount: '2 000 000', alert80: true, alert100: false }),
    ).toEqual({ categoryId: 'c', amount: 200000000, alert80: true, alert100: false })
  })
  it.each(['', '0', '-5', 'abc'])('summa %j — rad etiladi', (amount) => {
    expect(
      schema.safeParse({ categoryId: 'c', amount, alert80: true, alert100: true }).success,
    ).toBe(false)
  })
  it('kategoriyasiz — rad etiladi', () => {
    expect(
      schema.safeParse({ categoryId: '', amount: '100', alert80: true, alert100: true }).success,
    ).toBe(false)
  })
})
