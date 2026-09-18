// telegram-webhook: Telegram → Edge Function. Sarlavha
// X-Telegram-Bot-Api-Secret-Token = TELEGRAM_WEBHOOK_SECRET (setWebhook'da beriladi).
import { safeEqual } from '../_shared/cron.ts'
import { optionalEnv, requireEnv, serviceKey } from '../_shared/env.ts'
import { rpc } from '../_shared/supabase.ts'
import { handleUpdate, type Summary, type TelegramUpdate } from './handler.ts'

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
  })
  // Telegram 200 kutadi; javob bo'lsa — webhook javobining o'zida yuboriladi.
  return reply ? Response.json(reply) : new Response(null, { status: 200 })
})
