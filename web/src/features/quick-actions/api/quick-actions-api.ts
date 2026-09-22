import { queryOptions } from '@tanstack/react-query'

import { toAppError } from '@/shared/api/errors'
import { qk } from '@/shared/api/query-keys'
import { supabase } from '@/shared/api/supabase'

export interface QuickAction {
  id: string
  name: string
  /** Eng kichik birlikda, > 0. */
  amount: number
  categoryId: string
  accountId: string
  payee: string | null
  sortOrder: number
}

export const quickActionsKey = (householdId: string) =>
  [...qk.household(householdId), 'quick-actions'] as const

/** E22-T05: tez tugmalar — mobil "Qo'shish" oynasidagi bir bosishli xarajatlar (BR-120). */
export const quickActionsQuery = (householdId: string) =>
  queryOptions({
    queryKey: quickActionsKey(householdId),
    queryFn: async (): Promise<QuickAction[]> => {
      const { data, error } = await supabase
        .from('quick_actions')
        .select('id, name, amount, category_id, account_id, payee, sort_order')
        .eq('household_id', householdId)
        .is('deleted_at', null)
        .order('sort_order')
        .order('name')
      if (error) throw toAppError(error)
      return data.map((row) => ({
        id: row.id,
        name: row.name,
        amount: row.amount,
        categoryId: row.category_id,
        accountId: row.account_id,
        payee: row.payee,
        sortOrder: row.sort_order,
      }))
    },
  })

export interface QuickActionInput {
  name: string
  amount: number
  categoryId: string
  accountId: string
  payee: string | null
}

const toRow = (input: QuickActionInput) => ({
  name: input.name,
  amount: input.amount,
  category_id: input.categoryId,
  account_id: input.accountId,
  payee: input.payee,
})

export async function createQuickAction(
  householdId: string,
  input: QuickActionInput,
  sortOrder: number,
): Promise<void> {
  const { error } = await supabase
    .from('quick_actions')
    .insert({ household_id: householdId, sort_order: sortOrder, ...toRow(input) })
  if (error) throw toAppError(error)
}

export async function updateQuickAction(id: string, input: QuickActionInput): Promise<void> {
  const { error } = await supabase.from('quick_actions').update(toRow(input)).eq('id', id)
  if (error) throw toAppError(error)
}

export async function deleteQuickAction(id: string): Promise<void> {
  const { error } = await supabase
    .from('quick_actions')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw toAppError(error)
}

export async function reorderQuickActions(householdId: string, ids: string[]): Promise<void> {
  const { error } = await supabase.rpc('set_sort_order', {
    p_household: householdId,
    p_table: 'quick_actions',
    p_ids: ids,
  })
  if (error) throw toAppError(error)
}
