import { describe, expect, it } from 'vitest'

import { cardFormSchema, matchSample, templateFormSchema } from '@/features/platform/model/forms'

const card = {
  bank: 'Kapitalbank',
  pattern: '(?<amount>[0-9 ]+) UZS (?<payee>.+)',
  kind: 'expense' as const,
  amount_unit: 'major' as const,
  currency: 'UZS',
  sample: '',
  active: true,
  sort_order: '0',
}

describe('cardFormSchema (E26-T01, BR-222)', () => {
  it('naqshda `amount` guruhi va to‘g‘ri regex talab qilinadi', () => {
    expect(cardFormSchema.safeParse(card).success).toBe(true)
    expect(cardFormSchema.safeParse({ ...card, pattern: '(?<sum>[0-9]+) UZS' }).success).toBe(false)
    expect(cardFormSchema.safeParse({ ...card, pattern: '(?<amount>[0-9+' }).success).toBe(false)
  })
})

describe('templateFormSchema (BR-031)', () => {
  it('oy siljishi faqat daromad turida', () => {
    const base = {
      name_i18n: { uz: 'X', ru: 'X', en: 'X' },
      icon: 'cart',
      color: '#22C55E',
      sort_order: '1',
    }
    expect(
      templateFormSchema.safeParse({ ...base, kind: 'income', month_shift: '-1' }).success,
    ).toBe(true)
    expect(
      templateFormSchema.safeParse({ ...base, kind: 'expense', month_shift: '-1' }).success,
    ).toBe(false)
  })
})

describe('matchSample', () => {
  it('namunadan guruhlarni ajratadi; mos kelmasa — null', () => {
    expect(matchSample('(?<amount>[0-9 ]+) UZS (?<payee>.+)', '25 000 UZS KORZINKA')).toEqual({
      amount: '25 000',
      payee: 'KORZINKA',
    })
    expect(matchSample('(?<amount>[0-9]+) UZS', 'boshqa xabar')).toBeNull()
    expect(matchSample('(?<amount>[0-9+', 'x')).toBe('invalid')
  })
})
