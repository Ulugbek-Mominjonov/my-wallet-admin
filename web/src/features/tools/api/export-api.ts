import { z } from 'zod'

import { toAppError } from '@/shared/api/errors'
import { supabase } from '@/shared/api/supabase'
import type { MonthKey } from '@/shared/lib/month'

/** BR-180: to'liq JSON zaxira (owner/admin). */
export async function exportHousehold(householdId: string): Promise<unknown> {
  const { data, error } = await supabase.rpc('export_household', { p_household: householdId })
  if (error) throw toAppError(error)
  return data
}

const planSchema = z.object({
  kind: z.enum(['expense', 'income', 'allocation']),
  name: z.string(),
  budget_month: z.iso.date(),
  due_date: z.iso.date(),
  planned_amount: z.number().nullable(),
  paid_amount: z.number(),
  settled_at: z.string().nullable(),
  skipped_at: z.string().nullable(),
  category_id: z.string().nullable(),
})

export type ExportedPlan = z.infer<typeof planSchema>

/** Davr bo'yicha rejalar (CSV eksport uchun; amallar — amallar sahifasida). */
export async function fetchPlansForExport(
  householdId: string,
  from: MonthKey,
  to: MonthKey,
): Promise<ExportedPlan[]> {
  const { data, error } = await supabase
    .from('planned_items')
    .select(
      'kind, name, budget_month, due_date, planned_amount, paid_amount, settled_at, skipped_at, category_id',
    )
    .eq('household_id', householdId)
    .gte('budget_month', `${from}-01`)
    .lte('budget_month', `${to}-01`)
    .is('deleted_at', null)
    .order('budget_month')
    .order('due_date')
  if (error) throw toAppError(error)
  return z.array(planSchema).parse(data)
}
