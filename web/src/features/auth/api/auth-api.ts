import { queryOptions } from '@tanstack/react-query'

import { bootstrapSchema, type Bootstrap } from '@/entities/household'
import { toAppError } from '@/shared/api/errors'
import { qk } from '@/shared/api/query-keys'
import { supabase } from '@/shared/api/supabase'

/** Email kodi uzunligi (GoTrue `otp_length`, mobil bilan bir xil). */
export const EMAIL_CODE_LENGTH = 6

/** E21-T01: email'ga bir martalik kod (yangi foydalanuvchi — ro'yxatdan o'tadi). */
export async function sendEmailCode(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: { shouldCreateUser: true },
  })
  if (error) throw toAppError(error)
}

export async function verifyEmailCode(email: string, code: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({
    email: email.trim(),
    token: code.trim(),
    type: 'email',
  })
  if (error) throw toAppError(error)
}

/** Google — PKCE redirect; qaytgach `/auth/callback` sessiyani tugatadi. */
export async function signInWithGoogle(redirect: string): Promise<void> {
  const callback = new URL('/auth/callback', window.location.origin)
  callback.searchParams.set('redirect', redirect)
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: callback.toString() },
  })
  if (error) throw toAppError(error)
}

/** `global` — barcha qurilmalardagi sessiyalar (E21-T04). */
export async function signOut(scope: 'local' | 'global' = 'local'): Promise<void> {
  const { error } = await supabase.auth.signOut({ scope })
  if (error) throw toAppError(error)
}

export async function currentSession() {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw toAppError(error)
  return data.session
}

/** `app_bootstrap()` — profil, byudjetlar va rollar (E21-T02). */
export const bootstrapQuery = queryOptions({
  queryKey: qk.bootstrap(),
  queryFn: async (): Promise<Bootstrap> => {
    const { data, error } = await supabase.rpc('app_bootstrap')
    if (error) throw toAppError(error)
    return bootstrapSchema.parse(data)
  },
  staleTime: 5 * 60_000,
})
