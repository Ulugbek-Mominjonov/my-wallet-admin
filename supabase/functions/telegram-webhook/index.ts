// telegram-webhook: Telegram → Edge Function. Sarlavha
// X-Telegram-Bot-Api-Secret-Token = TELEGRAM_WEBHOOK_SECRET (setWebhook'da beriladi).
import { safeEqual } from '../_shared/cron.ts'
import { optionalEnv, requireEnv, serviceKey } from '../_shared/env.ts'
import { rpc } from '../_shared/supabase.ts'
import type { CardTemplate } from './card.ts'
import {
  type CategoryList,
  handleUpdate,
  type MonthSummary,
  type QuickAdd,
  type Summary,
  type TelegramUpdate,
} from './handler.ts'

Deno.serve(async (request) => {
  const secret = optionalEnv('TELEGRAM_WEBHOOK_SECRET')
  const header = request.headers.get('x-telegram-bot-api-secret-token')
  if (!secret || !header || !safeEqual(header, secret)) {
    return new Response('forbidden', { status: 403 })
  }
  const url = requireEnv('SUPABASE_URL')
  const key = serviceKey()
  const update: TelegramUpdate = await request.json()

  const reply = await handleUpdate(update, {
    consume: (token, chatId) => rpc('telegram_link_consume', { p_token: token, p_chat_id: chatId }, { url, key }),
    unlink: (chatId) => rpc<boolean>('telegram_unlink_chat', { p_chat_id: chatId }, { url, key }),
    summary: (chatId) => rpc<Summary | null>('telegram_summary', { p_chat_id: chatId }, { url, key }),
    // E31-T01 (BR-220): matndan amal va tugmalar.
    quickAdd: (chatId, entry) =>
      rpc<QuickAdd>('telegram_quick_add', {
        p_chat_id: chatId,
        p_kind: entry.kind,
        p_amount: entry.amount,
        p_payee: entry.payee || null,
        p_occurred_on: entry.occurredOn ?? null,
        p_card_last4: entry.cardLast4 ?? null,
      }, { url, key }),
    categories: (chatId, kind) =>
      rpc<CategoryList>('telegram_categories', { p_chat_id: chatId, p_kind: kind }, { url, key }),
    setCategory: (chatId, transaction, category) =>
      rpc('telegram_set_category', {
        p_chat_id: chatId,
        p_transaction: transaction,
        p_category: category,
      }, { url, key }),
    undo: (chatId, transaction) =>
      rpc('telegram_undo', { p_chat_id: chatId, p_transaction: transaction }, { url, key }),
    // E31-T02, T03.
    cardTemplates: () => rpc<CardTemplate[]>('telegram_card_templates', {}, { url, key }),
    report: (chatId, month) =>
      rpc<MonthSummary>('telegram_report', { p_chat_id: chatId, p_month: month }, { url, key }),
    setLocale: (chatId, locale) => rpc('telegram_set_locale', { p_chat_id: chatId, p_locale: locale }, { url, key }),
  })
  // Telegram 200 kutadi; javob bo'lsa — webhook javobining o'zida yuboriladi.
  return reply ? Response.json(reply) : new Response(null, { status: 200 })
})
