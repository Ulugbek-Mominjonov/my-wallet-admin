import { setupServer } from 'msw/node'

/** Supabase (Auth, PostgREST) so'rovlari — testlarda tarmoqqa chiqmaydi. */
export const server = setupServer()

/** Test Supabase manzilidagi yo'l (`vitest.config.ts` → `test.env`). */
export const supabasePath = (path: string): string => `${import.meta.env.VITE_SUPABASE_URL}${path}`

/** PostgREST biznes xatosi (`P0001`, `message` = kod — contracts/api.md). */
export const businessError = (code: string) => ({
  code: 'P0001',
  message: code,
  details: null,
  hint: null,
})

export const TEST_USER_ID = '0198f000-0000-7000-8000-000000000001'

const base64Url = (value: object) => btoa(JSON.stringify(value)).replace(/=+$/, '')

/**
 * Kirgan foydalanuvchi: sessiya supabase-js saqlaydigan joyga (localStorage)
 * yoziladi. Token JWT ko'rinishida — klient `aal`/`amr` ni undan o'qiydi
 * (imzo tekshirilmaydi).
 */
export function signInTestUser({ aal = 'aal1' }: { aal?: 'aal1' | 'aal2' } = {}) {
  const now = Math.floor(Date.now() / 1000)
  const amr = [{ method: 'otp', timestamp: now - 60 }]
  if (aal === 'aal2') amr.push({ method: 'totp', timestamp: now - 30 })
  const accessToken = [
    base64Url({ alg: 'HS256', typ: 'JWT' }),
    base64Url({ sub: TEST_USER_ID, role: 'authenticated', exp: now + 3600, aal, amr }),
    'signature',
  ].join('.')
  const session = {
    access_token: accessToken,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token: 'test-refresh-token',
    user: testUser(),
  }
  // supabase-js kaliti: `sb-<host birinchi qismi>-auth-token`.
  const ref = new URL(supabasePath('')).hostname.split('.')[0] ?? ''
  localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(session))
  return session
}

/** GoTrue `/user` javobi; `factors` — 2FA omillari. */
export function testUser(factors: object[] = []) {
  return {
    id: TEST_USER_ID,
    aud: 'authenticated',
    email: 'ali@misol.uz',
    app_metadata: { provider: 'email' },
    user_metadata: {},
    created_at: '2026-09-01T00:00:00Z',
    factors,
  }
}
