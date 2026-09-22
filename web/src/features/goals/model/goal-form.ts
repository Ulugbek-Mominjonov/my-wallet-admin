import { z } from 'zod'

import type { Goal, GoalInput } from '@/features/goals/api/goals-api'
import { formatMoneyInput, parseMoney } from '@/shared/lib/money'

export const NAME_MAX = 60

const money = (text: string, currency: string) => (text.trim() ? parseMoney(text, currency) : null)

/**
 * BR-120..122: kerakli summa (> 0), yig'ilgan — hisob bog'lanmagan bo'lsa
 * qo'lda (≥ 0), oyiga ajratma ixtiyoriy (> 0), muddat — oy.
 */
export const goalFormSchema = z
  .object({
    name: z.string().trim().min(1).max(NAME_MAX),
    currency: z.string().regex(/^[A-Z]{3}$/),
    target: z.string(),
    accountId: z.string(),
    savedManual: z.string(),
    monthlyContribution: z.string(),
    deadline: z.string(),
  })
  .superRefine((v, ctx) => {
    const issue = (path: string) => {
      ctx.addIssue({ code: 'custom', path: [path], message: path })
    }
    const target = money(v.target, v.currency)
    if (target === null || target <= 0) issue('target')
    if (!v.accountId && v.savedManual.trim()) {
      const saved = money(v.savedManual, v.currency)
      if (saved === null || saved < 0) issue('savedManual')
    }
    if (v.monthlyContribution.trim()) {
      const monthly = money(v.monthlyContribution, v.currency)
      if (monthly === null || monthly <= 0) issue('monthlyContribution')
    }
  })
  .transform((v): GoalInput => ({
    name: v.name,
    currency: v.currency,
    target: money(v.target, v.currency) ?? 0,
    // Bog'langan hisobda yig'ilgan = qoldiq; qo'lda qiymat saqlanmaydi.
    savedManual: v.accountId ? 0 : (money(v.savedManual, v.currency) ?? 0),
    monthlyContribution: money(v.monthlyContribution, v.currency),
    deadline: v.deadline ? `${v.deadline}-01` : null,
    accountId: v.accountId || null,
  }))

export type GoalFormValues = z.input<typeof goalFormSchema>

export const goalFormDefaults = (goal: Goal | undefined, currency: string): GoalFormValues => ({
  name: goal?.name ?? '',
  currency: goal?.currency ?? currency,
  target: goal ? formatMoneyInput(goal.target, goal.currency) : '',
  accountId: goal?.accountId ?? '',
  savedManual:
    goal && goal.savedManual > 0 ? formatMoneyInput(goal.savedManual, goal.currency) : '',
  monthlyContribution:
    goal?.monthlyContribution == null
      ? ''
      : formatMoneyInput(goal.monthlyContribution, goal.currency),
  deadline: goal?.deadline ? goal.deadline.slice(0, 7) : '',
})
