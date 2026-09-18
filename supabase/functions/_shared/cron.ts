// pg_cron → Edge Function chaqiruvi: `x-cron-secret` sarlavhasi Vault'dagi
// `cron_secret` bilan (Edge Function'da CRON_SECRET; ikkalasini deploy yozadi).

/** Vaqt bo'yicha sizib chiqmaydigan solishtirish. */
export function safeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a)
  const right = new TextEncoder().encode(b)
  let diff = left.length ^ right.length
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0)
  }
  return diff === 0
}

export function isAuthorizedCron(request: Request, secret: string | undefined): boolean {
  const header = request.headers.get('x-cron-secret')
  return Boolean(secret && header && safeEqual(header, secret))
}
