// E11-T05: bot buyruqlari (BR-163, BR-221).
import { assertEquals, assertStringIncludes } from '@std/assert'
import {
  type BotDeps,
  handleUpdate,
  parseCommand,
  parseMonthArgument,
  type Summary,
} from '../telegram-webhook/handler.ts'
import { type CardEntry, type CardTemplate, normalizeCardDate, parseCardMessage } from '../telegram-webhook/card.ts'
import { parseQuickEntry } from '../telegram-webhook/parse.ts'

// Pul formatida guruhlar va qo'shimcha orasida bo'linmas bo'shliq.
const som = (amount: string) => `${amount.replaceAll(' ', '\u00a0')}\u00a0so'm`

/** E31-T02: bank xabarnomasi shablonlari (anonimlashtirilgan namunalar). */
const TEMPLATE: CardTemplate = {
  id: 'tpl-1',
  bank: 'Kapitalbank',
  pattern:
    'Xarajat:\\s*(?<amount>[0-9 .,]+)\\s*UZS\\n(?<payee>.+)\\nKarta:\\s*\\*(?<card>[0-9]{4})\\n(?<date>[0-9./-]{8,10})',
  kind: 'expense' as const,
  amount_unit: 'major' as const,
  currency: 'UZS',
}

const TEMPLATES: CardTemplate[] = [
  TEMPLATE,
  {
    id: 'tpl-2',
    bank: 'Uzcard',
    // Bitta qatorli SMS: karta, summa, sana va joy nuqtali vergul bilan.
    pattern:
      'UZCARD[^;]*?(?<card>[0-9]{4});\\s*Pokupka:\\s*(?<amount>[0-9 .,]+)\\s*UZS;\\s*(?<date>[0-9./]{8,10});\\s*(?<payee>.+)',
    kind: 'expense',
    amount_unit: 'major',
    currency: 'UZS',
  },
  {
    id: 'tpl-3',
    bank: 'Humo',
    pattern:
      'HUMO\\s*[0-9]{4}\\*+(?<card>[0-9]{4})\\nPostuplenie:\\s*(?<amount>[0-9 .,]+)\\s*UZS\\n(?<date>[0-9.]{8,10})\\n(?<payee>.+)',
    kind: 'income',
    amount_unit: 'major',
    currency: 'UZS',
  },
  {
    id: 'tpl-4',
    bank: 'Uzum',
    // Summa tiyinda keladigan xabar (amount_unit = minor).
    pattern:
      'UZUM:\\s*amount=(?<amount>[0-9]+);\\s*card=\\*+(?<card>[0-9]{4});\\s*merchant=(?<payee>[^;]+);\\s*date=(?<date>[0-9-]{10})',
    kind: 'expense',
    amount_unit: 'minor',
    currency: 'UZS',
  },
]

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
    quickAdd: (chatId, entry) => {
      const extra = entry.occurredOn || entry.cardLast4 ? `:${entry.occurredOn ?? ''}:${entry.cardLast4 ?? ''}` : ''
      calls.push(`quickAdd:${chatId}:${entry.kind}:${String(entry.amount)}:${entry.payee}${extra}`)
      return Promise.resolve({
        ok: true,
        locale: 'uz',
        transaction_id: 't-1',
        amount: entry.amount,
        payee: entry.payee,
        kind: entry.kind,
        category: 'Transport',
        account: 'Karta',
        occurred_on: '2026-10-05',
      })
    },
    categories: (chatId) => {
      calls.push(`categories:${chatId}`)
      return Promise.resolve({
        ok: true,
        categories: [{ id: 'c-1', name: 'Oziq-ovqat' }, { id: 'c-2', name: 'Transport' }],
      })
    },
    setCategory: (chatId, transaction, category) => {
      calls.push(`setCategory:${chatId}:${transaction}:${category}`)
      return Promise.resolve({ ok: true, category: 'Oziq-ovqat', locale: 'uz' })
    },
    undo: (chatId, transaction) => {
      calls.push(`undo:${chatId}:${transaction}`)
      return Promise.resolve({ ok: true, locale: 'uz' })
    },
    cardTemplates: () => {
      calls.push('cardTemplates')
      return Promise.resolve([TEMPLATE])
    },
    report: (chatId, month) => {
      calls.push(`report:${chatId}:${month ?? ''}`)
      return Promise.resolve({
        ok: true,
        locale: 'uz',
        household: 'Uy',
        month: month ?? '2026-10-01',
        income: 12_000_000_00,
        expense: 4_500_000_00,
        balance: 7_500_000_00,
        saved: 8_000_000_00,
        unpaid: 0,
      })
    },
    setLocale: (chatId, locale) => {
      calls.push(`setLocale:${chatId}:${locale}`)
      return locale === 'ru' || locale === 'uz' || locale === 'en'
        ? Promise.resolve({ ok: true, locale })
        : Promise.resolve({ ok: false, code: 'invalid_locale' })
    },
    ...overrides,
  }
}

const update = (text: string, type = 'private', language_code = 'uz') => ({
  message: { chat: { id: 42, type }, text, from: { language_code } },
})

/** BR-222: bank botidan forward qilingan xabar. */
const forwarded = (text: string) => ({
  message: { ...update(text).message, forward_date: 1_790_000_000 },
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

// ─── E31-T01: tez kiritish (BR-220) ─────────────────────────────────────────

const CASES: [string, 'income' | 'expense', number, string][] = [
  ['taksi 20000', 'expense', 20_000_00, 'taksi'],
  ['20000 taksi', 'expense', 20_000_00, 'taksi'],
  ['+5 000 000 oylik', 'income', 5_000_000_00, 'oylik'],
  ['kofe 25k', 'expense', 25_000_00, 'kofe'],
  ['12,5k non', 'expense', 12_500_00, 'non'],
  ['korzinka 150 000', 'expense', 150_000_00, 'korzinka'],
  ['Яндекс Go 18000', 'expense', 18_000_00, 'Яндекс Go'],
  ['+250000', 'income', 250_000_00, ''],
  ['obed 35 000 ishxonada', 'expense', 35_000_00, 'obed ishxonada'],
  ['1 200 000 ijara', 'expense', 1_200_000_00, 'ijara'],
  ['benzin 90 ming', 'expense', 90_000_00, 'benzin'],
  ['150ming dori', 'expense', 150_000_00, 'dori'],
  ['такси 25 тыс', 'expense', 25_000_00, 'такси'],
  ['продукты 320000', 'expense', 320_000_00, 'продукты'],
  ['+430 000 ijaradan', 'income', 430_000_00, 'ijaradan'],
  ["Bolalar bog'chasi 450000", 'expense', 450_000_00, "Bolalar bog'chasi"],
  ['kommunal 187 500', 'expense', 187_500_00, 'kommunal'],
  ['internet 99000 uzonline', 'expense', 99_000_00, 'internet uzonline'],
  ['apteka 63.50', 'expense', 63_50, 'apteka'],
  ['+300k qarz qaytdi', 'income', 300_000_00, 'qarz qaytdi'],
  ['Makro 1 249 300', 'expense', 1_249_300_00, 'Makro'],
  ['7000 marshrutka', 'expense', 7_000_00, 'marshrutka'],
  ['tushlik 45 min', 'expense', 45_000_00, 'tushlik'],
  ['+12 000 000 bonus', 'income', 12_000_000_00, 'bonus'],
]

Deno.test('tez kiritish: summa, ishora va nom', async (t) => {
  for (const [text, kind, amount, payee] of CASES) {
    await t.step(text, () => {
      assertEquals(parseQuickEntry(text), { kind, amount, payee })
    })
  }
})

Deno.test('tez kiritish: summa yo‘q — tahlil qilinmaydi', () => {
  for (const text of ['salom', 'taksi', '0 nol', 'abc def', '-500 qaytim']) {
    const parsed = parseQuickEntry(text)
    if (text === '-500 qaytim') {
      // Manfiy ishora ham xarajat (ishora faqat `+` da daromad).
      assertEquals(parsed, { kind: 'expense', amount: 500_00, payee: 'qaytim' })
    } else {
      assertEquals(parsed, null)
    }
  }
})

Deno.test('matndan amal yoziladi va tugmalar beriladi', async () => {
  const d = deps()
  const reply = await handleUpdate(update('taksi 20000'), d)
  assertEquals(d.calls, ['quickAdd:42:expense:2000000:taksi'])
  assertEquals(reply?.method, 'sendMessage')
  assertStringIncludes(reply?.text ?? '', som('20 000'))
  assertStringIncludes(reply?.text ?? '', 'Transport')
  const keyboard = reply?.reply_markup?.inline_keyboard ?? []
  assertEquals(keyboard[0]?.map((b) => b.callback_data), ['cat:t-1', 'del:t-1'])
})

Deno.test('yozib bo‘lmasa — sabab matni, tugmasiz', async () => {
  const d = deps({
    quickAdd: () => Promise.resolve({ ok: false, code: 'month_closed', locale: 'uz' }),
  })
  const reply = await handleUpdate(update('taksi 20000'), d)
  assertStringIncludes(reply?.text ?? '', 'yopilgan')
  assertEquals(reply?.reply_markup, undefined)
})

const callback = (data: string) => ({
  callback_query: {
    id: 'q1',
    data,
    from: { language_code: 'uz' },
    message: { chat: { id: 42, type: 'private' }, message_id: 7 },
  },
})

Deno.test('tugmalar: kategoriya ro‘yxati, tanlash va bekor qilish', async () => {
  const d = deps()
  const list = await handleUpdate(callback('cat:t-1'), d)
  assertEquals(list?.method, 'editMessageText')
  assertEquals(
    list?.reply_markup?.inline_keyboard.map((row) => row[0]?.callback_data),
    ['set:t-1:c-1', 'set:t-1:c-2'],
  )

  const chosen = await handleUpdate(callback('set:t-1:c-1'), d)
  assertStringIncludes(chosen?.text ?? '', 'Oziq-ovqat')

  const undone = await handleUpdate(callback('del:t-1'), d)
  assertStringIncludes(undone?.text ?? '', 'Bekor qilindi')
  assertEquals(d.calls.includes('undo:42:t-1'), true)
})

Deno.test('guruh chatidagi tugma — javobsiz', async () => {
  const query = callback('del:t-1')
  query.callback_query.message.chat.type = 'group'
  assertEquals(await handleUpdate(query, deps()), null)
})

// ─── E31-T02: karta xabarnomasi (BR-222) ────────────────────────────────────

const CARD_MESSAGE = ['Xarajat: 250 000 UZS', 'KORZINKA TASHKENT', 'Karta: *1234', '12.10.2026'].join('\n')

Deno.test('karta xabarnomasi: shablon bo‘yicha summa, joy, karta va sana', async () => {
  const d = deps()
  const reply = await handleUpdate(update(CARD_MESSAGE), d)
  assertEquals(d.calls[0], 'cardTemplates')
  assertEquals(
    d.calls[1],
    'quickAdd:42:expense:25000000:KORZINKA TASHKENT:2026-10-12:1234',
  )
  assertStringIncludes(reply?.text ?? '', som('250 000'))
})

// E31-T04: turli banklarning anonimlashtirilgan xabarlari.
const CARD_CASES: [string, string, CardEntry][] = [
  [
    'Kapitalbank — xarajat',
    CARD_MESSAGE,
    {
      bank: 'Kapitalbank',
      kind: 'expense',
      amount: 250_000_00,
      payee: 'KORZINKA TASHKENT',
      date: '2026-10-12',
      card: '1234',
    },
  ],
  [
    'Kapitalbank — kasrli summa',
    ['Xarajat: 45 300,50 UZS', 'APTEKA OXY', 'Karta: *1234', '03.11.2026'].join('\n'),
    {
      bank: 'Kapitalbank',
      kind: 'expense',
      amount: 45_300_50,
      payee: 'APTEKA OXY',
      date: '2026-11-03',
      card: '1234',
    },
  ],
  [
    'Uzcard — bitta qatorli SMS',
    'UZCARD: 8600****4455; Pokupka: 45 000.00 UZS; 05/09/26; MAKRO SUPERMARKET',
    {
      bank: 'Uzcard',
      kind: 'expense',
      amount: 45_000_00,
      payee: 'MAKRO SUPERMARKET',
      date: '2026-09-05',
      card: '4455',
    },
  ],
  [
    'Humo — tushum (daromad)',
    ['HUMO 9860****4455', 'Postuplenie: 5 000 000.00 UZS', '01.10.2026', 'ZARPLATA'].join('\n'),
    {
      bank: 'Humo',
      kind: 'income',
      amount: 5_000_000_00,
      payee: 'ZARPLATA',
      date: '2026-10-01',
      card: '4455',
    },
  ],
  [
    'Uzum — summa tiyinda',
    'UZUM: amount=4500000; card=****4455; merchant=KORZINKA; date=2026-10-12',
    {
      bank: 'Uzum',
      kind: 'expense',
      amount: 45_000_00,
      payee: 'KORZINKA',
      date: '2026-10-12',
      card: '4455',
    },
  ],
]

Deno.test('karta xabarnomalari: shablonlar jadvali', async (t) => {
  for (const [name, text, expected] of CARD_CASES) {
    await t.step(name, () => {
      assertEquals(parseCardMessage(text, TEMPLATES), expected)
    })
  }
})

Deno.test('karta xabarnomasi: mos kelmaydigan matnlar', () => {
  for (
    const text of [
      'Xarajat: 0 UZS\nKORZINKA\nKarta: *1234\n12.10.2026', // summa 0
      'UZCARD: 8600****4455; Vozvrat: 45 000.00 UZS; 05/09/26; MAKRO', // boshqa amal
      'Hisobingizga kirish amalga oshirildi', // xabarnoma emas
    ]
  ) {
    assertEquals(parseCardMessage(text, TEMPLATES), null)
  }
})

Deno.test('buzuq naqsh — xato bermaydi, keyingi shablon ishlaydi', () => {
  const broken: CardTemplate = { ...TEMPLATE, id: 'tpl-0', pattern: '(?<amount>[0-9' }
  assertEquals(parseCardMessage(CARD_MESSAGE, [broken, ...TEMPLATES])?.amount, 250_000_00)
})

Deno.test('forward qilingan bitta qatorli SMS — shablonlar bo‘yicha', async () => {
  const d = deps({ cardTemplates: () => Promise.resolve(TEMPLATES) })
  const text = 'UZCARD: 8600****4455; Pokupka: 45 000.00 UZS; 05/09/26; MAKRO SUPERMARKET'
  const reply = await handleUpdate(forwarded(text), d)
  assertEquals(d.calls[0], 'quickAdd:42:expense:4500000:MAKRO SUPERMARKET:2026-09-05:4455')
  assertStringIncludes(reply?.text ?? '', som('45 000'))
})

Deno.test('mos shablon yo‘q — tushunarli javob', async () => {
  const d = deps({ cardTemplates: () => Promise.resolve([]) })
  const reply = await handleUpdate(update('Bank xabari\nTushunarsiz matn'), d)
  assertStringIncludes(reply?.text ?? '', 'shablon topilmadi')
})

Deno.test('karta sanasi: turli ko‘rinishlar', () => {
  assertEquals(normalizeCardDate('12.10.2026'), '2026-10-12')
  assertEquals(normalizeCardDate('05/09/26'), '2026-09-05')
  assertEquals(normalizeCardDate('2026-10-12 18:30'), '2026-10-12')
  assertEquals(normalizeCardDate('bugun'), null)
  assertEquals(normalizeCardDate(undefined), null)
})

// ─── E31-T03: /hisobot va /til (BR-221) ─────────────────────────────────────

Deno.test('/hisobot: oy argumenti va yakun', async () => {
  assertEquals(parseMonthArgument('2026-09'), '2026-09-01')
  assertEquals(parseMonthArgument('09.2026'), '2026-09-01')
  assertEquals(parseMonthArgument('kecha'), null)

  const d = deps()
  const reply = await handleUpdate(update('/hisobot 2026-09'), d)
  assertEquals(d.calls, ['report:42:2026-09-01'])
  assertStringIncludes(reply?.text ?? '', som('7 500 000'))
})

Deno.test('/til: tilni o‘zgartiradi, noto‘g‘ri qiymatda yo‘riqnoma', async () => {
  const d = deps()
  const ok = await handleUpdate(update('/til ru'), d)
  assertEquals(d.calls, ['setLocale:42:ru'])
  assertStringIncludes(ok?.text ?? '', 'Язык изменён')

  const bad = await handleUpdate(update('/til fr'), deps())
  assertStringIncludes(bad?.text ?? '', '/til uz | ru | en')
})
