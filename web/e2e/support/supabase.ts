/**
 * E2E yordamchilari (Node tomoni): lokal Supabase Auth/RPC va Mailpit.
 * Manzil va publishable kalit — muhitdan (lokal: web/.env.local, CI: job
 * env); secret kalit ishlatilmaydi — foydalanuvchilar oddiy kirish yo'li
 * bilan yaratiladi.
 */
const SUPABASE_URL = requireEnv('VITE_SUPABASE_URL')
const PUBLISHABLE_KEY = requireEnv('VITE_SUPABASE_PUBLISHABLE_KEY')
const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324'

const CODE_POLL_MS = 500
const CODE_ATTEMPTS = 40

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} kerak (make web-env yoki CI env)`)
  return value
}

/** Har test o'z foydalanuvchisi bilan — parallel ishlaganda to'qnashmaydi. */
export function uniqueEmail(prefix: string): string {
  return `${prefix}-${String(Date.now())}-${Math.random().toString(36).slice(2, 8)}@e2e.test`
}

interface MailpitSearch {
  messages: { ID: string }[]
}

/** Mailpit'dagi oxirgi xatdan 6 xonali kirish kodi. */
export async function emailCode(email: string): Promise<string> {
  for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
    const search = await getJson<MailpitSearch>(
      `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`,
    )
    const latest = search.messages.at(0)
    if (latest) {
      const message = await getJson<{ Text: string }>(`${MAILPIT_URL}/api/v1/message/${latest.ID}`)
      const code = /\b\d{6}\b/.exec(message.Text)?.[0]
      if (code) return code
    }
    await new Promise((resolve) => setTimeout(resolve, CODE_POLL_MS))
  }
  throw new Error(`Kod xati kelmadi: ${email}`)
}

/** UI'siz kirish (email kodi) — access token (boshqa foydalanuvchi tayyorlash uchun). */
export async function signInViaApi(email: string): Promise<string> {
  await postJson('/auth/v1/otp', { email, create_user: true })
  const session = await postJson<{ access_token: string }>('/auth/v1/verify', {
    type: 'email',
    email,
    token: await emailCode(email),
  })
  return session.access_token
}

export function rpc<T>(accessToken: string, name: string, args: Record<string, unknown>) {
  return postJson<T>(`/rest/v1/rpc/${name}`, args, accessToken)
}

async function postJson<T = unknown>(path: string, body: unknown, accessToken?: string) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    method: 'POST',
    headers: {
      apikey: PUBLISHABLE_KEY,
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(`${path}: ${String(response.status)} ${await response.text()}`)
  return (await response.json()) as T
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url}: ${String(response.status)}`)
  return (await response.json()) as T
}
