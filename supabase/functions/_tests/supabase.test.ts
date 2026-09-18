import { assertEquals, assertRejects } from '@std/assert'
import { authHeaders, deleteAuthUser, getUserId, removeObjects, rpc, RpcError } from '../_shared/supabase.ts'
import { fakeFetch, json } from './fake_fetch.ts'

const URL = 'https://ref.supabase.co'

Deno.test('authHeaders: yangi kalit faqat apikey da, eski JWT — Bearer ham', () => {
  assertEquals(authHeaders('sb_secret_x'), { apikey: 'sb_secret_x' })
  assertEquals(authHeaders('eyJ.legacy'), { apikey: 'eyJ.legacy', Authorization: 'Bearer eyJ.legacy' })
  assertEquals(authHeaders('sb_publishable_x', 'user.jwt'), {
    apikey: 'sb_publishable_x',
    Authorization: 'Bearer user.jwt',
  })
})

Deno.test('rpc: argumentlar va xato kodi', async () => {
  const ok = fakeFetch(() => json(3))
  assertEquals(await rpc<number>('fx_upsert', { p_rates: [] }, { url: URL, key: 'sb_secret_x', fetchFn: ok.fn }), 3)
  assertEquals(ok.calls[0].url, `${URL}/rest/v1/rpc/fx_upsert`)
  assertEquals(ok.calls[0].body, '{"p_rates":[]}')

  const failing = fakeFetch(() => json({ code: 'P0001', message: 'last_owner' }, 400))
  const error = await assertRejects(
    () => rpc('prepare_account_deletion', {}, { url: URL, key: 'k', fetchFn: failing.fn }),
    RpcError,
  )
  assertEquals([error.status, error.code, error.message], [400, 'P0001', 'last_owner'])
})

Deno.test("rpc: bo'sh javob (void) — null", async () => {
  const empty = fakeFetch(() => new Response(null, { status: 204 }))
  assertEquals(await rpc('outbox_complete', {}, { url: URL, key: 'k', fetchFn: empty.fn }), null)
})

Deno.test('getUserId: yaroqsiz JWT — null, yaroqli — ID', async () => {
  const valid = fakeFetch(() => json({ id: 'u1', email: 'a@b.c' }))
  assertEquals(await getUserId(URL, 'sb_publishable_x', 'jwt', valid.fn), 'u1')
  assertEquals(valid.calls[0].headers.get('authorization'), 'Bearer jwt')
  const invalid = fakeFetch(() => json({ msg: 'invalid JWT' }, 401))
  assertEquals(await getUserId(URL, 'sb_publishable_x', 'bad', invalid.fn), null)
  const down = fakeFetch(() => json({ msg: 'down' }, 503))
  await assertRejects(() => getUserId(URL, 'sb_publishable_x', 'jwt', down.fn), RpcError)
})

Deno.test('deleteAuthUser va removeObjects', async () => {
  const auth = fakeFetch(() => json({}))
  await deleteAuthUser(URL, 'sb_secret_x', 'u1', auth.fn)
  assertEquals([auth.calls[0].method, auth.calls[0].url], ['DELETE', `${URL}/auth/v1/admin/users/u1`])

  const storage = fakeFetch(() => json([{ name: 'h/t/a.jpg' }, { name: 'h/t/b.jpg' }]))
  assertEquals(await removeObjects(URL, 'sb_secret_x', 'receipts', ['h/t/a.jpg', 'h/t/b.jpg'], storage.fn), 2)
  assertEquals(storage.calls[0].url, `${URL}/storage/v1/object/receipts`)
  assertEquals(JSON.parse(storage.calls[0].body!), { prefixes: ['h/t/a.jpg', 'h/t/b.jpg'] })
})
