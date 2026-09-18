// E11-T08: kurslar (CBU), chek fayllarini tozalash, akkauntni o'chirish.
import { assertEquals, assertRejects, assertThrows } from '@std/assert'
import { parseCbu } from '../fx-sync/cbu.ts'
import { purgeFiles } from '../purge-files/purge.ts'
import { bearerToken, deleteAccount } from '../delete-account/account.ts'
import { RpcError } from '../_shared/supabase.ts'

Deno.test('CBU: kurs / nominal, sana ISO, yaroqsizlar tashlanadi', () => {
  const rates = parseCbu([
    { Ccy: 'USD', Rate: '12650.55', Nominal: '1', Date: '18.09.2026' },
    { Ccy: 'IRR', Rate: '3.01', Nominal: '10', Date: '18.09.2026' },
    { Ccy: 'usd', Rate: '1', Nominal: '1', Date: '18.09.2026' },
    { Ccy: 'EUR', Rate: '-1', Nominal: '1', Date: '18.09.2026' },
    { Ccy: 'RUB', Rate: '150.1', Nominal: '1', Date: '2026-09-18' },
    null,
  ])
  assertEquals(rates, [
    { currency: 'USD', rate_date: '2026-09-18', rate_to_base: 12650.55 },
    { currency: 'IRR', rate_date: '2026-09-18', rate_to_base: 0.301 },
  ])
})

Deno.test('CBU: kutilmagan javob — xato', () => {
  assertThrows(() => parseCbu({ error: 'x' }), Error, 'massiv')
  assertThrows(() => parseCbu([{ Ccy: 'USD' }]), Error, "yaroqli kurs yo'q")
})

Deno.test("purge-files: paketlab o'chiradi, o'chmasa to'xtaydi", async () => {
  const pending = Array.from({ length: 5 }, (_, i) => `h/t/${i}.jpg`)
  const removed: string[][] = []
  const summary = await purgeFiles(
    {
      list: (limit) => Promise.resolve(pending.slice(0, limit)),
      remove: (paths) => {
        removed.push(paths)
        pending.splice(0, paths.length)
        return Promise.resolve(paths.length)
      },
    },
    { batchSize: 2, budgetMs: 10_000 },
  )
  assertEquals(summary, { deleted: 5, batches: 3 })
  assertEquals(removed.at(-1), ['h/t/4.jpg'])

  let calls = 0
  const stuck = await purgeFiles(
    { list: () => Promise.resolve(['a', 'b']), remove: () => Promise.resolve(calls++ * 0) },
    { batchSize: 2, budgetMs: 10_000 },
  )
  assertEquals([stuck, calls], [{ deleted: 0, batches: 1 }, 1])
})

Deno.test('delete-account: Bearer token', () => {
  assertEquals(bearerToken('Bearer abc.def'), 'abc.def')
  assertEquals(bearerToken('bearer abc'), 'abc')
  assertEquals(bearerToken('Basic abc'), null)
  assertEquals(bearerToken(null), null)
})

Deno.test("delete-account: JWT yo'q/yaroqsiz — 401, hech narsa o'chmaydi", async () => {
  const steps: string[] = []
  const deps = {
    userId: () => Promise.resolve(null),
    prepare: () => {
      steps.push('prepare')
      return Promise.resolve({ deleted_households: [] })
    },
    deleteUser: () => {
      steps.push('delete')
      return Promise.resolve()
    },
  }
  assertEquals((await deleteAccount(null, deps)).status, 401)
  assertEquals((await deleteAccount('Bearer bad', deps)).status, 401)
  assertEquals(steps, [])
})

Deno.test('delete-account: oxirgi owner — 409, auth foydalanuvchisi qoladi', async () => {
  const steps: string[] = []
  const result = await deleteAccount('Bearer jwt', {
    userId: () => Promise.resolve('u1'),
    prepare: () => Promise.reject(new RpcError(400, 'P0001', 'last_owner')),
    deleteUser: () => {
      steps.push('delete')
      return Promise.resolve()
    },
  })
  assertEquals(result, { status: 409, body: { error: 'last_owner' } })
  assertEquals(steps, [])
})

Deno.test('delete-account: tartib — byudjetlar, keyin auth; boshqa xato yuqoriga', async () => {
  const steps: string[] = []
  const result = await deleteAccount('Bearer jwt', {
    userId: (jwt) => Promise.resolve(jwt === 'jwt' ? 'u1' : null),
    prepare: () => {
      steps.push('prepare')
      return Promise.resolve({ deleted_households: ['h1', 'h2'] })
    },
    deleteUser: (id) => {
      steps.push(`delete:${id}`)
      return Promise.resolve()
    },
  })
  assertEquals(result, { status: 200, body: { deleted_households: 2 } })
  assertEquals(steps, ['prepare', 'delete:u1'])

  await assertRejects(() =>
    deleteAccount('Bearer jwt', {
      userId: () => Promise.resolve('u1'),
      prepare: () => Promise.reject(new RpcError(500, '500', 'boom')),
      deleteUser: () => Promise.resolve(),
    }), RpcError)
})
