import { z } from 'zod'

import type {
  HouseholdSettings,
  SettingsPatch,
} from '@/features/household-settings/api/settings-api'
import { formatMoneyInput, parseMoney } from '@/shared/lib/money'

/** `households.name` cheklovi (1–80) bilan bir xil. */
export const HOUSEHOLD_NAME_MAX = 80

export const generalFormSchema = z.object({
  name: z.string().trim().min(1).max(HOUSEHOLD_NAME_MAX),
  timezone: z.string().min(1),
}) satisfies z.ZodType<SettingsPatch>

export type GeneralFormValues = z.input<typeof generalFormSchema>

export const generalFormDefaults = (settings: HouseholdSettings): GeneralFormValues => ({
  name: settings.name,
  timezone: settings.timezone,
})

/** BR-060: foiz (0–100, 2 xona) yoki qat'iy summa; kun 1–31; manba — fond bo'lmagan hisob. */
export function fundFormSchema(currency: string) {
  return z
    .object({
      fundMode: z.enum(['percent', 'fixed']),
      fundPercent: z.string(),
      fundFixedAmount: z.string(),
      fundDay: z.string().regex(/^\d{1,2}$/),
      fundSourceAccountId: z.string(),
    })
    .superRefine((v, ctx) => {
      const issue = (path: string) => {
        ctx.addIssue({ code: 'custom', path: [path], message: path })
      }
      const percent = Number(v.fundPercent.replace(',', '.'))
      if (
        v.fundMode === 'percent' &&
        (!/^\d{1,3}([.,]\d{1,2})?$/.test(v.fundPercent.trim()) || percent > 100)
      ) {
        issue('fundPercent')
      }
      if (v.fundMode === 'fixed' && (parseMoney(v.fundFixedAmount || '0', currency) ?? -1) < 0) {
        issue('fundFixedAmount')
      }
      const day = Number(v.fundDay)
      if (day < 1 || day > 31) issue('fundDay')
    })
    .transform((v): SettingsPatch => ({
      fundMode: v.fundMode,
      fundPercent: Number(v.fundPercent.replace(',', '.')),
      fundFixedAmount: parseMoney(v.fundFixedAmount || '0', currency) ?? 0,
      fundDay: Number(v.fundDay),
      fundSourceAccountId: v.fundSourceAccountId || null,
    }))
}

export type FundFormValues = z.input<ReturnType<typeof fundFormSchema>>

export const fundFormDefaults = (settings: HouseholdSettings): FundFormValues => ({
  fundMode: settings.fundMode,
  fundPercent: String(settings.fundPercent),
  fundFixedAmount:
    settings.fundFixedAmount > 0
      ? formatMoneyInput(settings.fundFixedAmount, settings.baseCurrency)
      : '',
  fundDay: String(settings.fundDay),
  fundSourceAccountId: settings.fundSourceAccountId ?? '',
})
