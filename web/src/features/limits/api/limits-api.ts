import { queryOptions } from '@tanstack/react-query'
import { z } from 'zod'

import { toAppError } from '@/shared/api/errors'
import { part } from '@/shared/api/query-keys'
import { supabase } from '@/shared/api/supabase'

/** BR-130: `ok` < 80%, `near` 80–100%, `over` > 100% (contracts/api.md). */
export type LimitStatus = 'ok' | 'near' | 'over'

export interface CategoryLimit {
  id: string
  categoryId: string
  /** Oylik limit, asosiy valyutada, eng kichik birlikda. */
  amount: number
  alert80: boolean
  alert100: boolean
  /** BR-134: o'tgan oy qoldig'ini shu oyga qo'shish. */
  rollover: boolean
  /** BR-134: o'tgan oyda oshib ketgani shu oy limitidan ayirilsinmi. */
  rolloverNegative: boolean
  /** O'tgan oydan o'tgan qoldiq: amaldagi limit = `amount + carry` (0 dan kichik emas). */
  carry: number
  /** Joriy oy holati (`report_month.by_category`) — fakt subkategoriyalar bilan (BR-132). */
  actual: number
  ratio: number
  status: LimitStatus
}

export const limitsKey = (householdId: string) => part(householdId, 'limits')

const reportSchema = z.object({
  by_category: z.array(
    z.object({
      category_id: z.string(),
      actual_total: z.number(),
      limit: z.number().nullable(),
      limit_carry: z.number().nullable(),
      limit_ratio: z.number().nullable(),
      limit_status: z.enum(['ok', 'near', 'over']).nullable(),
    }),
  ),
})

/**
 * E22-T05: limitlar va joriy oy holati — ikki parallel so'rov (limitlar
 * jadvali + `report_month`; hisobot bitta tasnif yadrosidan, < 50 ms).
 */
export const limitsQuery = (householdId: string, month: string) =>
  queryOptions({
    queryKey: [...limitsKey(householdId), month],
    queryFn: async (): Promise<CategoryLimit[]> => {
      const [limits, report] = await Promise.all([
        supabase
          .from('category_limits')
          .select('id, category_id, amount, alert_80, alert_100, rollover, rollover_negative')
          .eq('household_id', householdId)
          .is('deleted_at', null),
        supabase.rpc('report_month', { p_household: householdId, p_month: month }),
      ])
      if (limits.error) throw toAppError(limits.error)
      if (report.error) throw toAppError(report.error)
      const byCategory = new Map(
        reportSchema.parse(report.data).by_category.map((c) => [c.category_id, c]),
      )
      return limits.data.map((row) => {
        const line = byCategory.get(row.category_id)
        const actual = line?.actual_total ?? 0
        const carry = line?.limit_carry ?? 0
        const ratio = line?.limit_ratio ?? actual / Math.max(row.amount + carry, 1)
        return {
          id: row.id,
          categoryId: row.category_id,
          amount: row.amount,
          alert80: row.alert_80,
          alert100: row.alert_100,
          rollover: row.rollover,
          rolloverNegative: row.rollover_negative,
          carry,
          actual,
          ratio,
          status: line?.limit_status ?? (ratio > 1 ? 'over' : ratio >= 0.8 ? 'near' : 'ok'),
        }
      })
    },
  })

export interface LimitInput {
  categoryId: string
  amount: number
  alert80: boolean
  alert100: boolean
  rollover: boolean
  rolloverNegative: boolean
}

export async function createLimit(householdId: string, input: LimitInput): Promise<void> {
  const { error } = await supabase.from('category_limits').insert({
    household_id: householdId,
    category_id: input.categoryId,
    amount: input.amount,
    alert_80: input.alert80,
    alert_100: input.alert100,
    rollover: input.rollover,
    rollover_negative: input.rolloverNegative,
  })
  if (error) throw toAppError(error)
}

/** Kategoriya o'zgarmaydi (ustun grant'i) — faqat summa va ogohlantirishlar. */
export async function updateLimit(id: string, input: LimitInput): Promise<void> {
  const { error } = await supabase
    .from('category_limits')
    .update({
      amount: input.amount,
      alert_80: input.alert80,
      alert_100: input.alert100,
      rollover: input.rollover,
      rollover_negative: input.rolloverNegative,
    })
    .eq('id', id)
  if (error) throw toAppError(error)
}

export async function deleteLimit(id: string): Promise<void> {
  const { error } = await supabase
    .from('category_limits')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw toAppError(error)
}
