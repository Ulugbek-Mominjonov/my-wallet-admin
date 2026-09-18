// E11-T05: bot buyruqlari (BR-163, BR-221).
import { assertEquals, assertStringIncludes } from '@std/assert'
import { type BotDeps, handleUpdate, parseCommand, type Summary } from '../telegram-webhook/handler.ts'

// Pul formatida guruhlar va qo'shimcha orasida bo'linmas bo'shliq.
const som = (amount: string) => `${amount.replaceAll(' ', '\u00a0')}\u00a0so'm`

const SUMMARY: Summary = {
  locale: 'uz',
  household: 'Uy <oila>',
  month: '2026-10-01',
  income: 12_000_000_00,
  expense: 4_500_000_00,
  balance: 7_500_000_00,
  forecast: 5_000_000_00,
  today: [
    { name: 'Internet', amount: 150_000_00, due_date: '2026-10-03' },
    { name: 'Elektr', amount: null, due_date: '2026-10-05' },
  ],
}

function deps(overrides: Partial<BotDeps> = {}): BotDeps & { calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    consume: (token, chatId) => {
      calls.push(`consume:${token}:${chatId}`)
      return Promise.resolve({ ok: true, locale: 'ru' })
    },
    unlink: (chatId) => {
      calls.push(`unlink:${chatId}`)
      return Promise.resolve(true)
    },
    summary: () => Promise.resolve(SUMMARY),
    ...overrides,
  }
}

const update = (text: string, type = 'private', language_code = 'uz') => ({
  message: { chat: { id: 42, type }, text, from: { language_code } },
})

Deno.test('parseCommand: bot nomi va argument', () => {
  assertEquals(parseCommand('/start@MyWalletUzBot abc_123'), ['start', 'abc_123'])
  assertEquals(parseCommand('  /BALANS  '), ['balans', ''])
})

Deno.test('/start <token>: ulash, javob foydalanuvchi tilida', async () => {
  const bot = deps()
  const reply = await handleUpdate(update('/start tok'), bot)
  assertEquals(bot.calls, ['consume:tok:42'])
  assertEquals([reply?.method, reply?.chat_id, reply?.parse_mode], ['sendMessage', 42, 'HTML'])
  assertStringIncludes(reply!.text, 'My Wallet подключён')
})

Deno.test("/start: ishlatilgan va muddati o'tgan token", async () => {
  const used = await handleUpdate(
    update('/start tok'),
    deps({ consume: () => Promise.resolve({ ok: false, code: 'token_used', locale: null }) }),
  )
  assertStringIncludes(used!.text, 'allaqachon ishlatilgan')
  const expired = await handleUpdate(
    update('/start tok', 'private', 'en'),
    deps({ consume: () => Promise.resolve({ ok: false, code: 'token_expired', locale: null }) }),
  )
  assertStringIncludes(expired!.text, 'expired')
})

Deno.test('/stop — uzadi', async () => {
  const bot = deps()
  const reply = await handleUpdate(update('/stop'), bot)
  assertEquals(bot.calls, ['unlink:42'])
  assertStringIncludes(reply!.text, 'Bot uzildi')
})

Deno.test('/balans: qoldiq va prognoz (HTML escape bilan)', async () => {
  const reply = await handleUpdate(update('/balans'), deps())
  assertEquals(
    reply!.text,
    [
      '<b>💰 Uy &lt;oila&gt; — Oktabr 2026</b>',
      `Daromad: ${som('12 000 000')}`,
      `Xarajat: ${som('4 500 000')}`,
      `Qoldiq: ${som('7 500 000')}`,
      `Prognoz: ${som('5 000 000')}`,
    ].join('\n'),
  )
})

Deno.test("/bugun: ro'yxat, noma'lum summa, bo'sh holat", async () => {
  const reply = await handleUpdate(update('/bugun'), deps())
  assertStringIncludes(reply!.text, `• Internet — ${som('150 000')} (03.10)`)
  assertStringIncludes(reply!.text, "• Elektr — summa o'zgaruvchi (05.10)")
  const empty = await handleUpdate(
    update('/bugun'),
    deps({ summary: () => Promise.resolve({ ...SUMMARY, today: [] }) }),
  )
  assertEquals(empty!.text, "Bugun to'lov yo'q ✅")
})

Deno.test("ulanmagan chat — ulash yo'riqnomasi", async () => {
  const reply = await handleUpdate(update('/balans', 'private', 'ru'), deps({ summary: () => Promise.resolve(null) }))
  assertStringIncludes(reply!.text, 'Сначала подключите')
})

Deno.test("noma'lum matn — yordam; guruh chati va matnsiz xabar — javobsiz", async () => {
  const help = await handleUpdate(update('salom'), deps())
  assertStringIncludes(help!.text, '/balans')
  const bot = deps()
  assertEquals(await handleUpdate(update('/start tok', 'group'), bot), null)
  assertEquals(bot.calls, [])
  assertEquals(await handleUpdate({ message: { chat: { id: 1, type: 'private' } } }, bot), null)
  assertEquals(await handleUpdate({}, bot), null)
})
