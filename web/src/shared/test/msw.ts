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
