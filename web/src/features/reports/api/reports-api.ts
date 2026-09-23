import { queryOptions } from '@tanstack/react-query'
import { z } from 'zod'

import { toAppError } from '@/shared/api/errors'
import { qk } from '@/shared/api/query-keys'
import { supabase } from '@/shared/api/supabase'
import type { MonthKey } from '@/shared/lib/month'

/** Hisobot keshlari — amal yozilganda byudjet prefiksida eskiradi (E24-T07). */
export const reportsKey = (householdId: string) =>
  [...qk.household(householdId), 'reports'] as const

/** Hisobotlar sekin o'zgaradi: bir daqiqa ichida qayta so'ralmaydi (E24-T07). */
const REPORT_STALE_MS = 60_000

const money = z.number()
const limitStatus = z.enum(['ok', 'near', 'over'])

const monthSchema = z.object({
  month: z.iso.date(),
  closed: z.boolean(),
  is_current: z.boolean(),
  totals: z.object({
    income: money,
    income_card: money,
    income_cash: money,
    expense: money,
    expense_card: money,
    expense_cash: money,
    planned: money,
    unpaid: money,
    unknown_count: z.number(),
    allocated: money,
    fund_spent: money,
  }),
  derived: z.object({
    balance: money,
    forecast: money,
    saved: money,
    saved_ratio: z.number(),
    spent_ratio: z.number(),
    /** Reja bo'lmasa — `null` (nolga bo'linmaydi). */
    plan_ratio: z.number().nullable(),
    card: money,
    cash: money,
  }),
  projection: z.object({
    days_in_month: z.number(),
    days_elapsed: z.number(),
    daily_spend: money,
    month_end_spend: money,
    income_received: money,
    income_expected: money,
    /** Kutilgan daromad hali to'liq kelmagan (BR-094 izohi) — belgi, summa emas. */
    income_pending: z.boolean(),
    month_end_balance: money,
    /** Faqat joriy oyda; o'tgan/kelgusi oyda — `null`. */
    per_day_available: money.nullable(),
  }),
  by_type: z.array(
    z.object({ category_id: z.string(), name: z.string(), card: money, cash: money }),
  ),
  by_category: z.array(
    z.object({
      category_id: z.string(),
      name: z.string(),
      parent_id: z.string().nullable(),
      planned: money,
      actual: money,
      actual_total: money,
      limit: money.nullable(),
      limit_ratio: z.number().nullable(),
      limit_status: limitStatus.nullable(),
    }),
  ),
  unpaid: z.array(
    z.object({
      id: z.string(),
      kind: z.enum(['expense', 'income', 'allocation']),
      name: z.string(),
      category_id: z.string().nullable(),
      planned_amount: money.nullable(),
      paid_amount: money,
      due_date: z.iso.date(),
      auto_pay: z.boolean(),
      status: z.string(),
    }),
  ),
  fund: z.object({ allocated: money, spent: money, balance: money }),
  savings: z.object({ before: money, this_month: money, total: money }),
  debts: z.object({
    i_owe: money,
    owed_to_me: money,
    monthly_obligation: money,
    net: money,
    paid_this_month: money,
  }),
  goals: z.array(
    z.object({
      goal_id: z.string(),
      name: z.string(),
      saved: money,
      remaining: money,
      progress: z.number(),
    }),
  ),
})

export type MonthReport = z.infer<typeof monthSchema>

/** BR-090..095: oylik hisobot — bitta tasnif yadrosidan (E09). */
export const monthReportQuery = (householdId: string, month: MonthKey) =>
  queryOptions({
    queryKey: [...reportsKey(householdId), 'month', month],
    staleTime: REPORT_STALE_MS,
    queryFn: async (): Promise<MonthReport> => {
      const { data, error } = await supabase.rpc('report_month', {
        p_household: householdId,
        p_month: `${month}-01`,
      })
      if (error) throw toAppError(error)
      return monthSchema.parse(data)
    },
  })

const yearMonthSchema = z.object({
  month: z.iso.date(),
  income: money,
  expense: money,
  allocated: money,
  fund_spent: money,
  balance: money,
  forecast: money,
  saved: money,
  saved_ratio: z.number(),
  spent_ratio: z.number(),
  plan_ratio: z.number().nullable(),
  closed: z.boolean(),
  /** Shu oyda yozuv bo'lganmi — bo'sh oylar jadvalda so'nib ko'rsatiladi. */
  has_records: z.boolean(),
})

const yearSchema = z.object({
  year: z.number(),
  months: z.array(yearMonthSchema),
  totals: yearMonthSchema.omit({ month: true, closed: true, has_records: true }),
})

export type YearReport = z.infer<typeof yearSchema>

/** BR-100..103: yillik ko'rinish — 12 oy va jami. */
export const yearReportQuery = (householdId: string, year: number) =>
  queryOptions({
    queryKey: [...reportsKey(householdId), 'year', year],
    staleTime: REPORT_STALE_MS,
    queryFn: async (): Promise<YearReport> => {
      const { data, error } = await supabase.rpc('report_year', {
        p_household: householdId,
        p_year: year,
      })
      if (error) throw toAppError(error)
      return yearSchema.parse(data)
    },
  })

const savingsSchema = z.object({
  months: z.array(
    z.object({
      month: z.iso.date(),
      income: money,
      expense: money,
      balance: money,
      accumulated: money,
      is_current: z.boolean(),
    }),
  ),
  summary: z.object({
    months_count: z.number(),
    total_income: money,
    total_expense: money,
    total_balance: money,
    total_saved: money,
    avg_monthly_saved: money,
    avg_monthly_expense: money,
  }),
})

export type SavingsReport = z.infer<typeof savingsSchema>

/** BR-102: jamg'arma — hamma oylar bo'yicha to'planish. */
export const savingsReportQuery = (householdId: string) =>
  queryOptions({
    queryKey: [...reportsKey(householdId), 'savings'],
    staleTime: REPORT_STALE_MS,
    queryFn: async (): Promise<SavingsReport> => {
      const { data, error } = await supabase.rpc('report_savings', { p_household: householdId })
      if (error) throw toAppError(error)
      return savingsSchema.parse(data)
    },
  })

const healthSchema = z.object({
  problems: z.array(z.object({ code: z.string() }).loose()),
  warnings: z.array(z.object({ code: z.string() }).loose()),
})

export type HealthReport = z.infer<typeof healthSchema>

/** BR-130: tekshiruv — muammolar va ogohlantirishlar (dashboard belgisi). */
export const healthCheckQuery = (householdId: string) =>
  queryOptions({
    queryKey: [...reportsKey(householdId), 'health'],
    staleTime: REPORT_STALE_MS,
    queryFn: async (): Promise<HealthReport> => {
      const { data, error } = await supabase.rpc('health_check', { p_household: householdId })
      if (error) throw toAppError(error)
      return healthSchema.parse(data)
    },
  })
