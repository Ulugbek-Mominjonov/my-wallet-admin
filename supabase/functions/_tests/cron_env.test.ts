import { assert, assertEquals, assertFalse, assertThrows } from '@std/assert'
import { isAuthorizedCron, safeEqual } from '../_shared/cron.ts'
import { ConfigError, publishableKey, serviceKey } from '../_shared/env.ts'

Deno.test('safeEqual', () => {
  assert(safeEqual('abc', 'abc'))
  assertFalse(safeEqual('abc', 'abd'))
  assertFalse(safeEqual('abc', 'abcd'))
  assertFalse(safeEqual('', 'a'))
})

Deno.test("cron sarlavhasi: sir mos kelsa va sozlangan bo'lsa", () => {
  const request = (secret?: string) =>
    new Request('http://x', { method: 'POST', headers: secret ? { 'x-cron-secret': secret } : {} })
  assert(isAuthorizedCron(request('s3cret'), 's3cret'))
  assertFalse(isAuthorizedCron(request('wrong'), 's3cret'))
  assertFalse(isAuthorizedCron(request(), 's3cret'))
  // Sir sozlanmagan — hech kim o'tmaydi (bo'sh sarlavha ham).
  assertFalse(isAuthorizedCron(request(''), undefined))
})

function withEnv(values: Record<string, string | undefined>, fn: () => void) {
  const saved = Object.fromEntries(Object.keys(values).map((name) => [name, Deno.env.get(name)]))
  const apply = (entries: Record<string, string | undefined>) => {
    for (const [name, value] of Object.entries(entries)) {
      if (value === undefined) Deno.env.delete(name)
      else Deno.env.set(name, value)
    }
  }
  apply(values)
  try {
    fn()
  } finally {
    apply(saved)
  }
}

Deno.test("kalitlar: yangi JSON ko'rinishi, keyin eski kalit", () => {
  withEnv({ SUPABASE_SECRET_KEYS: '{"default":"sb_secret_a"}', SUPABASE_SERVICE_ROLE_KEY: 'legacy' }, () => {
    assertEquals(serviceKey(), 'sb_secret_a')
  })
  withEnv({ SUPABASE_SECRET_KEYS: '{"ci":"sb_secret_b"}', SUPABASE_SERVICE_ROLE_KEY: undefined }, () => {
    assertEquals(serviceKey(), 'sb_secret_b')
  })
  withEnv({ SUPABASE_SECRET_KEYS: undefined, SUPABASE_SERVICE_ROLE_KEY: 'legacy' }, () => {
    assertEquals(serviceKey(), 'legacy')
  })
  withEnv({ SUPABASE_PUBLISHABLE_KEYS: '{"default":"sb_publishable_x"}' }, () => {
    assertEquals(publishableKey(), 'sb_publishable_x')
  })
  withEnv({ SUPABASE_SECRET_KEYS: undefined, SUPABASE_SERVICE_ROLE_KEY: undefined }, () => {
    assertThrows(() => serviceKey(), ConfigError)
  })
})
