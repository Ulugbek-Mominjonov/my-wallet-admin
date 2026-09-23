import { queryOptions } from '@tanstack/react-query'
import { z } from 'zod'

import type { Json } from '@/shared/api/database.types'
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

/** `app_config.value` — ixtiyoriy JSON (`Json` — generatsiya qilingan tip). */
export type ConfigValue = Json

const configRowSchema = z.object({ key: z.string(), value: z.custom<ConfigValue>() })

export type ConfigRow = z.infer<typeof configRowSchema>

/** BR-214: ilova konfiguratsiyasi (hamma klientga `app_bootstrap` orqali boradi). */
export const appConfigQuery = queryOptions({
  queryKey: platformKey('app-config'),
  queryFn: async (): Promise<ConfigRow[]> => {
    const { data, error } = await supabase.from('app_config').select('key, value').order('key')
    if (error) throw toAppError(error)
    return z.array(configRowSchema).parse(data)
  },
})

export async function saveConfig(key: string, value: ConfigValue): Promise<void> {
  const { error } = await supabase.from('app_config').upsert({ key, value })
  if (error) throw toAppError(error)
}

export async function deleteConfig(key: string): Promise<void> {
  const { error } = await supabase.from('app_config').delete().eq('key', key)
  if (error) throw toAppError(error)
}

const platformUserSchema = z.object({
  user_id: z.string(),
  email: z.string().nullable(),
  display_name: z.string(),
  locale: z.string(),
  created_at: z.string(),
  last_sign_in_at: z.string().nullable(),
  blocked: z.boolean(),
  households: z.number(),
  is_admin: z.boolean(),
})

export type PlatformUser = z.infer<typeof platformUserSchema>

const usersSchema = z.object({ total: z.number(), users: z.array(platformUserSchema) })

export type PlatformUsers = z.infer<typeof usersSchema>

/** Bir sahifadagi foydalanuvchilar. */
export const USERS_PAGE_SIZE = 50

/** E26-T04: qo'llab-quvvatlash ro'yxati (agregat; byudjet ichi ko'rinmaydi). */
export const usersQuery = (query: string, limit = USERS_PAGE_SIZE) =>
  queryOptions({
    queryKey: [...platformKey('users'), { query, limit }],
    queryFn: async (): Promise<PlatformUsers> => {
      const { data, error } = await supabase.rpc('platform_users', {
        p_query: query === '' ? undefined : query,
        p_limit: limit,
      })
      if (error) throw toAppError(error)
      return usersSchema.parse(data)
    },
  })

/** Bloklash — kirish to'xtaydi, ma'lumot o'chmaydi. */
export async function setBlocked(userId: string, blocked: boolean): Promise<void> {
  const { error } = await supabase.rpc('platform_set_blocked', {
    p_user: userId,
    p_blocked: blocked,
  })
  if (error) throw toAppError(error)
}

export const ANNOUNCEMENT_CHANNELS = ['push', 'telegram', 'email'] as const
export type AnnouncementChannel = (typeof ANNOUNCEMENT_CHANNELS)[number]

const announcementResultSchema = z.object({
  batch: z.string(),
  queued: z.number(),
  users: z.number(),
})

export type AnnouncementResult = z.infer<typeof announcementResultSchema>

export interface AnnouncementInput {
  message: I18nName
  title: I18nName | null
  users: readonly string[] | null
  channels: readonly AnnouncementChannel[]
}

/** E26-T03: e'lonni navbatga qo'yish (yuborish — notify-dispatch). */
export async function sendAnnouncement(input: AnnouncementInput): Promise<AnnouncementResult> {
  const { data, error } = await supabase.rpc('send_announcement', {
    p_message: input.message,
    p_title: input.title,
    p_users: input.users === null ? undefined : [...input.users],
    p_channels: [...input.channels],
  })
  if (error) throw toAppError(error)
  return announcementResultSchema.parse(data)
}

const announcementLogSchema = z.object({
  items: z.array(
    z.object({
      batch: z.string(),
      created_at: z.string(),
      users: z.number(),
      total: z.number(),
      sent: z.number(),
      failed: z.number(),
      pending: z.number(),
      message: z.string().nullable(),
    }),
  ),
})

export type AnnouncementLog = z.infer<typeof announcementLogSchema>

/** E'lonlar jurnali — paket bo'yicha holat. */
export const announcementLogQuery = queryOptions({
  queryKey: platformKey('announcements'),
  queryFn: async (): Promise<AnnouncementLog> => {
    const { data, error } = await supabase.rpc('announcement_log', {})
    if (error) throw toAppError(error)
    return announcementLogSchema.parse(data)
  },
})
