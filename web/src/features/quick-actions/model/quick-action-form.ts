import { z } from 'zod'

import type { QuickAction, QuickActionInput } from '@/features/quick-actions/api/quick-actions-api'
import { formatMoneyInput, parseMoney } from '@/shared/lib/money'

export const NAME_MAX = 60

/** BR-120: tez tugma — nom, summa > 0, xarajat kategoriyasi, hisob; joy ixtiyoriy. */
export function quickActionFormSchema(currency: string) {
  return z
    .object({
      name: z.string().trim().min(1).max(NAME_MAX),
      amount: z.string(),
      categoryId: z.string().min(1),
      accountId: z.string().min(1),
      payee: z.string().trim().max(NAME_MAX),
    })
    .refine((v) => (parseMoney(v.amount, currency) ?? 0) > 0, { path: ['amount'] })
    .transform((v): QuickActionInput => ({
      name: v.name,
      amount: parseMoney(v.amount, currency) ?? 0,
      categoryId: v.categoryId,
      accountId: v.accountId,
      payee: v.payee || null,
    }))
}

export type QuickActionFormValues = z.input<ReturnType<typeof quickActionFormSchema>>

export const quickActionFormDefaults = (
  action: QuickAction | undefined,
  currency: string,
): QuickActionFormValues => ({
  name: action?.name ?? '',
  amount: action ? formatMoneyInput(action.amount, currency) : '',
  categoryId: action?.categoryId ?? '',
  accountId: action?.accountId ?? '',
  payee: action?.payee ?? '',
})
