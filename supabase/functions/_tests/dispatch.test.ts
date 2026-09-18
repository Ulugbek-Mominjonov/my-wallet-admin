// E11-T04: navbatni yuborish — kanal va natija qoidalari.
import { assertEquals } from '@std/assert'
import { dispatch, type DispatchDeps, type OutboxMessage, type SendResult } from '../notify-dispatch/dispatch.ts'
import type { PushOutcome } from '../_shared/fcm.ts'

const message = (id: number, channel: OutboxMessage['channel'], extra: Partial<OutboxMessage> = {}): OutboxMessage => ({
  id,
  channel,
  type: 'test',
  payload: {},
  locale: 'uz',
  ...extra,
})

function harness(batches: OutboxMessage[][], overrides: Partial<DispatchDeps> = {}) {
  const completed: { results: SendResult[]; stale: string[] }[] = []
  const deps: DispatchDeps = {
    claim: () => Promise.resolve(batches.shift() ?? []),
    complete: (results, stale) => {
      completed.push({ results, stale })
      return Promise.resolve()
    },
    ...overrides,
  }
  return { deps, completed }
}

const OPTIONS = { batchSize: 10, concurrency: 3, budgetMs: 10_000 }

Deno.test("push: bitta qurilmaga yetsa — sent; eskirgan tokenlar yig'iladi", async () => {
  const outcomes: Record<string, PushOutcome> = {
    a: { kind: 'stale' },
    b: { kind: 'sent' },
    c: { kind: 'error', retry: true, error: 'FCM 503' },
  }
  const { deps, completed } = harness([[message(1, 'push', { tokens: ['a', 'b', 'c'] })]], {
    push: (token) => Promise.resolve(outcomes[token]),
  })
  const summary = await dispatch(deps, OPTIONS)
  assertEquals(summary, { processed: 1, sent: 1, failed: 0, skipped: 0 })
  assertEquals(completed[0], { results: [{ id: 1, status: 'sent' }], stale: ['a'] })
})

Deno.test('push: hamma qurilma xato — failed, retry xatolardan', async () => {
  const { deps, completed } = harness(
    [[message(1, 'push', { tokens: ['a'] }), message(2, 'push', { tokens: ['b'] })]],
    {
      push: (token) =>
        Promise.resolve<PushOutcome>(
          token === 'a'
            ? { kind: 'error', retry: true, error: 'FCM 503' }
            : { kind: 'error', retry: false, error: 'FCM 400' },
        ),
    },
  )
  await dispatch(deps, OPTIONS)
  assertEquals(completed[0].results, [
    { id: 1, status: 'failed', retry: true, error: 'FCM 503' },
    { id: 2, status: 'failed', retry: false, error: 'FCM 400' },
  ])
})

Deno.test("o'tkazib yuborish sabablari aniq (BR-164)", async () => {
  const { deps, completed } = harness([[
    message(1, 'push', { tokens: [] }),
    message(2, 'push', { tokens: ['x'] }),
    message(3, 'telegram', { chat_id: null }),
    message(4, 'email', { email: 'a@b.c' }),
  ]], {
    push: () => Promise.resolve<PushOutcome>({ kind: 'stale' }),
    telegram: () => Promise.resolve({ kind: 'sent' }),
  })
  const summary = await dispatch(deps, OPTIONS)
  assertEquals(summary.skipped, 4)
  assertEquals(completed[0].results.map((r) => r.error), [
    'no_device',
    'no_valid_device',
    'not_linked',
    'email_not_supported',
  ])
  assertEquals(completed[0].stale, ['x'])
})

Deno.test('kanal sozlanmagan — skipped', async () => {
  const { deps, completed } = harness([[message(1, 'push', { tokens: ['a'] }), message(2, 'telegram', { chat_id: 7 })]])
  await dispatch(deps, OPTIONS)
  assertEquals(completed[0].results.map((r) => r.error), ['push_not_configured', 'telegram_not_configured'])
})

Deno.test('Telegram: HTML matn va natija', async () => {
  const sent: [number, string][] = []
  const { deps, completed } = harness([[message(1, 'telegram', { chat_id: 42 })]], {
    telegram: (chatId, html) => {
      sent.push([chatId, html])
      return Promise.resolve({ kind: 'error', retry: true, error: 'Telegram 429' })
    },
  })
  await dispatch(deps, OPTIONS)
  assertEquals(sent, [[42, '<b>✅ My Wallet</b>\nTest xabar — bildirishnomalar ishlayapti.']])
  assertEquals(completed[0].results, [{ id: 1, status: 'failed', retry: true, error: 'Telegram 429' }])
})

Deno.test('kutilmagan xato — failed (retry), qolganlar davom etadi', async () => {
  const { deps, completed } = harness([[
    message(1, 'telegram', { chat_id: 1 }),
    message(2, 'telegram', { chat_id: 2 }),
  ]], {
    telegram: (chatId) => chatId === 1 ? Promise.reject(new Error('network')) : Promise.resolve({ kind: 'sent' }),
  })
  await dispatch(deps, OPTIONS)
  assertEquals(completed[0].results, [
    { id: 1, status: 'failed', retry: true, error: 'network' },
    { id: 2, status: 'sent' },
  ])
})

Deno.test("to'la paketdan keyin yana oladi, vaqt tugasa to'xtaydi", async () => {
  const full = Array.from({ length: 2 }, (_, i) => message(i + 1, 'telegram', { chat_id: i + 1 }))
  const { deps, completed } = harness([full, [message(3, 'telegram', { chat_id: 3 })], [
    message(4, 'telegram', { chat_id: 4 }),
  ]], {
    telegram: () => Promise.resolve({ kind: 'sent' }),
  })
  const summary = await dispatch(deps, { ...OPTIONS, batchSize: 2 })
  // 2 ta (to'la) → yana; 1 ta (to'la emas) → to'xtaydi; 4-xabar keyingi ishga qoladi.
  assertEquals(summary, { processed: 3, sent: 3, failed: 0, skipped: 0 })
  assertEquals(completed.length, 2)

  let clock = 0
  const timed = harness([[message(9, 'telegram', { chat_id: 9 })]], {
    telegram: () => {
      clock += 1_000
      return Promise.resolve({ kind: 'sent' })
    },
  })
  const stopped = await dispatch(timed.deps, { batchSize: 1, concurrency: 1, budgetMs: 500, now: () => clock })
  assertEquals(stopped.processed, 1)
})
