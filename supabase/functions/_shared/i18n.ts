// E11-T06: bildirishnoma matnlari (uz/ru/en). Bitta xabar → sarlavha + qatorlar;
// kanal formatlari: push — oddiy matn, Telegram — HTML (escape bilan).
// Qoidalar: BR-160 (kunlik eslatma), BR-161/162 (oylik hisobot), BR-133
// (limit), BR-165 (kechikkan daromad), BR-164 (test).
import { formatMoney, type Locale } from './money.ts'

export type MessageType = 'daily_reminder' | 'monthly_report' | 'limit_alert' | 'income_missing' | 'test'

export interface Rendered {
  title: string
  lines: string[]
}

interface PlanLine {
  name: string
  amount: number | null
  due_date: string
}

const MONTHS: Readonly<Record<Locale, readonly string[]>> = {
  uz: ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'],
  ru: [
    'Январь',
    'Февраль',
    'Март',
    'Апрель',
    'Май',
    'Июнь',
    'Июль',
    'Август',
    'Сентябрь',
    'Октябрь',
    'Ноябрь',
    'Декабрь',
  ],
  en: [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ],
}

const TEXT = {
  uz: {
    reminderTitle: "💳 To'lovlar eslatmasi",
    overdue: "⚠️ Muddati o'tgan",
    today: '📌 Bugun',
    upcoming: '🗓 Yaqin kunlarda',
    variable: "summa o'zgaruvchi",
    balance: "💰 Joriy oy qoldig'i",
    reportTitle: (month: string) => `📊 ${month} hisoboti`,
    income: 'Daromad',
    expense: 'Xarajat',
    left: 'Qoldiq',
    saved: 'Orttirgan',
    fund: "👤 Shaxsiy fond qoldig'i",
    savings: "🏦 Jamg'arma",
    debts: '💳 Qolgan qarz',
    top: "Eng ko'p sarflanganlar",
    overLimit: '🔴 Limitdan oshganlar',
    suspicious: '⚠️ Diqqat: daromad odatdagidan ancha kam — barcha yozuvlar kiritilganini tekshiring',
    limitTitle: '🎯 Limit',
    limitNear: (name: string, pct: number) => `🟡 ${name}: limitning ${pct}% qismi ishlatildi`,
    limitOver: (name: string) => `🔴 ${name}: limitdan oshdi`,
    incomeMissingTitle: '💼 Daromad kutilmoqda',
    incomeMissing: (name: string, date: string) => `${name} hali kiritilmadi (kutilgan sana: ${date})`,
    testTitle: '✅ My Wallet',
    testBody: 'Test xabar — bildirishnomalar ishlayapti.',
  },
  ru: {
    reminderTitle: '💳 Напоминание о платежах',
    overdue: '⚠️ Просрочено',
    today: '📌 Сегодня',
    upcoming: '🗓 В ближайшие дни',
    variable: 'сумма меняется',
    balance: '💰 Остаток за месяц',
    reportTitle: (month: string) => `📊 Отчёт: ${month}`,
    income: 'Доход',
    expense: 'Расход',
    left: 'Остаток',
    saved: 'Накоплено',
    fund: '👤 Личный фонд',
    savings: '🏦 Сбережения',
    debts: '💳 Остаток долгов',
    top: 'Больше всего потрачено',
    overLimit: '🔴 Превышен лимит',
    suspicious: '⚠️ Внимание: доход заметно ниже обычного — проверьте, всё ли внесено',
    limitTitle: '🎯 Лимит',
    limitNear: (name: string, pct: number) => `🟡 ${name}: использовано ${pct}% лимита`,
    limitOver: (name: string) => `🔴 ${name}: лимит превышен`,
    incomeMissingTitle: '💼 Ожидается доход',
    incomeMissing: (name: string, date: string) => `${name} ещё не внесён (ожидался ${date})`,
    testTitle: '✅ My Wallet',
    testBody: 'Тестовое сообщение — уведомления работают.',
  },
  en: {
    reminderTitle: '💳 Payment reminder',
    overdue: '⚠️ Overdue',
    today: '📌 Today',
    upcoming: '🗓 Coming up',
    variable: 'amount varies',
    balance: "💰 This month's balance",
    reportTitle: (month: string) => `📊 ${month} report`,
    income: 'Income',
    expense: 'Expenses',
    left: 'Balance',
    saved: 'Saved',
    fund: '👤 Personal fund',
    savings: '🏦 Savings',
    debts: '💳 Debt left',
    top: 'Top spending',
    overLimit: '🔴 Over limit',
    suspicious: '⚠️ Heads up: income is well below usual — check that everything is recorded',
    limitTitle: '🎯 Limit',
    limitNear: (name: string, pct: number) => `🟡 ${name}: ${pct}% of the limit used`,
    limitOver: (name: string) => `🔴 ${name}: limit exceeded`,
    incomeMissingTitle: '💼 Income expected',
    incomeMissing: (name: string, date: string) => `${name} has not been recorded yet (expected ${date})`,
    testTitle: '✅ My Wallet',
    testBody: 'Test message — notifications are working.',
  },
} as const

/** 2026-10-05 → 05.10 */
export const shortDate = (iso: string): string => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`

/** 2026-09-01 → "Sentabr 2026" */
export const monthLabel = (iso: string, locale: Locale): string =>
  `${MONTHS[locale][Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`

const pct = (ratio: number): string => `${Math.round(ratio * 100)}%`

function planLines(items: readonly PlanLine[], locale: Locale): string[] {
  return items.map((item) => {
    const amount = item.amount === null ? TEXT[locale].variable : formatMoney(item.amount, locale)
    return `• ${item.name} — ${amount} (${shortDate(item.due_date)})`
  })
}

// deno-lint-ignore no-explicit-any
type Payload = Record<string, any>

export function render(type: MessageType, payload: Payload, locale: Locale): Rendered {
  const t = TEXT[locale]
  switch (type) {
    case 'daily_reminder': {
      const lines: string[] = []
      const sections: [string, readonly PlanLine[]][] = [
        [t.overdue, payload.overdue ?? []],
        [t.today, payload.today ?? []],
        [t.upcoming, payload.upcoming ?? []],
      ]
      for (const [heading, items] of sections) {
        if (items.length > 0) lines.push(`${heading}:`, ...planLines(items, locale))
      }
      if (typeof payload.balance === 'number') lines.push('', `${t.balance}: ${formatMoney(payload.balance, locale)}`)
      return { title: t.reminderTitle, lines }
    }
    case 'monthly_report': {
      const lines = [
        `${t.income}: ${formatMoney(payload.income, locale)}`,
        `${t.expense}: ${formatMoney(payload.expense, locale)}`,
        `${t.left}: ${formatMoney(payload.balance, locale)}`,
        `${t.saved}: ${formatMoney(payload.saved, locale)} (${pct(payload.saved_ratio ?? 0)})`,
        `${t.fund}: ${formatMoney(payload.fund_balance ?? 0, locale)}`,
        `${t.savings}: ${formatMoney(payload.savings_total ?? 0, locale)}`,
      ]
      if ((payload.debts_remaining ?? 0) > 0) lines.push(`${t.debts}: ${formatMoney(payload.debts_remaining, locale)}`)
      const top: { name: string; actual: number }[] = payload.top_categories ?? []
      if (top.length > 0) {
        lines.push('', `${t.top}:`, ...top.map((c, i) => `${i + 1}. ${c.name} — ${formatMoney(c.actual, locale)}`))
      }
      const over: { name: string; actual: number; limit: number }[] = payload.limits_exceeded ?? []
      if (over.length > 0) {
        lines.push(
          '',
          `${t.overLimit}:`,
          ...over.map((c) => `• ${c.name} — ${formatMoney(c.actual, locale)} / ${formatMoney(c.limit, locale)}`),
        )
      }
      if (payload.suspicious) lines.push('', t.suspicious)
      return { title: t.reportTitle(monthLabel(payload.month, locale)), lines }
    }
    case 'limit_alert': {
      const head = payload.threshold >= 100
        ? t.limitOver(payload.category)
        : t.limitNear(payload.category, payload.threshold)
      return {
        title: t.limitTitle,
        lines: [head, `${formatMoney(payload.actual, locale)} / ${formatMoney(payload.limit, locale)}`],
      }
    }
    case 'income_missing':
      return { title: t.incomeMissingTitle, lines: [t.incomeMissing(payload.name, shortDate(payload.due_date))] }
    case 'test':
      return { title: t.testTitle, lines: [t.testBody] }
  }
}

/** Push matni: bo'sh qatorlarsiz, FCM chegarasidan qisqa. */
export const PUSH_BODY_MAX = 900

export function toPush(message: Rendered): { title: string; body: string } {
  const body = message.lines.filter((line) => line !== '').join('\n')
  return { title: message.title, body: body.length > PUSH_BODY_MAX ? `${body.slice(0, PUSH_BODY_MAX - 1)}…` : body }
}

export const escapeHtml = (text: string): string =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

export function toTelegramHtml(message: Rendered): string {
  return [`<b>${escapeHtml(message.title)}</b>`, ...message.lines.map(escapeHtml)].join('\n')
}
