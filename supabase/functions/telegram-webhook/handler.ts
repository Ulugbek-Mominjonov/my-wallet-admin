// E11-T05: Telegram bot buyruqlari (BR-163, BR-221). Javob webhook javobining
// o'zida (method: sendMessage) — alohida API chaqiruvi kerak emas.
import { escapeHtml, monthLabel, shortDate } from '../_shared/i18n.ts'
import { formatMoney, type Locale, toLocale } from '../_shared/money.ts'
import { BOT_TEXT } from './texts.ts'

export interface TelegramUpdate {
  message?: {
    chat: { id: number; type?: string }
    text?: string
    from?: { language_code?: string }
  }
}

export interface Summary {
  locale: string
  household: string
  month: string
  income: number
  expense: number
  balance: number
  forecast: number
  today: { name: string; amount: number | null; due_date: string }[]
}

export interface BotDeps {
  consume(token: string, chatId: number): Promise<{ ok: boolean; code?: string; locale?: string | null }>
  unlink(chatId: number): Promise<boolean>
  summary(chatId: number): Promise<Summary | null>
}

export interface BotReply {
  method: 'sendMessage'
  chat_id: number
  text: string
  parse_mode: 'HTML'
}

const reply = (chatId: number, text: string): BotReply => ({
  method: 'sendMessage',
  chat_id: chatId,
  text,
  parse_mode: 'HTML',
})

/** "/start@MyWalletBot abc" → ["start", "abc"] */
export function parseCommand(text: string): [string, string] {
  const [head = '', ...rest] = text.trim().split(/\s+/)
  return [head.replace(/^\//, '').replace(/@.*$/, '').toLowerCase(), rest.join(' ')]
}

function balanceText(summary: Summary, locale: Locale): string {
  const t = BOT_TEXT[locale]
  return [
    `<b>💰 ${escapeHtml(summary.household)} — ${monthLabel(summary.month, locale)}</b>`,
    `${t.income}: ${formatMoney(summary.income, locale)}`,
    `${t.expense}: ${formatMoney(summary.expense, locale)}`,
    `${t.balance}: ${formatMoney(summary.balance, locale)}`,
    `${t.forecast}: ${formatMoney(summary.forecast, locale)}`,
  ].join('\n')
}

function todayText(summary: Summary, locale: Locale): string {
  const t = BOT_TEXT[locale]
  if (summary.today.length === 0) return t.nothingToday
  return [
    `<b>${t.todayTitle}</b>`,
    ...summary.today.map((item) =>
      `• ${escapeHtml(item.name)} — ${item.amount === null ? t.variable : formatMoney(item.amount, locale)} (${
        shortDate(item.due_date)
      })`
    ),
  ].join('\n')
}

export async function handleUpdate(update: TelegramUpdate, deps: BotDeps): Promise<BotReply | null> {
  const message = update.message
  // Moliyaviy ma'lumot guruhga chiqmasin — faqat shaxsiy chat.
  if (!message?.text || message.chat.type !== 'private') return null
  const chatId = message.chat.id
  const fallback = toLocale(message.from?.language_code)
  const [command, argument] = parseCommand(message.text)

  switch (command) {
    case 'start': {
      if (!argument) return reply(chatId, BOT_TEXT[fallback].help)
      const result = await deps.consume(argument, chatId)
      const locale = toLocale(result.locale ?? fallback)
      if (result.ok) return reply(chatId, `${BOT_TEXT[locale].linked}\n\n${BOT_TEXT[locale].help}`)
      const code = result.code as 'token_invalid' | 'token_used' | 'token_expired'
      return reply(chatId, BOT_TEXT[locale][code] ?? BOT_TEXT[locale].token_invalid)
    }
    case 'stop':
      await deps.unlink(chatId)
      return reply(chatId, BOT_TEXT[fallback].unlinked)
    case 'balans':
    case 'balance':
    case 'bugun':
    case 'today': {
      const summary = await deps.summary(chatId)
      if (!summary) return reply(chatId, BOT_TEXT[fallback].not_linked)
      const locale = toLocale(summary.locale)
      return reply(
        chatId,
        command === 'balans' || command === 'balance' ? balanceText(summary, locale) : todayText(summary, locale),
      )
    }
    default:
      return reply(chatId, BOT_TEXT[fallback].help)
  }
}
