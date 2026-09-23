import { describe, expect, it } from 'vitest'

import { accountFormDefaults, accountFormSchema } from '@/features/accounts/model/account-form'

const valid = {
  name: '  Humo  ',
  type: 'card' as const,
  currency: 'UZS',
  openingBalance: '1 500 000',
  openingDate: '2026-09-01',
  icon: 'credit-card',
  color: '#3B82F6',
  cardLast4: ' 4455 ',
}

describe('accountFormSchema', () => {
  it('nom qirqiladi, summa tiyinga aylanadi (BR-001)', () => {
    expect(accountFormSchema.parse(valid)).toEqual({
      ...valid,
      name: 'Humo',
      openingBalance: 150000000,
      cardLast4: '4455',
    })
  })

  it("bo'sh boshlang'ich qoldiq — 0; kredit karta — manfiy", () => {
    expect(accountFormSchema.parse({ ...valid, openingBalance: '' }).openingBalance).toBe(0)
    expect(accountFormSchema.parse({ ...valid, openingBalance: '-2 000' }).openingBalance).toBe(
      -200000,
    )
  })

  it("karta raqami — bo'sh bo'lsa null (BR-222)", () => {
    expect(accountFormSchema.parse({ ...valid, cardLast4: '' }).cardLast4).toBeNull()
  })

  it.each([
    ['name', ''],
    ['name', 'x'.repeat(61)],
    ['openingBalance', '1,234'],
    ['openingBalance', 'abc'],
    ['openingDate', '2026-13-01'],
    ['type', 'crypto'],
    ['cardLast4', '123'],
    ['cardLast4', '12a4'],
  ])('%s = %j — rad etiladi', (field, value) => {
    const result = accountFormSchema.safeParse({ ...valid, [field]: value })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual([field])
  })

  it("tahrirlashda forma qiymatlari qayta o'qilganda o'sha summa", () => {
    const values = accountFormDefaults(
      {
        id: 'a',
        name: 'Karta',
        type: 'card',
        currency: 'UZS',
        openingBalance: 123456750,
        openingDate: '2026-09-01',
        icon: null,
        color: null,
        cardLast4: '8600',
        sortOrder: 0,
        archivedAt: null,
        balance: 0,
      },
      { currency: 'UZS', today: '2026-09-22' },
    )
    expect(accountFormSchema.parse(values)).toMatchObject({
      openingBalance: 123456750,
      cardLast4: '8600',
    })
  })
})
