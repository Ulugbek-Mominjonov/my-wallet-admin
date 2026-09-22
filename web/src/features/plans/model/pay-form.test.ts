import { describe, expect, it } from 'vitest'

import type { PlannedItem } from '@/entities/planned-item'
import { payFormDefaults, payFormSchema } from '@/features/plans/model/pay-form'

const ACCOUNTS: Record<string, { currency: string }> = {
  cash: { currency: 'UZS' },
  usd: { currency: 'USD' },
}
const accountOf = (id: string) => ACCOUNTS[id]
const plan: PlannedItem = {
  id: 'p1',
  kind: 'expense',
  name: 'Ijara',
  categoryId: 'c1',
  accountId: 'cash',
  plannedAmount: 300000000,
  paidAmount: 100000000,
  dueDate: '2026-09-05',
  budgetMonth: '2026-09-01',
  autoPay: false,
  debtId: null,
  systemCode: null,
  settled: false,
  skipped: false,
}

describe('payFormDefaults (BR-073)', () => {
  it('qolgan summa rejaning hisobida', () => {
    expect(payFormDefaults(plan, { today: '2026-09-22', baseCurrency: 'UZS', accountOf })).toEqual({
      amount: '2 000 000',
      accountId: 'cash',
      date: '2026-09-22',
      settle: false,
    })
  })

  it('summasi noma’lum yoki hisob boshqa valyutada — summa bo‘sh (kiritish shart)', () => {
    const defaults = { today: '2026-09-22', baseCurrency: 'UZS', accountOf }
    expect(payFormDefaults({ ...plan, plannedAmount: null }, defaults).amount).toBe('')
    expect(payFormDefaults({ ...plan, accountId: 'usd' }, defaults).amount).toBe('')
    expect(payFormDefaults({ ...plan, accountId: null }, defaults).accountId).toBe('')
  })
})

describe('payFormSchema', () => {
  const schema = payFormSchema(accountOf)
  it('summa hisob valyutasida', () => {
    expect(
      schema.parse({ amount: '120,5', accountId: 'usd', date: '2026-09-22', settle: true }),
    ).toEqual({ amount: 12050, accountId: 'usd', date: '2026-09-22', settle: true })
  })

  it('hisob va summa majburiy', () => {
    const issues = (values: object) =>
      schema.safeParse(values).error?.issues.map((i) => i.message) ?? []
    expect(issues({ amount: '0', accountId: 'cash', date: '2026-09-22', settle: false })).toEqual([
      'amount',
    ])
    expect(issues({ amount: '5', accountId: '', date: '2026-09-22', settle: false })).toEqual([
      'accountId',
    ])
  })
})
