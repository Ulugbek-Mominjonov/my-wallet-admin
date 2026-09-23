import { queryOptions } from '@tanstack/react-query'

import { toAppError } from '@/shared/api/errors'
import { part } from '@/shared/api/query-keys'
import { supabase } from '@/shared/api/supabase'

export interface Goal {
  id: string
  name: string
  currency: string
  target: number
  savedManual: number
  monthlyContribution: number | null
  /** Oy boshi (`YYYY-MM-01`) yoki muddatsiz. */
  deadline: string | null
  /** BR-122: bog'langan hisob — yig'ilgan = uning qoldig'i. */
  accountId: string | null
  sortOrder: number
  /** `goal_progress` (BR-121). */
  saved: number
  remaining: number
  progress: number
  monthsLeft: number | null
  endMonth: string | null
  onTrack: boolean | null
}

export const goalsKey = (householdId: string) => part(householdId, 'goals')

/** E22-T06: maqsadlar va prognoz — ikki parallel so'rov. */
export const goalsQuery = (householdId: string) =>
  queryOptions({
    queryKey: goalsKey(householdId),
    queryFn: async (): Promise<Goal[]> => {
      const [rows, progress] = await Promise.all([
        supabase
          .from('goals')
          .select(
            'id, name, currency, target, saved_manual, monthly_contribution, deadline, account_id, sort_order',
          )
          .eq('household_id', householdId)
          .is('deleted_at', null)
          .order('sort_order')
          .order('name'),
        supabase
          .from('goal_progress')
          .select('goal_id, saved, remaining, progress, months_left, end_month, on_track')
          .eq('household_id', householdId),
      ])
      if (rows.error) throw toAppError(rows.error)
      if (progress.error) throw toAppError(progress.error)
      const progressOf = new Map(progress.data.map((p) => [p.goal_id, p]))
      return rows.data.map((row) => {
        const p = progressOf.get(row.id)
        return {
          id: row.id,
          name: row.name,
          currency: row.currency,
          target: row.target,
          savedManual: row.saved_manual,
          monthlyContribution: row.monthly_contribution,
          deadline: row.deadline,
          accountId: row.account_id,
          sortOrder: row.sort_order,
          saved: p?.saved ?? row.saved_manual,
          remaining: p?.remaining ?? Math.max(0, row.target - row.saved_manual),
          progress: p?.progress ?? Math.min(1, row.saved_manual / row.target),
          monthsLeft: p?.months_left ?? null,
          endMonth: p?.end_month ?? null,
          onTrack: p?.on_track ?? null,
        }
      })
    },
  })

export interface GoalInput {
  name: string
  currency: string
  target: number
  savedManual: number
  monthlyContribution: number | null
  deadline: string | null
  accountId: string | null
}

/** Valyuta yaratilgandan keyin o'zgarmaydi (contracts/api.md). */
const toUpdate = (input: GoalInput) => ({
  name: input.name,
  target: input.target,
  saved_manual: input.savedManual,
  monthly_contribution: input.monthlyContribution,
  deadline: input.deadline,
  account_id: input.accountId,
})

export async function createGoal(
  householdId: string,
  input: GoalInput,
  sortOrder: number,
): Promise<void> {
  const { error } = await supabase.from('goals').insert({
    household_id: householdId,
    currency: input.currency,
    sort_order: sortOrder,
    ...toUpdate(input),
  })
  if (error) throw toAppError(error)
}

export async function updateGoal(id: string, input: GoalInput): Promise<void> {
  const { error } = await supabase.from('goals').update(toUpdate(input)).eq('id', id)
  if (error) throw toAppError(error)
}

export async function deleteGoal(id: string): Promise<void> {
  const { error } = await supabase
    .from('goals')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw toAppError(error)
}

export async function reorderGoals(householdId: string, ids: string[]): Promise<void> {
  const { error } = await supabase.rpc('set_sort_order', {
    p_household: householdId,
    p_table: 'goals',
    p_ids: ids,
  })
  if (error) throw toAppError(error)
}
