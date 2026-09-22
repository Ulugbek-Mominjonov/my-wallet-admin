import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query'
import { z } from 'zod'

import type { PlanKind } from '@/entities/recurring-rule'
import { TRANSACTION_KINDS, type Transaction, type TransactionKind } from '@/entities/transaction'
import type { TransactionFilters } from '@/features/transactions/model/filters'
import type { TransactionInput } from '@/features/transactions/model/transaction-form'
import { toAppError } from '@/shared/api/errors'
import { qk } from '@/shared/api/query-keys'
import { supabase } from '@/shared/api/supabase'
import { shiftMonth, type MonthKey } from '@/shared/lib/month'

/** Chek rasmlari bucket'i (contracts/api.md — Storage). */
const RECEIPTS_BUCKET = 'receipts'

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
  budget_month_source: z.enum(['auto', 'manual']),
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
  budgetMonthSource: row.budget_month_source,
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

/** E23-T02: yaratish (`id` yo'q) yoki tahrirlash — amal va teglari bitta tranzaksiyada. */
export async function saveTransaction(
  householdId: string,
  id: string | null,
  input: TransactionInput,
): Promise<void> {
  const { error } = await supabase.rpc('save_transaction', {
    p_household: householdId,
    p_id: id ?? undefined,
    p_kind: input.kind,
    p_account_id: input.accountId,
    p_amount: input.amount,
    p_occurred_on: input.occurredOn,
    p_to_account_id: input.toAccountId ?? undefined,
    p_to_amount: input.toAmount ?? undefined,
    p_category_id: input.categoryId ?? undefined,
    p_payee: input.payee ?? undefined,
    p_budget_month: input.budgetMonth ?? undefined,
    p_planned_item_id: input.plannedItemId ?? undefined,
    p_debt_id: input.debtId ?? undefined,
    p_note: input.note ?? undefined,
    p_tag_ids: input.tagIds,
  })
  if (error) throw toAppError(error)
}

/** O'chirish — tombstone (sinxron); oy qulfi triggerda (BR-055). */
export async function deleteTransaction(id: string): Promise<void> {
  const { error } = await supabase
    .from('transactions')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw toAppError(error)
}

/** Avto-to'ldirish shu uzunlikdan boshlanadi — bitta harfga so'rov yubormaymiz. */
export const PAYEE_QUERY_MIN = 2

export interface PayeeSuggestion {
  payee: string
  categoryId: string | null
  accountId: string
}

const suggestionSchema = z.object({
  payee: z.string(),
  category_id: z.string().nullable(),
  account_id: z.string(),
})

/** BR-056: joy nomi tarixdan — oxirgi kategoriya va hisobi bilan. */
export const payeeSuggestionsQuery = (householdId: string, query: string, kind: TransactionKind) =>
  queryOptions({
    queryKey: [...transactionsKey(householdId), 'payees', kind, query],
    queryFn: async (): Promise<PayeeSuggestion[]> => {
      const { data, error } = await supabase.rpc('payee_suggestions', {
        p_household: householdId,
        p_query: query,
        p_kind: kind,
      })
      if (error) throw toAppError(error)
      return z
        .array(suggestionSchema)
        .parse(data)
        .map((s) => ({ payee: s.payee, categoryId: s.category_id, accountId: s.account_id }))
    },
    enabled: query.trim().length >= PAYEE_QUERY_MIN,
  })

export interface LinkablePlan {
  id: string
  kind: PlanKind
  name: string
  /** Reja oyi (`YYYY-MM`) — bog'langan amal shu oyga tegishli (BR-044). */
  budgetMonth: MonthKey
  categoryId: string | null
  /** Asosiy valyutada; `null` — summasi noma'lum (BR-070). */
  plannedAmount: number | null
  paidAmount: number
  debtId: string | null
  settled: boolean
}

/**
 * Amalni bog'lash uchun rejalar: shu va oldingi oy (o'tgan oy rejasi keyingi
 * oyda to'lanishi mumkin — BR-044), o'tkazib yuborilmaganlari (BR-072).
 */
export const linkablePlansQuery = (householdId: string, month: MonthKey) =>
  queryOptions({
    queryKey: [...qk.household(householdId), 'plans', month, 'linkable'],
    queryFn: async (): Promise<LinkablePlan[]> => {
      const { data, error } = await supabase
        .from('planned_items')
        .select(
          'id, kind, name, budget_month, category_id, planned_amount, paid_amount, debt_id, settled_at',
        )
        .eq('household_id', householdId)
        .in('budget_month', [`${shiftMonth(month, -1)}-01`, `${month}-01`])
        .is('deleted_at', null)
        .is('skipped_at', null)
        .order('due_date')
      if (error) throw toAppError(error)
      return data.map((p) => ({
        id: p.id,
        kind: p.kind,
        name: p.name,
        budgetMonth: shiftMonth(p.budget_month.slice(0, 7), 0),
        categoryId: p.category_id,
        plannedAmount: p.planned_amount,
        paidAmount: p.paid_amount,
        debtId: p.debt_id,
        settled: p.settled_at !== null,
      }))
    },
  })

/** BR-055: oy yopilganmi (ogohlantirish; qattiq qulfda server rad etadi). */
export const monthClosedQuery = (householdId: string, month: MonthKey) =>
  queryOptions({
    queryKey: [...qk.household(householdId), 'months', month],
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase
        .from('months')
        .select('closed_at')
        .eq('household_id', householdId)
        .eq('month', `${month}-01`)
        .maybeSingle()
      if (error) throw toAppError(error)
      return data?.closed_at != null
    },
  })

/** Imzolangan havola muddati; kesh undan oldin eskiradi — rasm ochilmay qolmaydi. */
const RECEIPT_URL_TTL_S = 300
const RECEIPT_STALE_MS = 240_000

export interface Receipt {
  id: string
  url: string
}

/** BR-201: amal cheklari — shaxsiy bucket'dan qisqa muddatli havola bilan. */
export const receiptsQuery = (householdId: string, transactionId: string) =>
  queryOptions({
    queryKey: [...transactionsKey(householdId), 'receipts', transactionId],
    staleTime: RECEIPT_STALE_MS,
    queryFn: async (): Promise<Receipt[]> => {
      const { data, error } = await supabase
        .from('attachments')
        .select('id, storage_path')
        .eq('transaction_id', transactionId)
        .is('deleted_at', null)
        .order('created_at')
      if (error) throw toAppError(error)
      if (data.length === 0) return []
      const signed = await supabase.storage.from(RECEIPTS_BUCKET).createSignedUrls(
        data.map((a) => a.storage_path),
        RECEIPT_URL_TTL_S,
      )
      if (signed.error) throw toAppError(signed.error)
      const urlOf = new Map(signed.data.map((s) => [s.path, s.signedUrl]))
      return data.flatMap((a) => {
        const url = urlOf.get(a.storage_path)
        return url ? [{ id: a.id, url }] : []
      })
    },
  })
