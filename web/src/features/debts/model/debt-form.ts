import { z } from 'zod'

import { DEBT_DIRECTIONS, type Debt, type DebtInput } from '@/features/debts/api/debts-api'
import { formatMoneyInput, parseMoney } from '@/shared/lib/money'

export const NAME_MAX = 60
export const NOTE_MAX = 1000

const money = (text: string, currency: string) => (text.trim() ? parseMoney(text, currency) : null)

/**
 * BR-110: nom, yo'nalish, valyuta, umumiy (> 0), oldin to'langan (0..umumiy),
 * oylik (ixtiyoriy, > 0), muddat, izoh. Summalar qarz valyutasida.
 */
export const debtFormSchema = z
  .object({
    name: z.string().trim().min(1).max(NAME_MAX),
    direction: z.enum(DEBT_DIRECTIONS),
    currency: z.string().regex(/^[A-Z]{3}$/),
    total: z.string(),
    paidBefore: z.string(),
    monthlyPayment: z.string(),
    dueDate: z.union([z.literal(''), z.iso.date()]),
    note: z.string().trim().max(NOTE_MAX),
  })
  .superRefine((v, ctx) => {
    const issue = (path: string) => {
      ctx.addIssue({ code: 'custom', path: [path], message: path })
    }
    const total = money(v.total, v.currency)
    if (total === null || total <= 0) issue('total')
    const paid = v.paidBefore.trim() ? money(v.paidBefore, v.currency) : 0
    if (paid === null || paid < 0 || (total !== null && paid > total)) issue('paidBefore')
    if (v.monthlyPayment.trim()) {
      const monthly = money(v.monthlyPayment, v.currency)
      if (monthly === null || monthly <= 0) issue('monthlyPayment')
    }
  })
  .transform((v): DebtInput => ({
    name: v.name,
    direction: v.direction,
    currency: v.currency,
    total: money(v.total, v.currency) ?? 0,
    paidBefore: money(v.paidBefore, v.currency) ?? 0,
    monthlyPayment: money(v.monthlyPayment, v.currency),
    dueDate: v.dueDate || null,
    note: v.note || null,
  }))

export type DebtFormValues = z.input<typeof debtFormSchema>

export const debtFormDefaults = (debt: Debt | undefined, currency: string): DebtFormValues => ({
  name: debt?.name ?? '',
  direction: debt?.direction ?? 'i_owe',
  currency: debt?.currency ?? currency,
  total: debt ? formatMoneyInput(debt.total, debt.currency) : '',
  paidBefore: debt && debt.paidBefore > 0 ? formatMoneyInput(debt.paidBefore, debt.currency) : '',
  monthlyPayment:
    debt?.monthlyPayment == null ? '' : formatMoneyInput(debt.monthlyPayment, debt.currency),
  dueDate: debt?.dueDate ?? '',
  note: debt?.note ?? '',
})
