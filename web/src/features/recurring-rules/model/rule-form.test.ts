import { describe, expect, it } from 'vitest'

import { ruleFormDefaults, ruleFormSchema } from '@/features/recurring-rules/model/rule-form'

const schema = ruleFormSchema('UZS')
const valid = {
  kind: 'expense' as const,
  name: ' Ijara ',
  categoryId: 'c-rent',
  accountId: '',
  amount: '3 000 000',
  dayOfMonth: '5',
  autoPay: false,
  active: true,
  startMonth: '2026-10',
  endMonth: '',
}

const pathsOf = (values: object) =>
  schema.safeParse(values).error?.issues.map((i) => i.path.join('.')) ?? []

describe('ruleFormSchema (BR-080)', () => {
  it('server qiymatlari: summa tiyinda, oy boshi, bo‘sh — null', () => {
    expect(schema.parse(valid)).toEqual({
      kind: 'expense',
      name: 'Ijara',
      categoryId: 'c-rent',
      accountId: null,
      amount: 300000000,
      dayOfMonth: 5,
      autoPay: false,
      active: true,
      startMonth: '2026-10-01',
      endMonth: null,
    })
  })

  it("summa bo'sh — har oy o'zgaradi (null)", () => {
    expect(schema.parse({ ...valid, amount: '' }).amount).toBeNull()
  })

  it('ajratma: kategoriyasiz, manba hisob majburiy', () => {
    expect(pathsOf({ ...valid, kind: 'allocation', categoryId: '' })).toEqual(['accountId'])
    expect(
      schema.parse({ ...valid, kind: 'allocation', categoryId: 'c-rent', accountId: 'a-cash' })
        .categoryId,
    ).toBeNull()
  })

  it.each([
    [{ categoryId: '' }, 'categoryId'],
    [{ amount: '0' }, 'amount'],
    [{ amount: 'abc' }, 'amount'],
    [{ dayOfMonth: '32' }, 'dayOfMonth'],
    [{ dayOfMonth: '0' }, 'dayOfMonth'],
    [{ autoPay: true }, 'autoPay'],
    [{ startMonth: '2026-10', endMonth: '2026-09' }, 'endMonth'],
  ])('%j — %s xatosi', (patch, path) => {
    expect(pathsOf({ ...valid, ...patch })).toContain(path)
  })

  it('avto to‘lov summa va hisob bilan (BR-075)', () => {
    expect(schema.parse({ ...valid, autoPay: true, accountId: 'a-card' }).autoPay).toBe(true)
  })

  it('tahrirlash: forma qiymatlari qayta o‘qilganda o‘sha qoida', () => {
    const values = ruleFormDefaults(
      {
        id: 'r',
        kind: 'income',
        name: 'Oylik',
        categoryId: 'c-salary',
        accountId: 'a-card',
        amount: 800000000,
        dayOfMonth: 2,
        autoPay: false,
        active: true,
        debtId: null,
        startMonth: '2026-01-01',
        endMonth: '2026-12-01',
        sortOrder: 0,
      },
      'UZS',
    )
    expect(schema.parse(values)).toMatchObject({
      amount: 800000000,
      startMonth: '2026-01-01',
      endMonth: '2026-12-01',
    })
  })
})
