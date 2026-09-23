import { queryOptions } from '@tanstack/react-query'
import { z } from 'zod'

import { toAppError } from '@/shared/api/errors'
import { supabase } from '@/shared/api/supabase'

/** Platforma (super-admin) keshlari — byudjetga bog'liq emas. */
export const platformKey = (name: string) => ['platform', name] as const

const i18nSchema = z.object({ uz: z.string(), ru: z.string(), en: z.string() })

export type I18nName = z.infer<typeof i18nSchema>

const currencySchema = z.object({
  code: z.string(),
  name_i18n: i18nSchema,
  symbol: z.string(),
  exponent: z.number(),
  active: z.boolean(),
  sort_order: z.number(),
})

export type Currency = z.infer<typeof currencySchema>

/** BR-190: valyutalar spravochnigi (o'qish — hamma, yozish — platforma admini). */
export const currenciesQuery = queryOptions({
  queryKey: platformKey('currencies'),
  queryFn: async (): Promise<Currency[]> => {
    const { data, error } = await supabase
      .from('currencies')
      .select('code, name_i18n, symbol, exponent, active, sort_order')
      .order('sort_order')
    if (error) throw toAppError(error)
    return z.array(currencySchema).parse(data)
  },
})

export type CurrencyInput = Omit<Currency, 'code'> & { code: string }

/** Yangi kod — qo'shish, mavjud kod — tahrirlash (kod birlamchi kalit). */
export async function saveCurrency(input: CurrencyInput): Promise<void> {
  const { error } = await supabase.from('currencies').upsert({
    code: input.code,
    name_i18n: input.name_i18n,
    symbol: input.symbol,
    exponent: input.exponent,
    active: input.active,
    sort_order: input.sort_order,
  })
  if (error) throw toAppError(error)
}

export async function deleteCurrency(code: string): Promise<void> {
  const { error } = await supabase.from('currencies').delete().eq('code', code)
  if (error) throw toAppError(error)
}

const templateSchema = z.object({
  id: z.string(),
  kind: z.enum(['income', 'expense']),
  name_i18n: i18nSchema,
  icon: z.string(),
  color: z.string(),
  month_shift: z.number(),
  system_code: z.string().nullable(),
  sort_order: z.number(),
})

export type CategoryTemplate = z.infer<typeof templateSchema>

/** BR-031/032: yangi byudjet shu shablonlardan kategoriya oladi. */
export const categoryTemplatesQuery = queryOptions({
  queryKey: platformKey('category-templates'),
  queryFn: async (): Promise<CategoryTemplate[]> => {
    const { data, error } = await supabase
      .from('category_templates')
      .select('id, kind, name_i18n, icon, color, month_shift, system_code, sort_order')
      .order('sort_order')
    if (error) throw toAppError(error)
    return z.array(templateSchema).parse(data)
  },
})

export type CategoryTemplateInput = Omit<CategoryTemplate, 'id' | 'system_code'>

export async function saveCategoryTemplate(
  id: string | null,
  input: CategoryTemplateInput,
): Promise<void> {
  const row = {
    kind: input.kind,
    name_i18n: input.name_i18n,
    icon: input.icon,
    color: input.color,
    month_shift: input.month_shift,
    sort_order: input.sort_order,
  }
  const { error } =
    id === null
      ? await supabase.from('category_templates').insert(row)
      : await supabase.from('category_templates').update(row).eq('id', id)
  if (error) throw toAppError(error)
}

export async function deleteCategoryTemplate(id: string): Promise<void> {
  const { error } = await supabase.from('category_templates').delete().eq('id', id)
  if (error) throw toAppError(error)
}

export const AMOUNT_UNITS = ['major', 'minor'] as const

const cardTemplateSchema = z.object({
  id: z.string(),
  bank: z.string(),
  pattern: z.string(),
  kind: z.enum(['income', 'expense']),
  amount_unit: z.enum(AMOUNT_UNITS),
  currency: z.string(),
  sample: z.string().nullable(),
  active: z.boolean(),
  sort_order: z.number(),
})

export type CardTemplate = z.infer<typeof cardTemplateSchema>

/** BR-222: karta xabarnomasi shablonlari (tahlil — E31). */
export const cardTemplatesQuery = queryOptions({
  queryKey: platformKey('card-templates'),
  queryFn: async (): Promise<CardTemplate[]> => {
    const { data, error } = await supabase
      .from('card_message_templates')
      .select('id, bank, pattern, kind, amount_unit, currency, sample, active, sort_order')
      .order('sort_order')
      .order('bank')
    if (error) throw toAppError(error)
    return z.array(cardTemplateSchema).parse(data)
  },
})

export type CardTemplateInput = Omit<CardTemplate, 'id'>

export async function saveCardTemplate(id: string | null, input: CardTemplateInput): Promise<void> {
  const row = {
    bank: input.bank,
    pattern: input.pattern,
    kind: input.kind,
    amount_unit: input.amount_unit,
    currency: input.currency,
    sample: input.sample,
    active: input.active,
    sort_order: input.sort_order,
  }
  const { error } =
    id === null
      ? await supabase.from('card_message_templates').insert(row)
      : await supabase.from('card_message_templates').update(row).eq('id', id)
  if (error) throw toAppError(error)
}

export async function deleteCardTemplate(id: string): Promise<void> {
  const { error } = await supabase.from('card_message_templates').delete().eq('id', id)
  if (error) throw toAppError(error)
}
