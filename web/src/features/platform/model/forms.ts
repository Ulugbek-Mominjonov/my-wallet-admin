import { z } from 'zod'

import type { CardTemplate, CategoryTemplate, Currency } from '@/features/platform/api/platform-api'

/** Spravochnik nomlari uch tilda (jadval CHECK'i bilan bir xil). */
const nameSchema = z.object({
  uz: z.string().trim().min(1).max(60),
  ru: z.string().trim().min(1).max(60),
  en: z.string().trim().min(1).max(60),
})

const orderSchema = z.string().regex(/^\d{1,4}$/)

/** BR-190: ISO 4217 kodi va kasr xonalari (0–4). */
export const currencyFormSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/),
  name_i18n: nameSchema,
  symbol: z.string().trim().min(1).max(5),
  exponent: z.string().regex(/^[0-4]$/),
  active: z.boolean(),
  sort_order: orderSchema,
})

export type CurrencyFormValues = z.infer<typeof currencyFormSchema>

export const currencyFormDefaults = (currency?: Currency): CurrencyFormValues => ({
  code: currency?.code ?? '',
  name_i18n: currency?.name_i18n ?? { uz: '', ru: '', en: '' },
  symbol: currency?.symbol ?? '',
  exponent: String(currency?.exponent ?? 2),
  active: currency?.active ?? true,
  sort_order: String(currency?.sort_order ?? 0),
})

/** BR-031: oy siljishi faqat daromad turida (−1 yoki 0). */
export const templateFormSchema = z
  .object({
    kind: z.enum(['income', 'expense']),
    name_i18n: nameSchema,
    icon: z.string().min(1),
    color: z.string().regex(/^#[0-9A-F]{6}$/),
    month_shift: z.enum(['0', '-1']),
    sort_order: orderSchema,
  })
  .refine((v) => v.kind === 'income' || v.month_shift === '0', {
    path: ['month_shift'],
    message: 'month_shift',
  })

export type TemplateFormValues = z.infer<typeof templateFormSchema>

export const templateFormDefaults = (template?: CategoryTemplate): TemplateFormValues => ({
  kind: template?.kind ?? 'expense',
  name_i18n: template?.name_i18n ?? { uz: '', ru: '', en: '' },
  icon: template?.icon ?? 'dots',
  color: template?.color ?? '#64748B',
  month_shift: template?.month_shift === -1 ? '-1' : '0',
  sort_order: String(template?.sort_order ?? 0),
})

/** BR-222: naqshda `amount` guruhi majburiy (jadval CHECK'i bilan bir xil). */
export const cardFormSchema = z.object({
  bank: z.string().trim().min(1).max(60),
  pattern: z
    .string()
    .trim()
    .min(8)
    .max(500)
    .refine((value) => value.includes('(?<amount>'), { message: 'amount' })
    .refine(isValidRegex, { message: 'regex' }),
  kind: z.enum(['income', 'expense']),
  amount_unit: z.enum(['major', 'minor']),
  currency: z.string().min(3),
  sample: z.string().trim().max(500),
  active: z.boolean(),
  sort_order: orderSchema,
})

export type CardFormValues = z.infer<typeof cardFormSchema>

export const cardFormDefaults = (template?: CardTemplate): CardFormValues => ({
  bank: template?.bank ?? '',
  pattern: template?.pattern ?? '',
  kind: template?.kind ?? 'expense',
  amount_unit: template?.amount_unit ?? 'major',
  currency: template?.currency ?? 'UZS',
  sample: template?.sample ?? '',
  active: template?.active ?? true,
  sort_order: String(template?.sort_order ?? 0),
})

/** Naqsh serverda emas, tahlilchida (JS) ishlaydi — shu yerda tekshiriladi. */
function isValidRegex(pattern: string): boolean {
  try {
    new RegExp(pattern, 'u')
    return true
  } catch {
    return false
  }
}

/**
 * Namunaviy xabarga naqshni qo'llash: admin shablonni saqlashdan oldin
 * nima ajralishini ko'radi (BR-222 — summa, sana, joy, karta).
 */
export function matchSample(
  pattern: string,
  sample: string,
): Record<string, string> | null | 'invalid' {
  if (!isValidRegex(pattern)) return 'invalid'
  const match = new RegExp(pattern, 'u').exec(sample)
  if (match === null) return null
  return { ...match.groups }
}
