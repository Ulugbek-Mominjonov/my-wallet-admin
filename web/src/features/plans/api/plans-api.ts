import { queryOptions } from '@tanstack/react-query'
import { z } from 'zod'

import type { PlannedItem } from '@/entities/planned-item'
import { toAppError } from '@/shared/api/errors'
import { part } from '@/shared/api/query-keys'
import { supabase } from '@/shared/api/supabase'
import type { MonthKey } from '@/shared/lib/month'

/** Rejalar keshi (amal formasidagi bog'lanadigan rejalar ham shu prefiksda). */
export const plansKey = (householdId: string) => part(householdId, 'plans')

/** E23-T04: oy rejalari (o'chirilganlarsiz) — holat klientda bugungi sanadan (BR-071). */
export const plansQuery = (householdId: string, month: MonthKey) =>
  queryOptions({
    queryKey: [...plansKey(householdId), month],
    queryFn: async (): Promise<PlannedItem[]> => {
      const { data, error } = await supabase
        .from('planned_items')
        .select(
          'id, kind, name, category_id, account_id, planned_amount, paid_amount, due_date, budget_month, auto_pay, debt_id, system_code, settled_at, skipped_at',
        )
        .eq('household_id', householdId)
        .eq('budget_month', `${month}-01`)
        .is('deleted_at', null)
        .order('due_date')
      if (error) throw toAppError(error)
      return data.map((p) => ({
        id: p.id,
        kind: p.kind,
        name: p.name,
        categoryId: p.category_id,
        accountId: p.account_id,
        plannedAmount: p.planned_amount,
        paidAmount: p.paid_amount,
        dueDate: p.due_date,
        budgetMonth: p.budget_month,
        autoPay: p.auto_pay,
        debtId: p.debt_id,
        systemCode: p.system_code,
        settled: p.settled_at !== null,
        skipped: p.skipped_at !== null,
      }))
    },
  })

export interface PayInput {
  /** Hisob valyutasida; `null` — server qolgan summani oladi (asosiy valyutadagi hisobda). */
  amount: number | null
  accountId: string
  date: string
  /** BR-073: qisman to'lovda rejani yopish. */
  settle: boolean
}

/** BR-073: "To'landi" / "Keldi" — reja bilan bog'langan amal yoziladi. */
export async function payPlanned(itemId: string, input: PayInput): Promise<void> {
  const { error } = await supabase.rpc('pay_planned', {
    p_item: itemId,
    p_amount: input.amount ?? undefined,
    p_account: input.accountId,
    p_date: input.date,
    p_settle: input.settle,
  })
  if (error) throw toAppError(error)
}

/** BR-071: o'tkazib yuborish yoki qaytarish. */
export async function skipPlanned(itemId: string, skipped: boolean): Promise<void> {
  const { error } = await supabase.rpc('skip_planned', { p_item: itemId, p_skipped: skipped })
  if (error) throw toAppError(error)
}

const bulkPayResultSchema = z.object({
  paid: z.array(z.string()),
  skipped: z.array(z.object({ id: z.string(), reason: z.string() })),
})

export type BulkPayResult = z.infer<typeof bulkPayResultSchema>

/** BR-074: ommaviy "To'landi" — bitta tranzaksiyada, to'lanmaganlari sababi bilan. */
export async function bulkPayPlanned(
  ids: readonly string[],
  { date, accountId }: { date: string; accountId: string | null },
): Promise<BulkPayResult> {
  const { data, error } = await supabase.rpc('bulk_pay_planned', {
    p_items: [...ids],
    p_date: date,
    p_account: accountId ?? undefined,
  })
  if (error) throw toAppError(error)
  return bulkPayResultSchema.parse(data)
}
