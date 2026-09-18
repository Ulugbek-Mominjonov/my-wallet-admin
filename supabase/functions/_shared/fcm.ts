// FCM HTTP v1 (push). Servis akkaunti (FCM_SERVICE_ACCOUNT, base64 JSON) →
// RS256 JWT (WebCrypto) → OAuth access token (izolyat ichida keshlanadi) →
// messages:send. Natija: yuborildi | token eskirgan | qayta urinish | xato.

export interface ServiceAccount {
  project_id: string
  client_email: string
  private_key: string
}

export type PushOutcome =
  | { kind: 'sent' }
  | { kind: 'stale' }
  | { kind: 'error'; retry: boolean; error: string }

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging'
// Access token amal qilishi (Google — 1 soat) va xavfsizlik zaxirasi.
const TOKEN_TTL_SECONDS = 3600
const TOKEN_REFRESH_MARGIN_MS = 60_000

let cached: { token: string; expiresAt: number } | null = null

export function parseServiceAccount(base64: string): ServiceAccount {
  const json = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))))
  if (!json.project_id || !json.client_email || !json.private_key) {
    throw new Error("FCM_SERVICE_ACCOUNT: project_id/client_email/private_key yo'q")
  }
  return json
}

const base64url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')

const encodeJson = (value: unknown): string => base64url(new TextEncoder().encode(JSON.stringify(value)))

function pemToDer(pem: string): Uint8Array<ArrayBuffer> {
  const body = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')
  return Uint8Array.from(atob(body), (c) => c.charCodeAt(0))
}

export async function signJwt(account: ServiceAccount, nowSeconds: number): Promise<string> {
  const header = encodeJson({ alg: 'RS256', typ: 'JWT' })
  const claims = encodeJson({
    iss: account.client_email,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: nowSeconds,
    exp: nowSeconds + TOKEN_TTL_SECONDS,
  })
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToDer(account.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${claims}`))
  return `${header}.${claims}.${base64url(new Uint8Array(signature))}`
}

export async function accessToken(account: ServiceAccount, fetchFn: typeof fetch = fetch): Promise<string> {
  if (cached && cached.expiresAt - TOKEN_REFRESH_MARGIN_MS > Date.now()) return cached.token
  const assertion = await signJwt(account, Math.floor(Date.now() / 1000))
  const response = await fetchFn(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  })
  if (!response.ok) throw new Error(`FCM OAuth: ${response.status} ${await response.text()}`)
  const body = await response.json()
  cached = { token: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 }
  return cached.token
}

/** Testlar uchun: keshni tozalash. */
export const resetTokenCache = (): void => {
  cached = null
}

export async function sendPush(
  account: ServiceAccount,
  deviceToken: string,
  message: { title: string; body: string; data: Record<string, string> },
  fetchFn: typeof fetch = fetch,
): Promise<PushOutcome> {
  const token = await accessToken(account, fetchFn)
  const response = await fetchFn(`https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        token: deviceToken,
        notification: { title: message.title, body: message.body },
        data: message.data,
        android: { priority: 'high' },
      },
    }),
  })
  if (response.ok) return { kind: 'sent' }
  const text = await response.text()
  // Qurilmadan o'chirilgan / noto'g'ri token — qayta yuborilmaydi, token o'chiriladi.
  if (response.status === 404 || text.includes('UNREGISTERED') || text.includes('registration-token-not-registered')) {
    return { kind: 'stale' }
  }
  const retry = response.status === 429 || response.status >= 500
  return { kind: 'error', retry, error: `FCM ${response.status}: ${text.slice(0, 300)}` }
}
