import { queryOptions } from '@tanstack/react-query'
import { z } from 'zod'

import { toAppError } from '@/shared/api/errors'
import { qk } from '@/shared/api/query-keys'
import { supabase } from '@/shared/api/supabase'
import type { MonthKey } from '@/shared/lib/month'

/** Jurnalda ko'rsatiladigan oxirgi yozuvlar (BR-166 — 90 kun saqlanadi). */
export const OUTBOX_LIMIT = 20
/** Arxivdagi oxirgi oylar (BR-167). */
export const ARCHIVE_LIMIT = 12

export const CHANNELS = ['push', 'telegram', 'email'] as const
export type Channel = (typeof CHANNELS)[number]

export interface NotificationPrefs {
  push: boolean
  telegram: boolean
  email: boolean
  reminderHour: number
  daysAhead: number
  monthlyReport: boolean
  reportDay: number
  limitAlerts: boolean
  incomeMissing: boolean
  /** E30-T03: boshqa a'zoning shu summadan katta xarajati (null — o'chiq). */
  bigExpense: number | null
}

export type PrefsPatch = Partial<NotificationPrefs>

export const prefsKey = (householdId: string) =>
  [...qk.household(householdId), 'notification-prefs'] as const

const PREFS_COLUMNS =
  'push, telegram, email, reminder_hour, days_ahead, monthly_report, report_day, limit_alerts, income_missing, big_expense'

/** BR-160..165: o'z sozlamalari (qator a'zolik bilan yaratilgan). */
export const prefsQuery = (householdId: string) =>
  queryOptions({
    queryKey: prefsKey(householdId),
    queryFn: async (): Promise<NotificationPrefs> => {
      const { data, error } = await supabase
        .from('notification_prefs')
        .select(PREFS_COLUMNS)
        .eq('household_id', householdId)
        .single()
      if (error) throw toAppError(error)
      return {
        push: data.push,
        telegram: data.telegram,
        email: data.email,
        reminderHour: data.reminder_hour,
        daysAhead: data.days_ahead,
        monthlyReport: data.monthly_report,
        reportDay: data.report_day,
        limitAlerts: data.limit_alerts,
        incomeMissing: data.income_missing,
        bigExpense: data.big_expense,
      }
    },
  })

/** Faqat grant qilingan ustunlar; RLS — o'z qatori. */
export async function updatePrefs(householdId: string, patch: PrefsPatch): Promise<void> {
  const { error } = await supabase
    .from('notification_prefs')
    .update({
      push: patch.push,
      telegram: patch.telegram,
      email: patch.email,
      reminder_hour: patch.reminderHour,
      days_ahead: patch.daysAhead,
      monthly_report: patch.monthlyReport,
      report_day: patch.reportDay,
      limit_alerts: patch.limitAlerts,
      income_missing: patch.incomeMissing,
      big_expense: patch.bigExpense,
    })
    .eq('household_id', householdId)
  if (error) throw toAppError(error)
}

export const telegramKey = ['telegram-link'] as const

/** BR-163: ulanish holati — o'z `telegram_links` qatori. */
export const telegramQuery = queryOptions({
  queryKey: telegramKey,
  queryFn: async (): Promise<{ linkedAt: string } | null> => {
    const { data, error } = await supabase.from('telegram_links').select('linked_at').maybeSingle()
    if (error) throw toAppError(error)
    return data === null ? null : { linkedAt: data.linked_at }
  },
})

const linkTokenSchema = z.object({ token: z.string(), expires_at: z.string() })

/** Bir martalik token (15 daqiqa) — `t.me/<bot>?start=<token>`. */
export async function telegramLinkToken(): Promise<z.infer<typeof linkTokenSchema>> {
  const { data, error } = await supabase.rpc('telegram_link_token')
  if (error) throw toAppError(error)
  return linkTokenSchema.parse(data)
}

export async function telegramUnlink(): Promise<void> {
  const { error } = await supabase.rpc('telegram_unlink')
  if (error) throw toAppError(error)
}

const channelResultSchema = z.object({
  channel: z.enum(CHANNELS),
  queued: z.boolean(),
  reason: z.string().nullable(),
})

export type ChannelResult = z.infer<typeof channelResultSchema>

const channelsSchema = z.array(channelResultSchema)

/** BR-164: sinov xabari — har kanal uchun natija (yoki nega yuborilmagani). */
export async function testNotification(householdId: string): Promise<ChannelResult[]> {
  const { data, error } = await supabase.rpc('test_notification', { p_household: householdId })
  if (error) throw toAppError(error)
  return channelsSchema.parse(data)
}

const reportNowSchema = z.object({
  report: z.object({
    income: z.number(),
    expense: z.number(),
    saved: z.number(),
  }),
  channels: channelsSchema,
})

export type ReportNow = z.infer<typeof reportNowSchema>

/** BR-164: tanlangan oy hisobotini hozir yaratib o'ziga yuborish. */
export async function sendMonthlyReportNow(
  householdId: string,
  month: MonthKey,
): Promise<ReportNow> {
  const { data, error } = await supabase.rpc('send_monthly_report_now', {
    p_household: householdId,
    p_month: `${month}-01`,
  })
  if (error) throw toAppError(error)
  return reportNowSchema.parse(data)
}

export interface OutboxEntry {
  id: number
  channel: Channel
  type: string
  status: 'pending' | 'sending' | 'sent' | 'failed' | 'skipped'
  error: string | null
  createdAt: string
  sentAt: string | null
}

export const outboxKey = (householdId: string) =>
  [...qk.household(householdId), 'notification-outbox'] as const

/** BR-166: o'z yuborish jurnali — oxirgi yozuvlar (indeks: user_id, created_at). */
export const outboxQuery = (householdId: string) =>
  queryOptions({
    queryKey: outboxKey(householdId),
    queryFn: async (): Promise<OutboxEntry[]> => {
      const { data, error } = await supabase
        .from('notification_outbox')
        .select('id, channel, type, status, error, created_at, sent_at')
        .eq('household_id', householdId)
        .order('created_at', { ascending: false })
        .limit(OUTBOX_LIMIT)
      if (error) throw toAppError(error)
      return data.map((row) => ({
        id: row.id,
        channel: row.channel as Channel,
        type: row.type,
        status: row.status as OutboxEntry['status'],
        error: row.error,
        createdAt: row.created_at,
        sentAt: row.sent_at,
      }))
    },
  })

export interface ArchivedReport {
  month: string
  generatedAt: string
  income: number
  expense: number
  saved: number
  savedRatio: number | null
}

const payloadSchema = z.object({
  income: z.number(),
  expense: z.number(),
  saved: z.number(),
  saved_ratio: z.number().nullable(),
})

export const archiveKey = (householdId: string) =>
  [...qk.household(householdId), 'monthly-reports'] as const

/** BR-167: byudjetning oylik hisobotlari arxivi (a'zolar ko'radi). */
export const archiveQuery = (householdId: string) =>
  queryOptions({
    queryKey: archiveKey(householdId),
    queryFn: async (): Promise<ArchivedReport[]> => {
      const { data, error } = await supabase
        .from('monthly_reports')
        .select('month, generated_at, payload')
        .eq('household_id', householdId)
        .order('month', { ascending: false })
        .limit(ARCHIVE_LIMIT)
      if (error) throw toAppError(error)
      return data.map((row) => {
        const payload = payloadSchema.parse(row.payload)
        return {
          month: row.month,
          generatedAt: row.generated_at,
          income: payload.income,
          expense: payload.expense,
          saved: payload.saved,
          savedRatio: payload.saved_ratio,
        }
      })
    },
  })
