import { queryOptions } from '@tanstack/react-query'
import { z } from 'zod'

import { toAppError } from '@/shared/api/errors'
import { qk } from '@/shared/api/query-keys'
import { supabase } from '@/shared/api/supabase'

/** Tekshiruv keshi — yozuvdan keyin emas, sahifa ochilganda yangilanadi. */
export const healthKey = (householdId: string) => [...qk.household(householdId), 'health'] as const

/** Muammo yoki ogohlantirish: kod va unga tegishli tafsilotlar (contracts/api.md). */
const issueSchema = z
  .object({
    code: z.string(),
    count: z.number().optional(),
    days: z.number().optional(),
    account_id: z.string().optional(),
    balance: z.number().optional(),
    currency: z.string().optional(),
    last_rate_date: z.string().optional(),
    debt_id: z.string().optional(),
    name: z.string().optional(),
    suggestions: z
      .array(
        z.object({
          transaction_id: z.string(),
          occurred_on: z.iso.date(),
          amount: z.number(),
          payee: z.string().nullable(),
        }),
      )
      .optional(),
  })
  .loose()

export type HealthIssue = z.infer<typeof issueSchema>

const healthSchema = z.object({
  problems: z.array(issueSchema),
  warnings: z.array(issueSchema),
  info: z
    .object({
      transactions: z.number(),
      planned_items: z.number(),
      first_month: z.iso.date().nullable(),
      opened_months: z.array(z.string()),
      closed_months: z.array(z.string()),
      income_rules: z.array(z.object({ name: z.string(), month_shift: z.number() })),
    })
    .loose(),
})

export type HealthReport = z.infer<typeof healthSchema>

/** BR-130, BR-131: byudjet tekshiruvi — muammolar, ogohlantirishlar, ma'lumot. */
export const healthCheckQuery = (householdId: string) =>
  queryOptions({
    queryKey: healthKey(householdId),
    queryFn: async (): Promise<HealthReport> => {
      const { data, error } = await supabase.rpc('health_check', { p_household: householdId })
      if (error) throw toAppError(error)
      return healthSchema.parse(data)
    },
  })

/** BR-131: o'xshash xarajatni qarzga bog'lash (tekshiruv tavsiyasi bo'yicha). */
export async function linkTransactionToDebt(transactionId: string, debtId: string): Promise<void> {
  const { error } = await supabase
    .from('transactions')
    .update({ debt_id: debtId })
    .eq('id', transactionId)
  if (error) throw toAppError(error)
}
