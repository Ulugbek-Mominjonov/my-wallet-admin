import { forbiddenError } from '@/shared/api/errors'

import { roleCan, type HouseholdSummary, type Permission } from './bootstrap'

/**
 * E21-T03: marshrut `beforeLoad` ida rol tekshiruvi. Menyudan yashirish
 * yetarli emas — sahifa URL orqali to'g'ridan ochilishi mumkin; rol
 * yetmasa 403 (server RLS ham rad etadi, bu — tushunarli UX uchun).
 *
 * @example beforeLoad: ({ context }) => requirePermission(context.household, 'manage')
 */
export function requirePermission(household: HouseholdSummary, permission: Permission): void {
  if (!roleCan(household.role, permission)) throw forbiddenError()
}
