import type { TFunction } from 'i18next'

import type { Transaction } from '@/entities/transaction'
import type { TransactionLookup } from '@/features/transactions/model/labels'
import type { Period } from '@/features/transactions/model/filters'
import { toCsv } from '@/shared/lib/csv'
import { currencyExponent } from '@/shared/lib/money'

/** Eng kichik birlik → asosiy birlik (CSV — jadval dasturi hisoblay oladigan son). */
const major = (minor: number, currency: string) => minor / 10 ** currencyExponent(currency)

/**
 * E23-T03: joriy filtr bo'yicha amallar CSV'si — sarlavhalar UI tilida, nomlar
 * spravochnikdan, summalar hisob valyutasida va asosiy valyutada.
 */
export function transactionsCsv(
  rows: readonly Transaction[],
  lookup: TransactionLookup,
  { t, baseCurrency }: { t: TFunction; baseCurrency: string },
): string {
  const header = [
    t('transactions.columns.date'),
    t('transactions.form.kind'),
    t('transactions.columns.amount'),
    t('transactions.export.currency'),
    t('transactions.export.amountBase', { currency: baseCurrency }),
    t('transactions.columns.category'),
    t('transactions.form.payee'),
    t('transactions.columns.account'),
    t('transactions.form.toAccount'),
    t('transactions.form.budgetMonth'),
    t('transactions.form.tags'),
    t('transactions.form.note'),
    t('transactions.columns.member'),
  ]
  const nameOf = <T extends { name: string }>(map: ReadonlyMap<string, T>, id: string | null) =>
    id === null ? null : (map.get(id)?.name ?? null)
  const body = rows.map((row) => {
    const currency = lookup.accounts.get(row.accountId)?.currency ?? baseCurrency
    return [
      row.occurredOn,
      t(`transactions.kinds.${row.kind}`),
      major(row.amount, currency),
      currency,
      major(row.amountBase, baseCurrency),
      nameOf(lookup.categories, row.categoryId),
      row.payee,
      nameOf(lookup.accounts, row.accountId),
      nameOf(lookup.accounts, row.toAccountId),
      row.budgetMonth.slice(0, 7),
      row.tagIds.flatMap((id) => lookup.tags.get(id)?.name ?? []).join('; '),
      row.note,
      row.createdBy === null ? null : (lookup.members.get(row.createdBy) ?? null),
    ]
  })
  return toCsv(header, body)
}

/** Fayl nomi davrdan: `amallar-2026-09.csv`, `amallar-2026-01-01_2026-03-31.csv`. */
export function exportFileName(base: string, period: Period): string {
  const suffix =
    period.mode === 'month'
      ? period.month
      : period.mode === 'range'
        ? `${period.from ?? ''}_${period.to ?? ''}`
        : 'all'
  return `${base}-${suffix}.csv`
}
