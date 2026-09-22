import { z } from 'zod'

import { APP_LOCALES } from '@/shared/config/locale'

/** BR-011: byudjet a'zosi roli (contracts/api.md). */
export const ROLES = ['owner', 'admin', 'member', 'viewer'] as const
export type Role = (typeof ROLES)[number]

const localized = z.object({ uz: z.string(), ru: z.string(), en: z.string() }).partial()

/**
 * `app_bootstrap()` javobi — tashqi kirish, shuning uchun sxema bilan
 * tekshiriladi (shartnoma buzilsa aniq xato, jim noto'g'ri qiymat emas).
 */
export const bootstrapSchema = z.object({
  schema_version: z.number(),
  is_platform_admin: z.boolean(),
  profile: z.object({
    user_id: z.uuid(),
    display_name: z.string(),
    locale: z.enum(APP_LOCALES),
    last_household_id: z.uuid().nullable(),
  }),
  households: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      role: z.enum(ROLES),
      base_currency: z.string(),
      timezone: z.string(),
      onboarded: z.boolean(),
    }),
  ),
  currencies: z.array(
    z.object({
      code: z.string(),
      name: localized,
      symbol: z.string(),
      exponent: z.number().int(),
      allocation_rounding: z.number().int(),
    }),
  ),
  app_config: z.record(z.string(), z.unknown()),
})

export type Bootstrap = z.infer<typeof bootstrapSchema>
export type HouseholdSummary = Bootstrap['households'][number]

/** Kirgandan keyin ochiladigan byudjet: oxirgi tanlangan (a'zo bo'lsa) yoki birinchisi. */
export function pickHousehold(boot: Bootstrap): HouseholdSummary | undefined {
  const last = boot.profile.last_household_id
  return boot.households.find((h) => h.id === last) ?? boot.households[0]
}

/**
 * Rol huquqlari (server RLS bilan bir xil — contracts/api.md jadvallari):
 * `write` — amal/reja/qarz/maqsad (member ham), `manage` — spravochniklar,
 * limitlar, sozlamalar, a'zolar (owner/admin), `own` — egalik (owner).
 */
export type Permission = 'read' | 'write' | 'manage' | 'own'

const PERMISSIONS: Record<Role, readonly Permission[]> = {
  owner: ['read', 'write', 'manage', 'own'],
  admin: ['read', 'write', 'manage'],
  member: ['read', 'write'],
  viewer: ['read'],
}

export const roleCan = (role: Role, permission: Permission): boolean =>
  PERMISSIONS[role].includes(permission)
