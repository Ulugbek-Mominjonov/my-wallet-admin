import { describe, expect, it } from 'vitest'

import type { Transaction } from '@/entities/transaction'
import {
  transactionFormDefaults,
  transactionFormSchema,
  type AccountInfo,
  type TransactionFormValues,
} from '@/features/transactions/model/transaction-form'

const ACCOUNTS: Record<string, AccountInfo> = {
  cash: { currency: 'UZS', type: 'cash' },
  card: { currency: 'UZS', type: 'card' },
  usd: { currency: 'USD', type: 'card' },
  fund: { currency: 'UZS', type: 'personal_fund' },
}
const schema = transactionFormSchema((id) => ACCOUNTS[id])

const base: TransactionFormValues = {
  ...transactionFormDefaults(undefined, { today: '2026-09-22', currencyOf: () => 'UZS' }),
  amount: '50 000',
  accountId: 'cash',
  categoryId: 'food',
}

const pathsOf = (values: TransactionFormValues) =>
  schema.safeParse(values).error?.issues.map((i) => `${i.path.join('.')}:${i.message}`) ?? []

describe('transactionFormSchema (E23-T02)', () => {
  it('xarajat: summa hisob valyutasida, bo‘sh maydonlar null, oy — qoida bo‘yicha', () => {
    expect(schema.parse({ ...base, payee: ' Korzinka ', tagIds: ['t1'] })).toEqual({
      kind: 'expense',
      accountId: 'cash',
      toAccountId: null,
      amount: 5000000,
      toAmount: null,
      categoryId: 'food',
      payee: 'Korzinka',
      occurredOn: '2026-09-22',
      budgetMonth: null,
      plannedItemId: null,
      debtId: null,
      note: null,
      tagIds: ['t1'],
      fxRate: null,
    })
  })

  it('majburiy maydonlar: summa > 0, hisob, kategoriya', () => {
    expect(pathsOf({ ...base, amount: '0', categoryId: '' })).toEqual([
      'amount:amount',
      'categoryId:categoryId',
    ])
    expect(pathsOf({ ...base, accountId: '' })).toEqual(['accountId:accountId'])
  })

  it('BR-062: fonddan sarfda kategoriya ixtiyoriy; BR-063: daromad fondga emas', () => {
    expect(pathsOf({ ...base, accountId: 'fund', categoryId: '' })).toEqual([])
    expect(pathsOf({ ...base, kind: 'income', accountId: 'fund', categoryId: 'salary' })).toEqual([
      'accountId:fund',
    ])
  })

  it('o‘tkazma: boshqa hisob; turli valyutada tushgan summa majburiy (BR-193)', () => {
    const transfer = { ...base, kind: 'transfer' as const, categoryId: 'food', debtId: 'd1' }
    expect(pathsOf({ ...transfer, toAccountId: 'cash' })).toEqual(['toAccountId:toAccountId'])
    expect(pathsOf({ ...transfer, accountId: 'usd', toAccountId: 'cash', amount: '100' })).toEqual([
      'toAmount:toAmount',
    ])
    expect(
      schema.parse({
        ...transfer,
        accountId: 'usd',
        toAccountId: 'cash',
        amount: '100,50',
        toAmount: '1 260 000',
      }),
    ).toMatchObject({ amount: 10050, toAmount: 126000000, categoryId: null, debtId: null })
    // Bir valyutada — manzil summasini server tenglaydi.
    expect(schema.parse({ ...transfer, toAccountId: 'card', toAmount: '1' }).toAmount).toBeNull()
  })

  it('BR-042: qo‘lda tanlangan oy — oyning 1-kuni', () => {
    expect(schema.parse({ ...base, manualMonth: true, budgetMonth: '2026-08' }).budgetMonth).toBe(
      '2026-08-01',
    )
    expect(pathsOf({ ...base, manualMonth: true, budgetMonth: '' })).toEqual([
      'budgetMonth:budgetMonth',
    ])
  })
})

describe('transactionFormDefaults', () => {
  it('mavjud amal — summa hisob valyutasida, qo‘lda oy saqlanadi', () => {
    const transaction: Transaction = {
      id: 'x',
      kind: 'expense',
      accountId: 'usd',
      toAccountId: null,
      amount: 12050,
      toAmount: null,
      amountBase: 151830000,
      fxRate: null,
      categoryId: 'food',
      payee: null,
      occurredOn: '2026-10-05',
      budgetMonth: '2026-09-01',
      budgetMonthSource: 'manual',
      plannedItemId: null,
      debtId: null,
      note: null,
      createdBy: null,
      tagIds: [],
      hasReceipt: false,
    }
    expect(
      transactionFormDefaults(transaction, {
        today: '2026-10-06',
        currencyOf: (id) => ACCOUNTS[id]?.currency ?? 'UZS',
      }),
    ).toMatchObject({ amount: '120,5', manualMonth: true, budgetMonth: '2026-09', payee: '' })
  })
})
