import { describe, expect, it } from 'vitest'

import { goalFormSchema } from '@/features/goals/model/goal-form'

const valid = {
  name: 'Ta’til',
  currency: 'UZS',
  target: '20 000 000',
  accountId: '',
  savedManual: '5 000 000',
  monthlyContribution: '1 000 000',
  deadline: '2027-06',
}

describe('goalFormSchema (BR-120..122)', () => {
  it('qo‘lda yig‘ilgan va muddat (oy boshi)', () => {
    expect(goalFormSchema.parse(valid)).toEqual({
      name: 'Ta’til',
      currency: 'UZS',
      target: 2000000000,
      savedManual: 500000000,
      monthlyContribution: 100000000,
      deadline: '2027-06-01',
      accountId: null,
    })
  })

  it('hisobga bog‘langan — qo‘lda summa saqlanmaydi (yig‘ilgan = qoldiq)', () => {
    expect(goalFormSchema.parse({ ...valid, accountId: 'a-deposit' })).toMatchObject({
      accountId: 'a-deposit',
      savedManual: 0,
    })
  })

  it.each([
    [{ target: '0' }, 'target'],
    [{ savedManual: 'abc' }, 'savedManual'],
    [{ monthlyContribution: '0' }, 'monthlyContribution'],
  ])('%j — %s xatosi', (patch, path) => {
    const issues = goalFormSchema.safeParse({ ...valid, ...patch }).error?.issues ?? []
    expect(issues.map((i) => i.path.join('.'))).toContain(path)
  })
})
