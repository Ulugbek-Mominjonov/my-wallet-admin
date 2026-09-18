// fx-sync (BR-192): pg_cron kuniga bir marta chaqiradi — CBU kurslari →
// `fx_upsert` (faqat spravochnikdagi valyutalar). Skelet: joriy kurslar;
// tarixiy to'ldirish — E29-T01.
import { isAuthorizedCron } from '../_shared/cron.ts'
import { optionalEnv, requireEnv, serviceKey } from '../_shared/env.ts'
import { rpc } from '../_shared/supabase.ts'
import { CBU_URL, parseCbu } from './cbu.ts'

const CBU_TIMEOUT_MS = 15_000

Deno.serve(async (request) => {
  if (!isAuthorizedCron(request, optionalEnv('CRON_SECRET'))) {
    return new Response('forbidden', { status: 403 })
  }
  const response = await fetch(CBU_URL, { signal: AbortSignal.timeout(CBU_TIMEOUT_MS) })
  if (!response.ok) {
    console.error(`fx-sync: CBU ${response.status}`)
    return Response.json({ error: 'cbu_unavailable', status: response.status }, { status: 502 })
  }
  const rates = parseCbu(await response.json())
  const upserted = await rpc<number>('fx_upsert', { p_rates: rates }, {
    url: requireEnv('SUPABASE_URL'),
    key: serviceKey(),
  })
  return Response.json({ received: rates.length, upserted })
})
