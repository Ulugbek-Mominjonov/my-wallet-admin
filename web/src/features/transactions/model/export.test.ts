import { describe, expect, it } from 'vitest'

import type { Account } from '@/entities/account'
import type { Category } from '@/entities/category'
import type { Transaction } from '@/entities/transaction'
import { exportFileName, transactionsCsv } from '@/features/transactions/model/export'
import type { TransactionLookup } from '@/features/transactions/model/labels'
import { i18n } from '@/shared/i18n'

const account = (id: string, name: string, currency = 'UZS') =>
  ({ id, name, currency, type: 'card' }) as Account
const lookup: TransactionLookup = {
  accounts: new Map([
    ['cash', account('cash', 'Naqd')],
    ['usd', account('usd', 'Dollar', 'USD')],
  ]),
  categories: new Map([['food', { id: 'food', name: 'Oziq-ovqat' } as Category]]),
  tags: new Map([
    ['t1', { id: 't1', name: "Ta'til", color: null }],
    ['t2', { id: 't2', name: 'Ish', color: null }],
  ]),
  members: new Map([['u1', 'Ali']]),
}
const tx = (overrides: Partial<Transaction>): Transaction => ({
  id: 'x',
  kind: 'expense',
  accountId: 'cash',
  toAccountId: null,
  amount: 5000000,
  toAmount: null,
  amountBase: 5000000,
  categoryId: 'food',
  payee: 'Korzinka',
  occurredOn: '2026-09-03',
  budgetMonth: '2026-09-01',
  budgetMonthSource: 'auto',
  plannedItemId: null,
  debtId: null,
  note: null,
  createdBy: 'u1',
  tagIds: [],
  hasReceipt: false,
  ...overrides,
})

describe('transactionsCsv (E23-T03)', () => {
  it('sarlavha UI tilida; nomlar spravochnikdan; summa asosiy birlikda', () => {
    const csv = transactionsCsv(
      [
        tx({ tagIds: ['t1', 't2'], note: 'haftalik, katta' }),
        tx({
          accountId: 'usd',
          amount: 12050,
          amountBase: 151830000,
          payee: '=cmd',
          createdBy: null,
        }),
      ],
      lookup,
      { t: i18n.t, baseCurrency: 'UZS' },
    )
    const [header, first, second] = csv.replace('﻿', '').split('\r\n')
    expect(header).toBe(
      'Sana,Turi,Summa,Valyuta,Summa (UZS),Kategoriya,Joy / nomi,Hisob,Qaysi hisobga,Tegishli oy,Teglar,Izoh,Kim',
    )
    expect(first).toBe(
      '2026-09-03,Xarajat,50000,UZS,50000,Oziq-ovqat,Korzinka,Naqd,,2026-09,Ta\'til; Ish,"haftalik, katta",Ali',
    )
    expect(second).toBe("2026-09-03,Xarajat,120.5,USD,1518300,Oziq-ovqat,'=cmd,Dollar,,2026-09,,,")
  })
})

describe('exportFileName', () => {
  it('davrdan', () => {
    expect(exportFileName('amallar', { mode: 'month', month: '2026-09' })).toBe(
      'amallar-2026-09.csv',
    )
    expect(exportFileName('amallar', { mode: 'all' })).toBe('amallar-all.csv')
    expect(exportFileName('amallar', { mode: 'range', from: '2026-01-01', to: undefined })).toBe(
      'amallar-2026-01-01_.csv',
    )
  })
})
