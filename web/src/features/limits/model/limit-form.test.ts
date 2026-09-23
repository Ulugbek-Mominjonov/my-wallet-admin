import { describe, expect, it } from 'vitest'

import { limitFormSchema } from '@/features/limits/model/limit-form'

describe('limitFormSchema (BR-130)', () => {
  const schema = limitFormSchema('UZS')
  const base = {
    categoryId: 'c',
    alert80: true,
    alert100: true,
    rollover: false,
    rolloverNegative: false,
  }

  it('summa tiyinda, ogohlantirishlar', () => {
    expect(schema.parse({ ...base, amount: '2 000 000', alert100: false })).toEqual({
      ...base,
      amount: 200000000,
      alert100: false,
    })
  })

  it("BR-134: manfiy qoldiq rollover o'chiq bo'lsa saqlanmaydi", () => {
    expect(
      schema.parse({ ...base, amount: '100', rollover: false, rolloverNegative: true }),
    ).toMatchObject({ rollover: false, rolloverNegative: false })
    expect(
      schema.parse({ ...base, amount: '100', rollover: true, rolloverNegative: true }),
    ).toMatchObject({ rollover: true, rolloverNegative: true })
  })
  it.each(['', '0', '-5', 'abc'])('summa %j — rad etiladi', (amount) => {
    expect(schema.safeParse({ ...base, amount }).success).toBe(false)
  })
  it('kategoriyasiz — rad etiladi', () => {
    expect(schema.safeParse({ ...base, categoryId: '', amount: '100' }).success).toBe(false)
  })
})
