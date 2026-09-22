import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query'
import { z } from 'zod'

import { TRANSACTION_KINDS, type Transaction } from '@/entities/transaction'
import type { TransactionFilters } from '@/features/transactions/model/filters'
import { toAppError } from '@/shared/api/errors'
import { qk } from '@/shared/api/query-keys'
import { supabase } from '@/shared/api/supabase'

/** Bir sahifadagi amallar (RPC chegarasi — 200). */
export const TRANSACTIONS_PAGE_SIZE = 50

export const transactionsKey = (householdId: string) =>
  [...qk.household(householdId), 'transactions'] as const

const rowSchema = z.object({
  id: z.string(),
  kind: z.enum(TRANSACTION_KINDS),
  account_id: z.string(),
  to_account_id: z.string().nullable(),
  amount: z.number(),
  to_amount: z.number().nullable(),
  amount_base: z.number(),
  category_id: z.string().nullable(),
  payee: z.string().nullable(),
  occurred_on: z.string(),
  budget_month: z.string(),
  planned_item_id: z.string().nullable(),
  debt_id: z.string().nullable(),
  note: z.string().nullable(),
  created_by: z.string().nullable(),
  tag_ids: z.array(z.string()),
  has_receipt: z.boolean(),
})

const toTransaction = (row: z.infer<typeof rowSchema>): Transaction => ({
  id: row.id,
  kind: row.kind,
  accountId: row.account_id,
  toAccountId: row.to_account_id,
  amount: row.amount,
  toAmount: row.to_amount,
  amountBase: row.amount_base,
  categoryId: row.category_id,
  payee: row.payee,
  occurredOn: row.occurred_on,
  budgetMonth: row.budget_month,
  plannedItemId: row.planned_item_id,
  debtId: row.debt_id,
  note: row.note,
  createdBy: row.created_by,
  tagIds: row.tag_ids,
  hasReceipt: row.has_receipt,
})

/** Keyset kursori — oxirgi qatorning (sana, id) si. */
interface Cursor {
  date: string
  id: string
}

/**
 * E23-T01: amallar — keyset sahifalar (`occurred_on, id` kamayish). Kalitda
 * RPC filtri: har filtr o'z keshiga ega, orqaga qaytish tez.
 */
export const transactionsQuery = (householdId: string, filters: TransactionFilters) =>
  infiniteQueryOptions({
    queryKey: [...transactionsKey(householdId), 'list', filters],
    initialPageParam: null as Cursor | null,
    queryFn: async ({ pageParam }): Promise<Transaction[]> => {
      const { data, error } = await supabase.rpc('transactions_list', {
        p_household: householdId,
        p_filters: filters,
        p_after_date: pageParam?.date,
        p_after_id: pageParam?.id,
        p_limit: TRANSACTIONS_PAGE_SIZE,
      })
      if (error) throw toAppError(error)
      return z.array(rowSchema).parse(data).map(toTransaction)
    },
    getNextPageParam: (page): Cursor | null => {
      const last = page.at(-1)
      if (page.length < TRANSACTIONS_PAGE_SIZE || last === undefined) return null
      return { date: last.occurredOn, id: last.id }
    },
  })

const summarySchema = z.object({
  count: z.number(),
  income: z.number(),
  expense: z.number(),
  transfer: z.number(),
})

export type TransactionsSummary = z.infer<typeof summarySchema>

/** Filtr bo'yicha jami (asosiy valyutada) — ro'yxatdan alohida, yengil so'rov. */
export const transactionsSummaryQuery = (householdId: string, filters: TransactionFilters) =>
  queryOptions({
    queryKey: [...transactionsKey(householdId), 'summary', filters],
    queryFn: async (): Promise<TransactionsSummary> => {
      const { data, error } = await supabase.rpc('transactions_summary', {
        p_household: householdId,
        p_filters: filters,
      })
      if (error) throw toAppError(error)
      return summarySchema.parse(data)
    },
  })
