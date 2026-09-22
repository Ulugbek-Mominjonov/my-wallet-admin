import { describe, expect, it } from 'vitest'

import { debtFormSchema } from '@/features/debts/model/debt-form'

const valid = {
  name: ' Mashina krediti ',
  direction: 'i_owe' as const,
  currency: 'UZS',
  total: '60 000 000',
  paidBefore: '10 000 000',
  monthlyPayment: '2 500 000',
  dueDate: '2028-01-31',
  note: '',
}

const pathsOf = (values: object) =>
  debtFormSchema.safeParse(values).error?.issues.map((i) => i.path.join('.')) ?? []

describe('debtFormSchema (BR-110)', () => {
  it('summalar tiyinda, bo‘sh maydonlar null', () => {
    expect(debtFormSchema.parse({ ...valid, monthlyPayment: '', dueDate: '' })).toEqual({
      name: 'Mashina krediti',
      direction: 'i_owe',
      currency: 'UZS',
      total: 6000000000,
      paidBefore: 1000000000,
      monthlyPayment: null,
      dueDate: null,
      note: null,
    })
  })

  it.each([
    [{ total: '0' }, 'total'],
    [{ total: '' }, 'total'],
    [{ paidBefore: '70 000 000' }, 'paidBefore'],
    [{ monthlyPayment: '0' }, 'monthlyPayment'],
    [{ dueDate: '2028-02-30' }, 'dueDate'],
  ])('%j — %s xatosi', (patch, path) => {
    expect(pathsOf({ ...valid, ...patch })).toContain(path)
  })
})
