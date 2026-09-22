import { z } from 'zod'

import { APP_LOCALES } from '@/shared/config/locale'

/** `profiles.display_name` cheklovi bilan bir xil. */
export const PROFILE_NAME_MAX = 100

export const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(PROFILE_NAME_MAX),
  locale: z.enum(APP_LOCALES),
})

export type ProfileValues = z.infer<typeof profileSchema>
