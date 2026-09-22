import { z } from 'zod'

import { isMonthKey, type MonthKey } from '@/shared/lib/month'

/** E23-T04: rejalar sahifasi URL'i — oy va tab (yaroqsiz qiymat tashlanadi). */
export const plansSearchSchema = z.object({
  month: z
    .custom<MonthKey>((value) => typeof value === 'string' && isMonthKey(value))
    .optional()
    .catch(undefined),
  tab: z.enum(['expense', 'income']).optional().catch(undefined),
})
