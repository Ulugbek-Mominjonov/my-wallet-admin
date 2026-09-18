// notify-dispatch: pg_cron (har 5 daqiqa, navbat bo'sh bo'lmasa) chaqiradi.
// Sarlavha x-cron-secret = CRON_SECRET. Sirlar — muhitda (DEPLOY.md 9).
import { isAuthorizedCron } from '../_shared/cron.ts'
import { optionalEnv, requireEnv, serviceKey } from '../_shared/env.ts'
import { parseServiceAccount, sendPush } from '../_shared/fcm.ts'
import { rpc } from '../_shared/supabase.ts'
import { sendTelegram } from '../_shared/telegram.ts'
import { dispatch, type OutboxMessage, type SendResult } from './dispatch.ts'

const BATCH_SIZE = 100
const CONCURRENCY = 10
// Edge Function chegarasi (bepul — 150 s) dan ancha oldin to'xtaymiz.
const BUDGET_MS = 25_000

Deno.serve(async (request) => {
  if (!isAuthorizedCron(request, optionalEnv('CRON_SECRET'))) {
    return new Response('forbidden', { status: 403 })
  }
  const url = requireEnv('SUPABASE_URL')
  const key = serviceKey()
  const fcmAccount = optionalEnv('FCM_SERVICE_ACCOUNT')
  const account = fcmAccount ? parseServiceAccount(fcmAccount) : undefined
  const botToken = optionalEnv('TELEGRAM_BOT_TOKEN')

  const summary = await dispatch(
    {
      claim: (limit) => rpc<OutboxMessage[]>('outbox_claim', { p_limit: limit }, { url, key }),
      complete: (results: SendResult[], staleTokens: string[]) =>
        rpc('outbox_complete', { p_results: results, p_stale_tokens: staleTokens }, { url, key }),
      push: account ? (token, message) => sendPush(account, token, message) : undefined,
      telegram: botToken ? (chatId, html) => sendTelegram(botToken, chatId, html) : undefined,
    },
    { batchSize: BATCH_SIZE, concurrency: CONCURRENCY, budgetMs: BUDGET_MS },
  )
  return Response.json(summary)
})
