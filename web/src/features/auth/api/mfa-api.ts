import { queryOptions } from '@tanstack/react-query'

import type { AssuranceLevel } from '@/features/auth/model/mfa-gate'
import { toAppError } from '@/shared/api/errors'
import { qk } from '@/shared/api/query-keys'
import { supabase } from '@/shared/api/supabase'

/** Autentifikator ilovasi kodi uzunligi (TOTP, RFC 6238). */
export const TOTP_CODE_LENGTH = 6

export interface TotpFactor {
  id: string
  createdAt: string
}

export interface TotpEnrollment {
  factorId: string
  /** QR kod — SVG data URI (CSP: `img-src data:`). */
  qrCode: string
  /** Qo'lda kiritish uchun kalit (QR skanerlanmasa). */
  secret: string
}

/** Tasdiqlangan TOTP omili (yo'q bo'lsa — null). */
export const totpFactorQuery = queryOptions({
  queryKey: qk.mfaFactors(),
  queryFn: async (): Promise<TotpFactor | null> => {
    const { data, error } = await supabase.auth.mfa.listFactors()
    if (error) throw toAppError(error)
    const factor = data.totp.at(0)
    return factor ? { id: factor.id, createdAt: factor.created_at } : null
  },
})

/**
 * Yangi TOTP omili. Avvalgi tugallanmagan (unverified) urinishlar o'chiriladi —
 * ular faqat joy egallaydi (`max_enrolled_factors`).
 */
export async function enrollTotp(): Promise<TotpEnrollment> {
  const { data: factors, error: listError } = await supabase.auth.mfa.listFactors()
  if (listError) throw toAppError(listError)
  const stale = factors.all.filter((f) => f.factor_type === 'totp' && f.status === 'unverified')
  await Promise.all(stale.map((f) => unenrollFactor(f.id)))

  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' })
  if (error) throw toAppError(error)
  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret }
}

/** Kodni tekshiradi; muvaffaqiyatda sessiya aal2 ga ko'tariladi. */
export async function verifyTotp(factorId: string, code: string): Promise<void> {
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() })
  if (error) throw toAppError(error)
}

/** Tasdiqlangan omilni o'chirish uchun sessiya aal2 bo'lishi shart (GoTrue). */
export async function unenrollFactor(factorId: string): Promise<void> {
  const { error } = await supabase.auth.mfa.unenroll({ factorId })
  if (error) throw toAppError(error)
}

/** Joriy va erishish mumkin bo'lgan daraja — sessiyadan (tarmoqsiz). */
export async function assuranceLevel(): Promise<AssuranceLevel> {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (error) throw toAppError(error)
  return data
}
