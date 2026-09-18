// delete-account (BR-015): mobil ilova va admin panel (Google Play talabi —
// veb orqali ham) chaqiradi. verify_jwt = false: yangi imzo kalitlari bilan
// platforma tekshiruvi ishlamaydi — JWT'ni Auth'ning o'zi tekshiradi.
import { publishableKey, requireEnv, serviceKey } from '../_shared/env.ts'
import { deleteAuthUser, getUserId, rpc } from '../_shared/supabase.ts'
import { deleteAccount } from './account.ts'

// Brauzerdan (admin panel) chaqiriladi; cookie ishlatilmaydi — JWT sarlavhada.
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS })
  if (request.method !== 'POST') return new Response('method not allowed', { status: 405, headers: CORS_HEADERS })

  const url = requireEnv('SUPABASE_URL')
  const anonKey = publishableKey()
  const result = await deleteAccount(request.headers.get('authorization'), {
    userId: (jwt) => getUserId(url, anonKey, jwt),
    prepare: (jwt) => rpc('prepare_account_deletion', {}, { url, key: anonKey, userJwt: jwt }),
    deleteUser: (userId) => deleteAuthUser(url, serviceKey(), userId),
  })
  return Response.json(result.body, { status: result.status, headers: CORS_HEADERS })
})
