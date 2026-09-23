// E11-T05: Telegram bot buyruqlari (BR-163, BR-221). Javob webhook javobining
// o'zida (method: sendMessage) — alohida API chaqiruvi kerak emas.
import { escapeHtml, monthLabel, shortDate } from '../_shared/i18n.ts'
import { formatMoney, type Locale, toLocale } from '../_shared/money.ts'
import { type CardTemplate, parseCardMessage } from './card.ts'
import { parseQuickEntry } from './parse.ts'
import { BOT_TEXT } from './texts.ts'

export interface TelegramUpdate {
  message?: {
    chat: { id: number; type?: string }
    text?: string
    from?: { language_code?: string }
    /** BR-222: bank botidan forward qilingan xabar (eski va yangi API maydoni). */
    forward_origin?: unknown
    forward_date?: number
  }
  /** E31-T01: xabar ostidagi tugmalar (kategoriya, bekor qilish). */
  callback_query?: {
    id: string
    data?: string
    from?: { language_code?: string }
    message?: { chat: { id: number; type?: string }; message_id: number }
  }
}

/** Botdan yozilgan amal (`telegram_quick_add` javobi). */
export interface QuickAdd {
  ok: boolean
  code?: string
  locale?: string | null
  transaction_id?: string
  amount?: number
  payee?: string | null
  kind?: 'income' | 'expense'
  category?: string
  account?: string
  occurred_on?: string
}

export interface CategoryList {
  ok: boolean
  code?: string
  categories?: { id: string; name: string }[]
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
  /** E31-T01 (BR-220): matndan amal yozish va tugmalar. */
  quickAdd(
    chatId: number,
    entry: {
      kind: 'income' | 'expense'
      amount: number
      payee: string
      occurredOn?: string | null
      cardLast4?: string | null
    },
  ): Promise<QuickAdd>
  categories(chatId: number, kind: 'income' | 'expense'): Promise<CategoryList>
  setCategory(
    chatId: number,
    transaction: string,
    category: string,
  ): Promise<{ ok: boolean; category?: string; locale?: string | null }>
  undo(chatId: number, transaction: string): Promise<{ ok: boolean; locale?: string | null }>
  /** E31-T02 (BR-222): karta xabarnomasi shablonlari. */
  cardTemplates(): Promise<CardTemplate[]>
  /** E31-T03 (BR-221): oylik yakun va til. */
  report(chatId: number, month: string | null): Promise<MonthSummary>
  setLocale(chatId: number, locale: string): Promise<{ ok: boolean; code?: string; locale?: string }>
}

/** `/hisobot` javobi. */
export interface MonthSummary {
  ok: boolean
  code?: string
  locale?: string | null
  household?: string
  month?: string
  income?: number
  expense?: number
  balance?: number
  saved?: number
  unpaid?: number
}

/** Inline tugmalar (bir qator — ikkita tugma). */
export interface InlineKeyboard {
  inline_keyboard: { text: string; callback_data: string }[][]
}

export type BotReply =
  | { method: 'sendMessage'; chat_id: number; text: string; parse_mode: 'HTML'; reply_markup?: InlineKeyboard }
  | {
    method: 'editMessageText'
    chat_id: number
    message_id: number
    text: string
    parse_mode: 'HTML'
    reply_markup?: InlineKeyboard
  }

const reply = (chatId: number, text: string, keyboard?: InlineKeyboard): BotReply => ({
  method: 'sendMessage',
  chat_id: chatId,
  text,
  parse_mode: 'HTML',
  ...(keyboard ? { reply_markup: keyboard } : {}),
})

const edit = (chatId: number, messageId: number, text: string, keyboard?: InlineKeyboard): BotReply => ({
  method: 'editMessageText',
  chat_id: chatId,
  message_id: messageId,
  text,
  parse_mode: 'HTML',
  ...(keyboard ? { reply_markup: keyboard } : {}),
})

/** Yozilgan amal matni: summa, joy, kategoriya va hisob. */
function savedText(entry: QuickAdd, locale: Locale): string {
  const t = BOT_TEXT[locale]
  const place = entry.payee ? ` — ${escapeHtml(entry.payee)}` : ''
  return [
    `<b>${t.saved}</b>: ${formatMoney(entry.amount ?? 0, locale)}${place}`,
    `${escapeHtml(entry.category ?? '')} · ${escapeHtml(entry.account ?? '')} · ${shortDate(entry.occurred_on ?? '')}`,
  ].join('\n')
}

const savedKeyboard = (transaction: string, locale: Locale): InlineKeyboard => ({
  inline_keyboard: [[
    { text: BOT_TEXT[locale].editCategory, callback_data: `cat:${transaction}` },
    { text: BOT_TEXT[locale].cancel, callback_data: `del:${transaction}` },
  ]],
})

function reportText(summary: MonthSummary, locale: Locale): string {
  const t = BOT_TEXT[locale]
  return [
    `<b>📊 ${escapeHtml(summary.household ?? '')} — ${monthLabel(summary.month ?? '', locale)}</b>`,
    `${t.income}: ${formatMoney(summary.income ?? 0, locale)}`,
    `${t.expense}: ${formatMoney(summary.expense ?? 0, locale)}`,
    `${t.balance}: ${formatMoney(summary.balance ?? 0, locale)}`,
    `${t.savedLabel}: ${formatMoney(summary.saved ?? 0, locale)}`,
  ].join('\n')
}

/** `/hisobot 2026-09` yoki `/hisobot 09.2026` → oyning 1-kuni. */
export function parseMonthArgument(value: string): string | null {
  const trimmed = value.trim()
  if (trimmed === '') return null
  const iso = /^(\d{4})-(\d{1,2})$/.exec(trimmed)
  if (iso) return `${iso[1]}-${(iso[2] ?? '').padStart(2, '0')}-01`
  const dotted = /^(\d{1,2})[./](\d{4})$/.exec(trimmed)
  if (dotted) return `${dotted[2]}-${(dotted[1] ?? '').padStart(2, '0')}-01`
  return null
}

/** Yozishdagi xato kodi → foydalanuvchi matni. */
function quickError(code: string | undefined, locale: Locale): string {
  const t = BOT_TEXT[locale]
  if (code === 'not_linked') return t.not_linked
  if (code === 'setup_required') return t.setupRequired
  if (code === 'month_closed') return t.monthClosed
  return t.writeFailed
}

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

async function handleCallback(
  query: NonNullable<TelegramUpdate['callback_query']>,
  deps: BotDeps,
): Promise<BotReply | null> {
  const chat = query.message?.chat
  if (!chat || chat.type !== 'private' || !query.data || !query.message) return null
  const chatId = chat.id
  const messageId = query.message.message_id
  const fallback = toLocale(query.from?.language_code)
  const [action = '', transaction = '', category = ''] = query.data.split(':')

  if (action === 'del') {
    const result = await deps.undo(chatId, transaction)
    const locale = toLocale(result.locale ?? fallback)
    return edit(chatId, messageId, result.ok ? BOT_TEXT[locale].undone : BOT_TEXT[locale].notFound)
  }
  if (action === 'cat') {
    const list = await deps.categories(chatId, 'expense')
    const rows = (list.categories ?? []).map((item) => [{
      text: item.name,
      callback_data: `set:${transaction}:${item.id}`,
    }])
    if (rows.length === 0) return edit(chatId, messageId, BOT_TEXT[fallback].setupRequired)
    return edit(chatId, messageId, BOT_TEXT[fallback].chooseCategory, { inline_keyboard: rows })
  }
  if (action === 'set') {
    const result = await deps.setCategory(chatId, transaction, category)
    const locale = toLocale(result.locale ?? fallback)
    return edit(
      chatId,
      messageId,
      result.ok
        ? `${BOT_TEXT[locale].categoryUpdated} ${escapeHtml(result.category ?? '')}`
        : BOT_TEXT[locale].notFound,
    )
  }
  return null
}

export async function handleUpdate(update: TelegramUpdate, deps: BotDeps): Promise<BotReply | null> {
  if (update.callback_query) return await handleCallback(update.callback_query, deps)
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
    case 'hisobot':
    case 'report': {
      const month = parseMonthArgument(argument)
      const summary = await deps.report(chatId, month)
      const locale = toLocale(summary.locale ?? fallback)
      if (!summary.ok) return reply(chatId, BOT_TEXT[locale].not_linked)
      return reply(chatId, reportText(summary, locale))
    }
    case 'til':
    case 'lang': {
      const result = await deps.setLocale(chatId, argument.trim().toLowerCase())
      if (!result.ok && result.code === 'not_linked') return reply(chatId, BOT_TEXT[fallback].not_linked)
      if (!result.ok) return reply(chatId, BOT_TEXT[fallback].langUsage)
      const locale = toLocale(result.locale)
      return reply(chatId, `${BOT_TEXT[locale].langChanged}\n\n${BOT_TEXT[locale].help}`)
    }
    default: {
      // Buyruq emas — tez kiritish (BR-220) yoki karta xabarnomasi (BR-222).
      if (message.text.startsWith('/')) return reply(chatId, BOT_TEXT[fallback].help)
      // Bank xabarnomasi — forward qilingan yoki ko'p qatorli: avval shablonlar.
      const forwarded = message.forward_origin !== undefined || message.forward_date !== undefined
      if (forwarded || message.text.includes('\n')) {
        const card = parseCardMessage(message.text, await deps.cardTemplates())
        if (!card) return reply(chatId, BOT_TEXT[fallback].cardNoTemplate)
        const saved = await deps.quickAdd(chatId, {
          kind: card.kind,
          amount: card.amount,
          payee: card.payee,
          occurredOn: card.date,
          cardLast4: card.card,
        })
        const locale = toLocale(saved.locale ?? fallback)
        if (!saved.ok || !saved.transaction_id) return reply(chatId, quickError(saved.code, locale))
        return reply(chatId, savedText(saved, locale), savedKeyboard(saved.transaction_id, locale))
      }
      const entry = parseQuickEntry(message.text)
      if (!entry) return reply(chatId, `${BOT_TEXT[fallback].help}\n\n${BOT_TEXT[fallback].quickHint}`)
      const saved = await deps.quickAdd(chatId, entry)
      const locale = toLocale(saved.locale ?? fallback)
      if (!saved.ok || !saved.transaction_id) return reply(chatId, quickError(saved.code, locale))
      return reply(chatId, savedText(saved, locale), savedKeyboard(saved.transaction_id, locale))
    }
  }
}
