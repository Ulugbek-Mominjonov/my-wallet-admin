import { z } from 'zod'

import { isMonthKey, type MonthKey } from '@/shared/lib/month'

/** E24-T02: hisobot sahifasi URL'i — oy (yaroqsiz qiymat tashlanadi). */
export const reportSearchSchema = z.object({
  month: z
    .custom<MonthKey>((value) => typeof value === 'string' && isMonthKey(value))
    .optional()
    .catch(undefined),
})
