// fx-sync (BR-192): pg_cron kuniga bir marta chaqiradi — CBU kurslari →
// `fx_upsert` (faqat spravochnikdagi valyutalar). Joriy kurslardan keyin
// tarixiy to'ldirish paketi (E29-T01) bajariladi.
import { isAuthorizedCron } from '../_shared/cron.ts'
import { optionalEnv, requireEnv, serviceKey } from '../_shared/env.ts'
import { rpc } from '../_shared/supabase.ts'
import { backfillRates } from './backfill.ts'
import { CBU_URL, cbuDateUrl, parseCbu } from './cbu.ts'

const CBU_TIMEOUT_MS = 15_000
/** Bir chaqiruvdagi tarixiy sanalar va ularga ajratilgan vaqt. */
const BACKFILL_LIMIT = 60
const BACKFILL_BUDGET_MS = 60_000

Deno.serve(async (request) => {
  if (!isAuthorizedCron(request, optionalEnv('CRON_SECRET'))) {
    return new Response('forbidden', { status: 403 })
  }
  const target = { url: requireEnv('SUPABASE_URL'), key: serviceKey() }
  const fetchRates = async (url: string) => {
    const response = await fetch(url, { signal: AbortSignal.timeout(CBU_TIMEOUT_MS) })
    if (!response.ok) throw new Error(`CBU ${response.status}`)
    return await response.json()
  }

  let rates
  try {
    rates = parseCbu(await fetchRates(CBU_URL))
  } catch (error) {
    console.error(`fx-sync: ${String(error)}`)
    return Response.json({ error: 'cbu_unavailable' }, { status: 502 })
  }
  const upserted = await rpc<number>('fx_upsert', { p_rates: rates }, target)

  // Tarixiy to'ldirish: xatosi kunlik sinxronni yiqitmaydi.
  let backfill = { dates: 0, rates: 0, done: true }
  try {
    backfill = await backfillRates({
      dates: () =>
        rpc<{ dates: string[]; done: boolean }>(
          'fx_backfill_dates',
          { p_limit: BACKFILL_LIMIT },
          target,
        ),
      ratesFor: async (date) => {
        // Bo'sh yoki kutilmagan javob (dam olish kuni) — o'sha sana tashlanadi.
        try {
          return parseCbu(await fetchRates(cbuDateUrl(date)))
        } catch {
          return []
        }
      },
      upsert: (batch) => rpc<number>('fx_upsert', { p_rates: batch }, target),
      mark: async (until) => {
        await rpc<null>('fx_backfill_mark', { p_until: until }, target)
      },
    }, { budgetMs: BACKFILL_BUDGET_MS })
  } catch (error) {
    console.error(`fx-sync backfill: ${String(error)}`)
  }

  return Response.json({ received: rates.length, upserted, backfill })
})
