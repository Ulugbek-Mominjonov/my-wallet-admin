import { z } from 'zod'

import { ACCOUNT_TYPES, type Account } from '@/entities/account'
import type { AccountInput } from '@/features/accounts/api/accounts-api'
import { formatMoneyInput, parseMoney } from '@/shared/lib/money'

/** `entity_name` domeni bilan bir xil (BR-003). */
export const NAME_MAX = 60

/** Forma maydonlari (matn) → server qiymatlari; summa valyutaga qarab o'qiladi. */
export const accountFormSchema = z
  .object({
    name: z.string().trim().min(1).max(NAME_MAX),
    type: z.enum(ACCOUNT_TYPES),
    currency: z.string().regex(/^[A-Z]{3}$/),
    openingBalance: z.string(),
    openingDate: z.iso.date(),
    icon: z.string().nullable(),
    color: z.string().nullable(),
  })
  .refine((values) => parseMoney(values.openingBalance || '0', values.currency) !== null, {
    path: ['openingBalance'],
  })
  .transform((values): AccountInput => ({
    ...values,
    openingBalance: parseMoney(values.openingBalance || '0', values.currency) ?? 0,
  }))

export type AccountFormValues = z.input<typeof accountFormSchema>

export function accountFormDefaults(
  account: Account | undefined,
  defaults: { currency: string; today: string },
): AccountFormValues {
  if (!account) {
    return {
      name: '',
      type: 'card',
      currency: defaults.currency,
      openingBalance: '',
      openingDate: defaults.today,
      icon: null,
      color: null,
    }
  }
  return {
    name: account.name,
    type: account.type,
    currency: account.currency,
    openingBalance: formatMoneyInput(account.openingBalance, account.currency),
    openingDate: account.openingDate,
    icon: account.icon,
    color: account.color,
  }
}
