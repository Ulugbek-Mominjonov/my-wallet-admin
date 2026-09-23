import { describe, expect, it } from 'vitest'

import { guessMapping, normalizeDate, toImportRows } from '@/features/tools/model/import-csv'

describe('guessMapping (E25-T03)', () => {
  it('sarlavhadan uz/ru/en nomlarini topadi, bir ustun bir marta', () => {
    expect(guessMapping(['Sana', 'Summa', 'Joy / nomi', 'Kategoriya', 'Hisob'])).toEqual({
      occurred_on: 0,
      amount: 1,
      payee: 2,
      category: 3,
      account: 4,
      note: null,
    })
    expect(guessMapping(['Дата', 'Сумма', 'Назначение'])).toMatchObject({
      occurred_on: 0,
      amount: 1,
      payee: 2,
      category: null,
    })
  })

  it('noma’lum sarlavha — tanlanmagan', () => {
    expect(guessMapping(['col1', 'col2'])).toEqual({
      occurred_on: null,
      amount: null,
      payee: null,
      category: null,
      account: null,
      note: null,
    })
  })
})

describe('normalizeDate', () => {
  it('ISO va kun.oy.yil ko‘rinishlari', () => {
    expect(normalizeDate('2026-09-05')).toBe('2026-09-05')
    expect(normalizeDate('5.9.2026')).toBe('2026-09-05')
    expect(normalizeDate('05/09/2026')).toBe('2026-09-05')
    expect(normalizeDate('shanba')).toBeNull()
  })
})

describe('toImportRows', () => {
  it('summa tiyinda va ishorasi bilan; bo‘sh kataklar — bo‘sh satr', () => {
    const mapping = { occurred_on: 0, amount: 1, payee: 2, category: 3, account: null, note: null }
    expect(
      toImportRows(
        [
          ['05.09.2026', '-25 000,50', ' Makro ', 'Oziq-ovqat'],
          ['2026-09-06', '9 000 000', '', ''],
        ],
        mapping,
        'UZS',
      ),
    ).toEqual([
      {
        occurred_on: '2026-09-05',
        amount: -2500050,
        payee: 'Makro',
        category: 'Oziq-ovqat',
        account: '',
        note: '',
      },
      {
        occurred_on: '2026-09-06',
        amount: 900000000,
        payee: '',
        category: '',
        account: '',
        note: '',
      },
    ])
  })
})
