import { z } from 'zod'

import type { Account } from '@/entities/account'
import { plannedRemaining, type PlannedItem } from '@/entities/planned-item'
import type { PayInput } from '@/features/plans/api/plans-api'
import { formatMoneyInput, parseMoney } from '@/shared/lib/money'

type AccountCurrency = Pick<Account, 'currency'>

/**
 * BR-073: "To'landi" formasi — summa hisob valyutasida (> 0), hisob, sana;
 * qisman to'lovda "Yopish" tanlansa reja to'langan deb belgilanadi.
 */
export function payFormSchema(accountOf: (id: string) => AccountCurrency | undefined) {
  return z
    .object({
      amount: z.string(),
      accountId: z.string(),
      date: z.iso.date(),
      settle: z.boolean(),
    })
    .superRefine((v, ctx) => {
      const account = accountOf(v.accountId)
      if (!account) {
        ctx.addIssue({ code: 'custom', path: ['accountId'], message: 'accountId' })
        return
      }
      const amount = parseMoney(v.amount, account.currency)
      if (amount === null || amount <= 0) {
        ctx.addIssue({ code: 'custom', path: ['amount'], message: 'amount' })
      }
    })
    .transform((v): PayInput => ({
      amount: parseMoney(v.amount, accountOf(v.accountId)?.currency ?? '') ?? 0,
      accountId: v.accountId,
      date: v.date,
      settle: v.settle,
    }))
}

export type PayFormValues = z.input<ReturnType<typeof payFormSchema>>

/**
 * Standart: rejaning hisobi (faol bo'lsa), summa — qolgani (hisob asosiy
 * valyutada bo'lsa; reja summasi asosiy valyutada), sana — bugun.
 */
export function payFormDefaults(
  plan: PlannedItem,
  {
    today,
    baseCurrency,
    accountOf,
  }: {
    today: string
    baseCurrency: string
    accountOf: (id: string) => AccountCurrency | undefined
  },
): PayFormValues {
  const account = plan.accountId === null ? undefined : accountOf(plan.accountId)
  const remaining = plannedRemaining(plan)
  return {
    amount:
      account?.currency === baseCurrency && remaining !== null && remaining > 0
        ? formatMoneyInput(remaining, baseCurrency)
        : '',
    accountId: account && plan.accountId !== null ? plan.accountId : '',
    date: today,
    settle: false,
  }
}
