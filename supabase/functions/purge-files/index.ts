// purge-files: pg_cron kuniga bir marta (o'chiriladigan fayl bo'lsa) chaqiradi.
import { isAuthorizedCron } from '../_shared/cron.ts'
import { optionalEnv, requireEnv, serviceKey } from '../_shared/env.ts'
import { removeObjects, rpc } from '../_shared/supabase.ts'
import { purgeFiles } from './purge.ts'

const RECEIPTS_BUCKET = 'receipts'
// Storage API chegarasi — bitta so'rovda 1000 ta (SQL tomonda ham shu).
const BATCH_SIZE = 1000
const BUDGET_MS = 25_000

Deno.serve(async (request) => {
  if (!isAuthorizedCron(request, optionalEnv('CRON_SECRET'))) {
    return new Response('forbidden', { status: 403 })
  }
  const url = requireEnv('SUPABASE_URL')
  const key = serviceKey()
  const summary = await purgeFiles(
    {
      list: (limit) => rpc<string[]>('receipt_files_to_delete', { p_limit: limit }, { url, key }),
      remove: (paths) => removeObjects(url, key, RECEIPTS_BUCKET, paths),
    },
    { batchSize: BATCH_SIZE, budgetMs: BUDGET_MS },
  )
  return Response.json(summary)
})
