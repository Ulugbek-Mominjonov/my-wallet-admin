/** Supabase `getAuthenticatorAssuranceLevel()` natijasidan kerakli qism. */
export interface AssuranceLevel {
  currentLevel: string | null
  nextLevel: string | null
}

/**
 * - `ok` — davom etish mumkin;
 * - `challenge` — 2FA yoqilgan, lekin shu sessiyada kod kiritilmagan → /mfa;
 * - `enroll` — 2FA majburiy (platforma, BR-213), lekin hali yoqilmagan → profil.
 */
export type MfaGate = 'ok' | 'challenge' | 'enroll'

/** E21-T04: 2FA yoqqan foydalanuvchi har kirishda kod kiritadi; platforma — faqat aal2. */
export function mfaGate(level: AssuranceLevel, { required }: { required: boolean }): MfaGate {
  if (level.currentLevel === 'aal2') return 'ok'
  if (level.nextLevel === 'aal2') return 'challenge'
  return required ? 'enroll' : 'ok'
}
