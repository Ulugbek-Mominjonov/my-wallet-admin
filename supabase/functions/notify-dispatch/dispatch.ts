// E11-T04: navbatdan xabarlarni yuborish (ADR-11). Mantiq — tashqi ta'sirlardan
// (baza, FCM, Telegram) ajratilgan: testlarda soxta implementatsiyalar bilan.
import { type MessageType, render, toPush, toTelegramHtml } from '../_shared/i18n.ts'
import { toLocale } from '../_shared/money.ts'
import type { PushOutcome } from '../_shared/fcm.ts'
import type { TelegramOutcome } from '../_shared/telegram.ts'

export interface OutboxMessage {
  id: number
  channel: 'push' | 'telegram' | 'email'
  type: MessageType
  // deno-lint-ignore no-explicit-any
  payload: Record<string, any>
  locale: string
  tokens?: string[] | null
  chat_id?: number | null
  email?: string | null
}

export interface SendResult {
  id: number
  status: 'sent' | 'failed' | 'skipped'
  error?: string
  retry?: boolean
}

export interface DispatchDeps {
  claim(limit: number): Promise<OutboxMessage[]>
  complete(results: SendResult[], staleTokens: string[]): Promise<void>
  /** Sozlanmagan bo'lsa — undefined (xabar "skipped"). */
  push?: (token: string, message: { title: string; body: string; data: Record<string, string> }) => Promise<PushOutcome>
  telegram?: (chatId: number, html: string) => Promise<TelegramOutcome>
}

export interface DispatchOptions {
  batchSize: number
  /** Bir vaqtda yuboriladigan xabarlar. */
  concurrency: number
  /** Funksiya vaqt chegarasidan oldin to'xtash (ms). */
  budgetMs: number
  now?: () => number
}

async function sendOne(
  message: OutboxMessage,
  deps: DispatchDeps,
  staleTokens: string[],
): Promise<SendResult> {
  const rendered = render(message.type, message.payload, toLocale(message.locale))

  if (message.channel === 'push') {
    if (!deps.push) return { id: message.id, status: 'skipped', error: 'push_not_configured' }
    const tokens = message.tokens ?? []
    if (tokens.length === 0) return { id: message.id, status: 'skipped', error: 'no_device' }
    const outcomes = await Promise.all(
      tokens.map((token) => deps.push!(token, { ...toPush(rendered), data: { type: message.type } })),
    )
    outcomes.forEach((outcome, index) => {
      if (outcome.kind === 'stale') staleTokens.push(tokens[index])
    })
    // Kamida bitta qurilmaga yetgan bo'lsa — yuborilgan.
    if (outcomes.some((outcome) => outcome.kind === 'sent')) return { id: message.id, status: 'sent' }
    const errors = outcomes.filter((outcome) => outcome.kind === 'error')
    if (errors.length === 0) return { id: message.id, status: 'skipped', error: 'no_valid_device' }
    return {
      id: message.id,
      status: 'failed',
      retry: errors.some((outcome) => outcome.retry),
      error: errors.map((outcome) => outcome.error).join('; '),
    }
  }

  if (message.channel === 'telegram') {
    if (!deps.telegram) return { id: message.id, status: 'skipped', error: 'telegram_not_configured' }
    if (!message.chat_id) return { id: message.id, status: 'skipped', error: 'not_linked' }
    const outcome = await deps.telegram(message.chat_id, toTelegramHtml(rendered))
    return outcome.kind === 'sent'
      ? { id: message.id, status: 'sent' }
      : { id: message.id, status: 'failed', retry: outcome.retry, error: outcome.error }
  }

  // Email kanali hali ulanmagan (SMTP — ixtiyoriy, DEPLOY.md 4).
  return { id: message.id, status: 'skipped', error: 'email_not_supported' }
}

export async function dispatch(deps: DispatchDeps, options: DispatchOptions) {
  const now = options.now ?? Date.now
  const deadline = now() + options.budgetMs
  const summary = { processed: 0, sent: 0, failed: 0, skipped: 0 }

  while (now() < deadline) {
    const batch = await deps.claim(options.batchSize)
    if (batch.length === 0) break
    const results: SendResult[] = []
    const staleTokens: string[] = []
    for (let i = 0; i < batch.length; i += options.concurrency) {
      const chunk = batch.slice(i, i + options.concurrency)
      results.push(
        ...(await Promise.all(
          chunk.map((message) =>
            sendOne(message, deps, staleTokens).catch((error: unknown): SendResult => ({
              id: message.id,
              status: 'failed',
              retry: true,
              error: error instanceof Error ? error.message : String(error),
            }))
          ),
        )),
      )
    }
    await deps.complete(results, staleTokens)
    for (const result of results) summary[result.status] += 1
    summary.processed += results.length
    if (batch.length < options.batchSize) break
  }
  return summary
}
