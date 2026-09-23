import { z } from 'zod'

import { isMonthKey, type MonthKey } from '@/shared/lib/month'

const monthKey = z.custom<MonthKey>((value) => typeof value === 'string' && isMonthKey(value))

/** E24-T02: hisobot sahifasi URL'i — oy (yaroqsiz qiymat tashlanadi). */
export const reportSearchSchema = z.object({
  month: z
    .custom<MonthKey>((value) => typeof value === 'string' && isMonthKey(value))
    .optional()
    .catch(undefined),
})

/** E24-T03: yillik ko'rinish URL'i. */
export const yearSearchSchema = z.object({
  year: z.number().int().min(2000).max(2100).optional().catch(undefined),
})

/** E24-T05: kategoriya tahlili URL'i — davr va tanlangan kategoriya. */
export const trendSearchSchema = z.object({
  from: monthKey.optional().catch(undefined),
  to: monthKey.optional().catch(undefined),
  category: z.guid().optional().catch(undefined),
})
