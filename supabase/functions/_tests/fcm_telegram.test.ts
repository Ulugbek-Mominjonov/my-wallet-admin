import { assert, assertEquals } from '@std/assert'
import {
  accessToken,
  parseServiceAccount,
  resetTokenCache,
  sendPush,
  type ServiceAccount,
  signJwt,
} from '../_shared/fcm.ts'
import { sendTelegram } from '../_shared/telegram.ts'
import { fakeFetch, json } from './fake_fetch.ts'

const decode = (part: string) => JSON.parse(atob(part.replaceAll('-', '+').replaceAll('_', '/')))

async function testAccount(): Promise<{ account: ServiceAccount; publicKey: CryptoKey }> {
  const pair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  )
  const der = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey))
  const pem = `-----BEGIN PRIVATE KEY-----\n${
    btoa(String.fromCharCode(...der)).replace(/(.{64})/g, '$1\n')
  }\n-----END PRIVATE KEY-----\n`
  return {
    account: {
      project_id: 'my-wallet-test',
      client_email: 'fcm@my-wallet-test.iam.gserviceaccount.com',
      private_key: pem,
    },
    publicKey: pair.publicKey,
  }
}

Deno.test('servis akkaunt: base64 JSON', () => {
  const account = { project_id: 'p', client_email: 'e', private_key: 'k' }
  assertEquals(parseServiceAccount(btoa(JSON.stringify(account))), account)
})

Deno.test("JWT: RS256 imzo, to'g'ri claim'lar", async () => {
  const { account, publicKey } = await testAccount()
  const jwt = await signJwt(account, 1_000)
  const [header, claims, signature] = jwt.split('.')
  assertEquals(decode(header), { alg: 'RS256', typ: 'JWT' })
  assertEquals(decode(claims).iss, account.client_email)
  assertEquals(decode(claims).exp - decode(claims).iat, 3600)
  const bytes = Uint8Array.from(atob(signature.replaceAll('-', '+').replaceAll('_', '/')), (c) => c.charCodeAt(0))
  assert(
    await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, bytes, new TextEncoder().encode(`${header}.${claims}`)),
  )
})

Deno.test('push: natijalar va access token keshi', async () => {
  const { account } = await testAccount()
  resetTokenCache()
  const responses: Record<string, Response> = {
    ok: json({ name: 'projects/x/messages/1' }),
    gone: json({ error: { status: 'NOT_FOUND', details: [{ errorCode: 'UNREGISTERED' }] } }, 404),
    busy: json({ error: { status: 'UNAVAILABLE' } }, 503),
    bad: json({ error: { status: 'INVALID_ARGUMENT' } }, 400),
  }
  const fetcher = fakeFetch((call) => {
    if (call.url.startsWith('https://oauth2.googleapis.com')) return json({ access_token: 'at', expires_in: 3600 })
    return responses[JSON.parse(call.body!).message.token].clone()
  })
  const message = { title: 't', body: 'b', data: { type: 'test' } }
  assertEquals(await sendPush(account, 'ok', message, fetcher.fn), { kind: 'sent' })
  assertEquals(await sendPush(account, 'gone', message, fetcher.fn), { kind: 'stale' })
  const busy = await sendPush(account, 'busy', message, fetcher.fn)
  assert(busy.kind === 'error' && busy.retry)
  const bad = await sendPush(account, 'bad', message, fetcher.fn)
  assert(bad.kind === 'error' && !bad.retry)
  // OAuth bir marta — keyingi yuborishlar keshdan.
  assertEquals(fetcher.calls.filter((call) => call.url.startsWith('https://oauth2')).length, 1)
  assertEquals(fetcher.calls[1].headers.get('authorization'), 'Bearer at')
  assertEquals(await accessToken(account, fetcher.fn), 'at')
  resetTokenCache()
})

Deno.test('Telegram: yuborildi, bloklangan (qayta urinilmaydi), 429 (qayta)', async () => {
  const statuses = [200, 403, 429]
  const fetcher = fakeFetch(() => json({ ok: true }, statuses.shift()))
  assertEquals(await sendTelegram('123:abc', 42, '<b>x</b>', fetcher.fn), { kind: 'sent' })
  const blocked = await sendTelegram('123:abc', 42, 'x', fetcher.fn)
  assert(blocked.kind === 'error' && !blocked.retry)
  const limited = await sendTelegram('123:abc', 42, 'x', fetcher.fn)
  assert(limited.kind === 'error' && limited.retry)
  assertEquals(JSON.parse(fetcher.calls[0].body!), {
    chat_id: 42,
    text: '<b>x</b>',
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  })
})
