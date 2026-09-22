import { describe, expect, it } from 'vitest'

import { quickActionFormSchema } from '@/features/quick-actions/model/quick-action-form'

describe('quickActionFormSchema (BR-120)', () => {
  const schema = quickActionFormSchema('UZS')
  const valid = { name: ' Kofe ', amount: '25 000', categoryId: 'c', accountId: 'a', payee: '' }
  it("nom qirqiladi, bo'sh joy — null", () => {
    expect(schema.parse(valid)).toEqual({
      name: 'Kofe',
      amount: 2500000,
      categoryId: 'c',
      accountId: 'a',
      payee: null,
    })
  })
  it.each([
    [{ amount: '0' }, 'amount'],
    [{ accountId: '' }, 'accountId'],
    [{ categoryId: '' }, 'categoryId'],
  ])('%j — %s xatosi', (patch, path) => {
    const issues = schema.safeParse({ ...valid, ...patch }).error?.issues ?? []
    expect(issues.map((i) => i.path.join('.'))).toContain(path)
  })
})
