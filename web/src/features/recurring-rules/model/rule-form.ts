import { z } from 'zod'

import { PLAN_KINDS, type RecurringRule } from '@/entities/recurring-rule'
import type { RecurringRuleInput } from '@/features/recurring-rules/api/recurring-rules-api'
import { formatMoneyInput, parseMoney } from '@/shared/lib/money'

export const NAME_MAX = 60
export const DAY_MIN = 1
export const DAY_MAX = 31

/** `input type="month"` qiymati (`YYYY-MM`) ↔ server oy boshi (`YYYY-MM-01`). */
const toMonthStart = (value: string) => (value ? `${value}-01` : null)
const fromMonthStart = (value: string | null) => (value ? value.slice(0, 7) : '')

/**
 * Forma → server qiymatlari. Qoidalar DB cheklovlari bilan bir xil:
 * ajratmada kategoriya yo'q va manba hisob majburiy, qolganida kategoriya
 * majburiy; avto to'lov — summa va hisob bilan (BR-075); davr to'g'ri.
 */
export function ruleFormSchema(currency: string) {
  return z
    .object({
      kind: z.enum(PLAN_KINDS),
      name: z.string().trim().min(1).max(NAME_MAX),
      categoryId: z.string(),
      accountId: z.string(),
      amount: z.string(),
      dayOfMonth: z.string().regex(/^\d{1,2}$/),
      autoPay: z.boolean(),
      active: z.boolean(),
      startMonth: z.string(),
      endMonth: z.string(),
    })
    .superRefine((values, ctx) => {
      const issue = (path: string, message: string) => {
        ctx.addIssue({ code: 'custom', path: [path], message })
      }
      if (values.kind !== 'allocation' && !values.categoryId) issue('categoryId', 'required')
      if (values.kind === 'allocation' && !values.accountId) issue('accountId', 'required')
      const amount = values.amount.trim() ? parseMoney(values.amount, currency) : null
      if (values.amount.trim() && (amount === null || amount <= 0)) issue('amount', 'invalid')
      const day = Number(values.dayOfMonth)
      if (day < DAY_MIN || day > DAY_MAX) issue('dayOfMonth', 'range')
      if (values.autoPay && (!values.amount.trim() || !values.accountId)) {
        issue('autoPay', 'needsAmountAndAccount')
      }
      if (values.startMonth && values.endMonth && values.endMonth < values.startMonth) {
        issue('endMonth', 'beforeStart')
      }
    })
    .transform((values): RecurringRuleInput => ({
      kind: values.kind,
      name: values.name,
      categoryId: values.kind === 'allocation' ? null : values.categoryId || null,
      accountId: values.accountId || null,
      amount: values.amount.trim() ? parseMoney(values.amount, currency) : null,
      dayOfMonth: Number(values.dayOfMonth),
      autoPay: values.autoPay,
      active: values.active,
      startMonth: toMonthStart(values.startMonth),
      endMonth: toMonthStart(values.endMonth),
    }))
}

export type RuleFormValues = z.input<ReturnType<typeof ruleFormSchema>>

export function ruleFormDefaults(
  rule: RecurringRule | undefined,
  currency: string,
): RuleFormValues {
  return {
    kind: rule?.kind ?? 'expense',
    name: rule?.name ?? '',
    categoryId: rule?.categoryId ?? '',
    accountId: rule?.accountId ?? '',
    amount: rule?.amount == null ? '' : formatMoneyInput(rule.amount, currency),
    dayOfMonth: String(rule?.dayOfMonth ?? 1),
    autoPay: rule?.autoPay ?? false,
    active: rule?.active ?? true,
    startMonth: fromMonthStart(rule?.startMonth ?? null),
    endMonth: fromMonthStart(rule?.endMonth ?? null),
  }
}
