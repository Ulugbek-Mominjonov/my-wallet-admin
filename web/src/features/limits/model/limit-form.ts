import { z } from 'zod'

import type { CategoryLimit, LimitInput } from '@/features/limits/api/limits-api'
import { formatMoneyInput, parseMoney } from '@/shared/lib/money'

/** BR-130: limit — xarajat kategoriyasiga bittadan, summa > 0 (asosiy valyutada). */
export function limitFormSchema(currency: string) {
  return z
    .object({
      categoryId: z.string().min(1),
      amount: z.string(),
      alert80: z.boolean(),
      alert100: z.boolean(),
      rollover: z.boolean(),
      rolloverNegative: z.boolean(),
    })
    .refine((v) => (parseMoney(v.amount, currency) ?? 0) > 0, { path: ['amount'] })
    .transform((v): LimitInput => ({
      categoryId: v.categoryId,
      amount: parseMoney(v.amount, currency) ?? 0,
      alert80: v.alert80,
      alert100: v.alert100,
      rollover: v.rollover,
      // BR-134: manfiy qoldiq faqat rollover yoqilganda ma'noga ega.
      rolloverNegative: v.rollover && v.rolloverNegative,
    }))
}

export type LimitFormValues = z.input<ReturnType<typeof limitFormSchema>>

export const limitFormDefaults = (
  limit: CategoryLimit | undefined,
  currency: string,
): LimitFormValues => ({
  categoryId: limit?.categoryId ?? '',
  amount: limit ? formatMoneyInput(limit.amount, currency) : '',
  alert80: limit?.alert80 ?? true,
  alert100: limit?.alert100 ?? true,
  rollover: limit?.rollover ?? false,
  rolloverNegative: limit?.rolloverNegative ?? false,
})
