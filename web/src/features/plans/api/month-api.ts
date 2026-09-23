import { queryOptions } from '@tanstack/react-query'
import { z } from 'zod'

import { toAppError } from '@/shared/api/errors'
import { part, qk } from '@/shared/api/query-keys'
import { supabase } from '@/shared/api/supabase'
import type { MonthKey } from '@/shared/lib/month'

/** Oy holati keshi (amal formasidagi "yopilgan oy" ogohlantirishi ham shu prefiksda). */
export const monthsKey = (householdId: string) => part(householdId, 'months')

/**
 * Dialog tekshiruvlari (preview, yopish tekshiruvi) — alohida kalitda: oy
 * holati yangilanganda qayta so'ralmaydi, har dialog ochilishida yangidan.
 */
const monthCheckKey = (householdId: string, month: MonthKey, check: string) =>
  [...qk.household(householdId), 'month-checks', month, check] as const

export interface MonthState {
  /** BR-081: doimiy rejalardan shu oy rejalari yaratilgan. */
  opened: boolean
  /** BR-150: yopilgan (hisobotda 🔒). */
  closed: boolean
}

export const monthStateQuery = (householdId: string, month: MonthKey) =>
  queryOptions({
    queryKey: [...monthsKey(householdId), month, 'state'],
    queryFn: async (): Promise<MonthState> => {
      const { data, error } = await supabase
        .from('months')
        .select('opened_at, closed_at')
        .eq('household_id', householdId)
        .eq('month', `${month}-01`)
        .maybeSingle()
      if (error) throw toAppError(error)
      return { opened: data?.opened_at != null, closed: data?.closed_at != null }
    },
  })

const previewSchema = z.object({
  new: z.number(),
  existing: z.number(),
  items: z.array(
    z.object({
      kind: z.enum(['expense', 'income', 'allocation']),
      name: z.string(),
      planned_amount: z.number().nullable(),
      due_date: z.string(),
      exists: z.boolean(),
    }),
  ),
})

export type OpenMonthPreview = z.infer<typeof previewSchema>

/** BR-084: ochishdan oldin — nimalar yaratiladi (va nimalar allaqachon bor). */
export const openMonthPreviewQuery = (householdId: string, month: MonthKey) =>
  queryOptions({
    queryKey: monthCheckKey(householdId, month, 'open-preview'),
    queryFn: async (): Promise<OpenMonthPreview> => {
      const { data, error } = await supabase.rpc('open_month_preview', {
        p_household: householdId,
        p_month: `${month}-01`,
      })
      if (error) throw toAppError(error)
      return previewSchema.parse(data)
    },
    // Har ochilishda yangi holat — doimiy reja boshqa oynada o'zgargan bo'lishi mumkin.
    staleTime: 0,
  })

const openResultSchema = z.object({ created: z.number(), skipped: z.number() })

/** BR-081: idempotent — bor rejalar o'tkaziladi, qo'lda tuzatilganlari yozilmaydi (BR-082). */
export async function openMonth(
  householdId: string,
  month: MonthKey,
): Promise<z.infer<typeof openResultSchema>> {
  const { data, error } = await supabase.rpc('open_month', {
    p_household: householdId,
    p_month: `${month}-01`,
  })
  if (error) throw toAppError(error)
  return openResultSchema.parse(data)
}

const closeCheckSchema = z.object({
  unpaid_count: z.number(),
  unpaid_amount: z.number(),
  unknown_count: z.number(),
})

export type MonthCloseCheck = z.infer<typeof closeCheckSchema>

/** BR-153: yopishdan oldin — to'lanmagan va summasi noma'lum rejalar. */
export const monthCloseCheckQuery = (householdId: string, month: MonthKey) =>
  queryOptions({
    queryKey: monthCheckKey(householdId, month, 'close-check'),
    queryFn: async (): Promise<MonthCloseCheck> => {
      const { data, error } = await supabase.rpc('month_close_check', {
        p_household: householdId,
        p_month: `${month}-01`,
      })
      if (error) throw toAppError(error)
      return closeCheckSchema.parse(data)
    },
    staleTime: 0,
  })

/** BR-150: tugagan oyni yopish / qayta ochish (owner/admin). */
export async function setMonthClosed(
  householdId: string,
  month: MonthKey,
  closed: boolean,
): Promise<void> {
  const { error } = await supabase.rpc('set_month_closed', {
    p_household: householdId,
    p_month: `${month}-01`,
    p_closed: closed,
  })
  if (error) throw toAppError(error)
}
