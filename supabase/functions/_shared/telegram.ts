// Telegram Bot API: sendMessage (HTML). 403 — foydalanuvchi botni bloklagan
// (qayta urinilmaydi), 429/5xx — keyinroq qayta.

export type TelegramOutcome = { kind: 'sent' } | { kind: 'error'; retry: boolean; error: string }

export async function sendTelegram(
  botToken: string,
  chatId: number,
  html: string,
  fetchFn: typeof fetch = fetch,
): Promise<TelegramOutcome> {
  const response = await fetchFn(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: html, parse_mode: 'HTML', disable_web_page_preview: true }),
  })
  if (response.ok) return { kind: 'sent' }
  const text = await response.text()
  return {
    kind: 'error',
    retry: response.status === 429 || response.status >= 500,
    error: `Telegram ${response.status}: ${text.slice(0, 300)}`,
  }
}
