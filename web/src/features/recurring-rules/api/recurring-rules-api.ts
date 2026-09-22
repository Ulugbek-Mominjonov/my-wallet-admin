import { queryOptions } from '@tanstack/react-query'
import { z } from 'zod'

import type { PlanKind, RecurringRule } from '@/entities/recurring-rule'
import { toAppError } from '@/shared/api/errors'
import { qk } from '@/shared/api/query-keys'
import { supabase } from '@/shared/api/supabase'

const RULE_COLUMNS =
  'id, kind, name, category_id, account_id, amount, day_of_month, auto_pay, active, debt_id, start_month, end_month, sort_order'

export const recurringRulesKey = (householdId: string) =>
  [...qk.household(householdId), 'recurring-rules'] as const

/** E22-T04: doimiy rejalar (arxiv o'rniga `active`). */
export const recurringRulesQuery = (householdId: string) =>
  queryOptions({
    queryKey: recurringRulesKey(householdId),
    queryFn: async (): Promise<RecurringRule[]> => {
      const { data, error } = await supabase
        .from('recurring_rules')
        .select(RULE_COLUMNS)
        .eq('household_id', householdId)
        .is('deleted_at', null)
        .order('sort_order')
        .order('name')
      if (error) throw toAppError(error)
      return data.map((row) => ({
        id: row.id,
        kind: row.kind,
        name: row.name,
        categoryId: row.category_id,
        accountId: row.account_id,
        amount: row.amount,
        dayOfMonth: row.day_of_month,
        autoPay: row.auto_pay,
        active: row.active,
        debtId: row.debt_id,
        startMonth: row.start_month,
        endMonth: row.end_month,
        sortOrder: row.sort_order,
      }))
    },
  })

export interface RecurringRuleInput {
  kind: PlanKind
  name: string
  categoryId: string | null
  accountId: string | null
  amount: number | null
  dayOfMonth: number
  autoPay: boolean
  active: boolean
  startMonth: string | null
  endMonth: string | null
}

const toRow = (input: RecurringRuleInput) => ({
  kind: input.kind,
  name: input.name,
  category_id: input.categoryId,
  account_id: input.accountId,
  amount: input.amount,
  day_of_month: input.dayOfMonth,
  auto_pay: input.autoPay,
  active: input.active,
  start_month: input.startMonth,
  end_month: input.endMonth,
})

export async function createRecurringRule(
  householdId: string,
  input: RecurringRuleInput,
  sortOrder: number,
): Promise<void> {
  const { error } = await supabase
    .from('recurring_rules')
    .insert({ household_id: householdId, sort_order: sortOrder, ...toRow(input) })
  if (error) throw toAppError(error)
}

export async function updateRecurringRule(id: string, input: RecurringRuleInput): Promise<void> {
  const { error } = await supabase.from('recurring_rules').update(toRow(input)).eq('id', id)
  if (error) throw toAppError(error)
}

export async function setRecurringRuleActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase.from('recurring_rules').update({ active }).eq('id', id)
  if (error) throw toAppError(error)
}

export async function deleteRecurringRule(id: string): Promise<void> {
  const { error } = await supabase
    .from('recurring_rules')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw toAppError(error)
}

export async function reorderRecurringRules(householdId: string, ids: string[]): Promise<void> {
  const { error } = await supabase.rpc('set_sort_order', {
    p_household: householdId,
    p_table: 'recurring_rules',
    p_ids: ids,
  })
  if (error) throw toAppError(error)
}

const previewSchema = z.object({
  month: z.string(),
  closed: z.boolean(),
  new: z.number(),
  existing: z.number(),
  items: z.array(
    z.object({
      kind: z.string(),
      name: z.string(),
      planned_amount: z.number().nullable(),
      due_date: z.string(),
      recurring_rule_id: z.string().nullable(),
      system_code: z.string().nullable(),
      exists: z.boolean(),
    }),
  ),
})
export type MonthPreview = z.infer<typeof previewSchema>

/** "Keyingi oyda nima yaratiladi" — oy ochilishi preview'i (yozmaydi). */
export const monthPreviewQuery = (householdId: string, month: string) =>
  queryOptions({
    queryKey: [...qk.household(householdId), 'open-month-preview', month],
    queryFn: async (): Promise<MonthPreview> => {
      const { data, error } = await supabase.rpc('open_month_preview', {
        p_household: householdId,
        p_month: month,
      })
      if (error) throw toAppError(error)
      return previewSchema.parse(data)
    },
    staleTime: 0,
  })
