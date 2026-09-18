// E11-T06: xabar shablonlari — har tur × har til snapshot (o'zgarish PR'da
// ko'rinadi). Yangilash: `make fn-snapshots`.
import { assert, assertEquals } from '@std/assert'
import { assertSnapshot } from '@std/testing/snapshot'
import { escapeHtml, type MessageType, PUSH_BODY_MAX, render, toPush, toTelegramHtml } from '../_shared/i18n.ts'
import { LOCALES } from '../_shared/money.ts'

const NBSP = '\u00a0'

// SQL (20260918200200_enqueue.sql) yaratadigan payload ko'rinishlari.
const PAYLOADS: Record<MessageType, Record<string, unknown>> = {
  daily_reminder: {
    date: '2026-10-05',
    overdue: [{ name: 'Internet', amount: 150_000_00, due_date: '2026-10-03', kind: 'expense' }],
    today: [{ name: 'Elektr', amount: null, due_date: '2026-10-05', kind: 'expense' }],
    upcoming: [{ name: 'Kredit <Hamkor>', amount: 2_500_000_00, due_date: '2026-10-07', kind: 'debt_payment' }],
    balance: 3_450_000_00,
  },
  monthly_report: {
    month: '2026-09-01',
    income: 12_000_000_00,
    expense: 9_150_000_00,
    balance: 2_850_000_00,
    saved: 3_250_000_00,
    saved_ratio: 0.2708,
    fund_balance: 820_000_00,
    savings_total: 14_300_000_00,
    debts_remaining: 18_000_000_00,
    top_categories: [
      { name: 'Oziq-ovqat', actual: 3_100_000_00 },
      { name: 'Transport', actual: 950_000_00 },
    ],
    limits_exceeded: [{ name: 'Kafe', actual: 1_200_000_00, limit: 800_000_00 }],
    suspicious: true,
  },
  limit_alert: { category: 'Kafe', limit: 800_000_00, actual: 656_000_00, threshold: 80, month: '2026-10-01' },
  income_missing: { name: 'Oylik', amount: 10_000_000_00, due_date: '2026-10-05' },
  test: {},
}

for (const type of Object.keys(PAYLOADS) as MessageType[]) {
  for (const locale of LOCALES) {
    Deno.test(`${type} — ${locale}`, async (t) => {
      const rendered = render(type, PAYLOADS[type], locale)
      await assertSnapshot(t, { push: toPush(rendered), telegram: toTelegramHtml(rendered) })
    })
  }
}

Deno.test("kunlik eslatma: bo'sh bo'limlar chiqmaydi", () => {
  const rendered = render('daily_reminder', {
    overdue: [],
    today: [],
    upcoming: [{ name: 'Suv', amount: 50_000_00, due_date: '2026-10-07' }],
  }, 'uz')
  assertEquals(rendered.lines, ['🗓 Yaqin kunlarda:', `• Suv — 50${NBSP}000${NBSP}so'm (07.10)`])
})

Deno.test('limit: 100% — oshdi matni', () => {
  const rendered = render('limit_alert', { ...PAYLOADS.limit_alert, threshold: 100, actual: 900_000_00 }, 'uz')
  assertEquals(rendered.lines[0], '🔴 Kafe: limitdan oshdi')
})

Deno.test("oylik hisobot: qarz 0 bo'lsa qator yo'q, shubhali bo'lmasa ogohlantirish yo'q", () => {
  const rendered = render('monthly_report', { ...PAYLOADS.monthly_report, debts_remaining: 0, suspicious: false }, 'uz')
  assert(!rendered.lines.some((line) => line.includes('qarz')))
  assert(!rendered.lines.some((line) => line.includes('Diqqat')))
})

Deno.test("push: bo'sh qatorlarsiz va chegaradan qisqa", () => {
  const long = { title: 'x', lines: ['', 'a'.repeat(PUSH_BODY_MAX * 2)] }
  const push = toPush(long)
  assertEquals(push.body.length, PUSH_BODY_MAX)
  assert(push.body.endsWith('…'))
})

Deno.test('Telegram HTML: foydalanuvchi matni escape qilinadi', () => {
  assertEquals(escapeHtml('<b>&</b>'), '&lt;b&gt;&amp;&lt;/b&gt;')
  const html = toTelegramHtml({ title: 'A & B', lines: ['<script>'] })
  assertEquals(html, '<b>A &amp; B</b>\n&lt;script&gt;')
})
