// Tashqi API'larsiz testlar uchun soxta fetch: chaqiruvlarni yozib boradi.

export interface Call {
  url: string
  method: string
  headers: Headers
  body: string | null
}

export function fakeFetch(handler: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = []
  const fn: typeof fetch = (input, init) => {
    const request = new Request(input, init)
    const call = {
      url: request.url,
      method: request.method,
      headers: request.headers,
      body: init?.body ? String(init.body) : null,
    }
    calls.push(call)
    return Promise.resolve(handler(call))
  }
  return { fn, calls }
}

export const json = (body: unknown, status = 200): Response => Response.json(body, { status })
