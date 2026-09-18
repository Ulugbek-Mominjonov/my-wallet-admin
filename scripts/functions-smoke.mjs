#!/usr/bin/env node
// E11: Edge Functions uchidan-uchiga — lokal Supabase (edge runtime bilan).
// Deno unit testlari mantiqni tekshiradi; bu yerda — haqiqiy ulanishlar:
// kalitlar (sb_secret/sb_publishable), PostgREST RPC nomlari va parametrlari,
// Auth va Storage API'lari, sirli sarlavhalar.
//
//   make fn-smoke    (supabase/functions/.env — .env.example dan nusxa)
//
// Tashqi xizmatlar (FCM, Telegram API, cbu.uz) chaqirilmaydi: lokalda ular
// sozlanmagan — xabarlar "sozlanmagan" deb o'tkazilishi ham tekshiriladi.
import { execFileSync } from 'node:child_process'
import { randomBytes, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import postgres from 'postgres'

const status = JSON.parse(execFileSync('pnpm', ['exec', 'supabase', 'status', '-o', 'json'], { encoding: 'utf8' }))
const API = status.API_URL
const FUNCTIONS = status.FUNCTIONS_URL
const PUBLISHABLE_KEY = status.PUBLISHABLE_KEY
const SECRET_KEY = status.SECRET_KEY
const env = Object.fromEntries(
  readFileSync('supabase/functions/.env', 'utf8')
    .split('\n')
    .filter((line) => /^[A-Z_]+=/.test(line))
    .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]),
)

// pg_net so'rovi DB konteyneridan ketadi — Kong'ning docker ichidagi manzili.
const projectId = /^project_id\s*=\s*"([^"]+)"/m.exec(readFileSync('supabase/config.toml', 'utf8'))[1]
const INTERNAL_FUNCTIONS = `http://supabase_kong_${projectId}:8000/functions/v1`
// pg_net javobini kutish (asinxron).
const CRON_WAIT_MS = 15_000
const POLL_MS = 500

const sql = postgres(status.DB_URL, { max: 2, onnotice: () => {} })
const failures = []
const check = (ok, label, detail) => {
  console.log(`${ok ? 'ok' : 'not ok'} - ${label}${ok || detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`)
  if (!ok) failures.push(label)
}

async function call(name, { headers = {}, body = {} } = {}) {
  const response = await fetch(`${FUNCTIONS}/${name}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
  const text = await response.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    json = text
  }
  return { status: response.status, body: json }
}

const cron = { 'x-cron-secret': env.CRON_SECRET }

async function createUser(email, password) {
  const response = await fetch(`${API}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: SECRET_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password, email_confirm: true }),
  })
  if (!response.ok) throw new Error(`admin/users: ${response.status} ${await response.text()}`)
  return (await response.json()).id
}

async function signIn(email, password) {
  const response = await fetch(`${API}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: PUBLISHABLE_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!response.ok) throw new Error(`token: ${response.status} ${await response.text()}`)
  return (await response.json()).access_token
}

async function main() {
  // ─── Himoya: sirsiz chaqiruv ─────────────────────────────────────────────
  for (const name of ['notify-dispatch', 'purge-files', 'fx-sync']) {
    const denied = await call(name, { headers: { 'x-cron-secret': 'wrong' } })
    check(denied.status === 403, `${name}: noto'g'ri cron siri — 403`, denied)
  }
  const tgDenied = await call('telegram-webhook', { headers: { 'x-telegram-bot-api-secret-token': 'wrong' } })
  check(tgDenied.status === 403, "telegram-webhook: noto'g'ri secret_token — 403", tgDenied)
  const noJwt = await call('delete-account')
  check(noJwt.status === 401, "delete-account: JWT yo'q — 401", noJwt)

  const email = `smoke-${randomUUID().slice(0, 8)}@example.test`
  const password = randomBytes(18).toString('base64url')
  const user = await createUser(email, password)
  try {
    const [{ household }] = await sql`select last_household_id as household from public.profiles where user_id = ${user}`

    // ─── notify-dispatch: navbat → yuborish (FCM lokalda sozlanmagan) ───────
    await sql`insert into public.device_tokens (token, user_id, platform) values (${`smoke-${user}`}, ${user}, 'android')`
    const [{ id: messageId }] = await sql`
      insert into public.notification_outbox (user_id, household_id, channel, type, dedupe_key)
      values (${user}, ${household}, 'push', 'test', ${`smoke:${user}`}) returning id`
    const dispatched = await call('notify-dispatch', { headers: cron })
    const [message] = await sql`select status, error from public.notification_outbox where id = ${messageId}`
    check(
      dispatched.status === 200 && dispatched.body.processed >= 1 && message.status === 'skipped' &&
        message.error === 'push_not_configured',
      "notify-dispatch: navbatdan olindi va natija yozildi (sozlanmagan kanal — sababi bilan)",
      { dispatched, message },
    )

    // ─── pg_cron yo'li: jobs.run → Vault → pg_net → notify-dispatch ──────────
    await sql`select private.upsert_vault_secret(v.name, v.value)
                from (values ('edge_functions_url', ${INTERNAL_FUNCTIONS}), ('cron_secret', ${env.CRON_SECRET})) as v (name, value)`
    const [{ id: cronMessageId }] = await sql`
      insert into public.notification_outbox (user_id, household_id, channel, type, dedupe_key)
      values (${user}, ${household}, 'telegram', 'test', ${`smoke-cron:${user}`}) returning id`
    await sql`select jobs.run('dispatch_notifications')`
    let cronMessage
    for (let waited = 0; waited < CRON_WAIT_MS; waited += POLL_MS) {
      ;[cronMessage] = await sql`select status, error from public.notification_outbox where id = ${cronMessageId}`
      if (cronMessage.status !== 'pending' && cronMessage.status !== 'sending') break
      await new Promise((resolve) => setTimeout(resolve, POLL_MS))
    }
    check(
      cronMessage.status === 'skipped' && cronMessage.error === 'telegram_not_configured',
      "pg_cron yo'li: Vault'dagi manzil va sir bilan Edge Function chaqirildi",
      cronMessage,
    )

    // ─── telegram-webhook: /start <token>, /bugun, /stop ────────────────────
    const token = randomBytes(24).toString('base64url')
    await sql`insert into public.telegram_link_tokens (token, user_id, expires_at) values (${token}, ${user}, now() + interval '5 minutes')`
    const tg = { 'x-telegram-bot-api-secret-token': env.TELEGRAM_WEBHOOK_SECRET }
    const update = (text) => ({ message: { chat: { id: 900_000_001, type: 'private' }, text, from: { language_code: 'uz' } } })
    const linked = await call('telegram-webhook', { headers: tg, body: update(`/start ${token}`) })
    const [link] = await sql`select chat_id from public.telegram_links where user_id = ${user}`
    check(
      linked.status === 200 && linked.body.method === 'sendMessage' && linked.body.text.includes('ulandi') &&
        Number(link?.chat_id) === 900_000_001,
      'telegram-webhook: bir martalik token bilan ulandi',
      { linked, link },
    )
    const today = await call('telegram-webhook', { headers: tg, body: update('/bugun') })
    check(today.status === 200 && typeof today.body.text === 'string', 'telegram-webhook: /bugun javobi', today)
    const stopped = await call('telegram-webhook', { headers: tg, body: update('/stop') })
    const [{ count: links }] = await sql`select count(*)::int as count from public.telegram_links where user_id = ${user}`
    check(stopped.status === 200 && links === 0, 'telegram-webhook: /stop uzdi', { stopped, links })

    // ─── purge-files: byudjeti yo'q fayl Storage API orqali o'chadi ─────────
    const orphan = `${randomUUID()}/${randomUUID()}/smoke.jpg`
    const upload = await fetch(`${API}/storage/v1/object/receipts/${orphan}`, {
      method: 'POST',
      headers: { apikey: SECRET_KEY, 'content-type': 'image/jpeg' },
      body: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
    })
    check(upload.ok, 'storage: sinov fayli yuklandi', upload.status)
    const purged = await call('purge-files', { headers: cron })
    const [{ count: left }] = await sql`
      select count(*)::int as count from storage.objects where bucket_id = 'receipts' and name = ${orphan}`
    check(purged.status === 200 && purged.body.deleted >= 1 && left === 0, "purge-files: fayl o'chirildi", { purged, left })

    // ─── delete-account: foydalanuvchi JWT'i bilan ─────────────────────────
    const jwt = await signIn(email, password)
    const deleted = await call('delete-account', { headers: { authorization: `Bearer ${jwt}` } })
    const [{ users, households }] = await sql`
      select (select count(*)::int from auth.users where id = ${user}) as users,
             (select count(*)::int from public.households where id = ${household}) as households`
    check(
      deleted.status === 200 && deleted.body.deleted_households === 1 && users === 0 && households === 0,
      "delete-account: byudjet va auth foydalanuvchisi o'chirildi (BR-015)",
      { deleted, users, households },
    )
  } finally {
    // Xato bo'lsa ham iz qolmasin (kaskad: profil, byudjet, navbat, qurilma).
    await sql`delete from public.households h using public.household_members m
               where m.household_id = h.id and m.user_id = ${user}`
    await sql`delete from auth.users where id = ${user}`
  }
}

try {
  await main()
} catch (error) {
  failures.push(error.message)
  console.error(error)
} finally {
  await sql.end()
}
if (failures.length > 0) {
  console.error(`\n${failures.length} ta tekshiruv o'tmadi`)
  process.exit(1)
}
console.log('\nEdge Functions: hammasi joyida')
