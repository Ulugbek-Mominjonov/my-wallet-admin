// Supabase API'lari (PostgREST RPC, Auth, Storage) — tashqi kutubxonasiz (fetch).
// Yangi `sb_secret_` / `sb_publishable_` kalitlari JWT emas — ular faqat
// `apikey` sarlavhasida yuboriladi.

export interface RpcOptions {
  url: string
  key: string
  /** Foydalanuvchi nomidan chaqiruv (RLS uning huquqi bilan). */
  userJwt?: string
  fetchFn?: typeof fetch
}

export class RpcError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message)
    this.name = 'RpcError'
  }
}

export function authHeaders(key: string, userJwt?: string): Record<string, string> {
  const headers: Record<string, string> = { apikey: key }
  const bearer = userJwt ?? (key.startsWith('sb_') ? undefined : key)
  if (bearer) headers.Authorization = `Bearer ${bearer}`
  return headers
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export async function rpc<T>(name: string, args: Record<string, unknown>, options: RpcOptions): Promise<T> {
  const response = await (options.fetchFn ?? fetch)(`${options.url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { ...authHeaders(options.key, options.userJwt), 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  })
  const body = await readJson(response)
  if (!response.ok) {
    const error = (body ?? {}) as { code?: string; message?: string }
    throw new RpcError(response.status, error.code ?? String(response.status), error.message ?? String(body))
  }
  return body as T
}

/** JWT'ni Auth tekshiradi: yaroqli bo'lsa — foydalanuvchi ID, aks holda null. */
export async function getUserId(
  url: string,
  key: string,
  userJwt: string,
  fetchFn: typeof fetch = fetch,
): Promise<string | null> {
  const response = await fetchFn(`${url}/auth/v1/user`, { headers: authHeaders(key, userJwt) })
  if (response.status === 401 || response.status === 403) return null
  const body = await readJson(response) as { id?: string } | null
  if (!response.ok) throw new RpcError(response.status, 'auth_error', String(body))
  return body?.id ?? null
}

/** Auth foydalanuvchisini o'chirish (service kaliti bilan). */
export async function deleteAuthUser(
  url: string,
  key: string,
  userId: string,
  fetchFn: typeof fetch = fetch,
): Promise<void> {
  const response = await fetchFn(`${url}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    headers: authHeaders(key),
  })
  if (!response.ok) throw new RpcError(response.status, 'auth_error', String(await readJson(response)))
}

/** Storage'dan fayllarni o'chirish; natija — o'chirilganlar soni. */
export async function removeObjects(
  url: string,
  key: string,
  bucket: string,
  paths: readonly string[],
  fetchFn: typeof fetch = fetch,
): Promise<number> {
  const response = await fetchFn(`${url}/storage/v1/object/${bucket}`, {
    method: 'DELETE',
    headers: { ...authHeaders(key), 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefixes: paths }),
  })
  const body = await readJson(response)
  if (!response.ok) throw new RpcError(response.status, 'storage_error', String(JSON.stringify(body)).slice(0, 300))
  return Array.isArray(body) ? body.length : 0
}
