#!/usr/bin/env node
// E10-T04: sinxron kursori parallel yozuvda qator o'tkazib yubormaydi
// (ARXITEKTURA 6: byudjet bo'yicha advisory lock → row_version commit
// tartibida). pgTAP bitta sessiyada ishlaydi — bu yerda haqiqiy parallel
// ulanishlar:
//
//   A: byudjet H ga yozadi (commit qilmaydi — lock ushlab turadi)
//   B: H ga yozadi → A tugaguncha kutishi SHART
//   C: boshqa byudjetga yozadi → kutmasligi SHART
//   R: A commit'dan keyin, B commit'dan oldin pull qiladi; keyingi pull B ni
//      albatta oladi (B versiyasi > A versiyasi)
//
//   DB_URL=postgresql://... node scripts/contract/sync-concurrency.mjs
import { randomUUID } from 'node:crypto'
import postgres from 'postgres'

const DB_URL = process.env.DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
// Bloklangan so'rov shu vaqt ichida tugamasligi, bloklanmagani esa tugashi kerak.
const BLOCK_PROBE_MS = 500

const sql = postgres(DB_URL, { max: 5, onnotice: () => {} })
const failures = []
const check = (ok, label) => {
  console.log(`${ok ? 'ok' : 'not ok'} - ${label}`)
  if (!ok) failures.push(label)
}
const settledWithin = (promise, ms) =>
  Promise.race([promise.then(() => true), new Promise((resolve) => setTimeout(() => resolve(false), ms))])

async function createHousehold(email) {
  const [{ id: user }] = await sql`
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                            email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    values ('00000000-0000-0000-0000-000000000000', ${randomUUID()}, 'authenticated', 'authenticated',
            ${email}, '', now(), '{}', '{}', now(), now())
    returning id`
  const [{ household, account, category }] = await sql`
    select p.last_household_id as household,
           (select a.id from public.accounts a where a.household_id = p.last_household_id and a.type = 'card') as account,
           (select c.id from public.categories c where c.household_id = p.last_household_id and c.name = 'Oziq-ovqat') as category
      from public.profiles p where p.user_id = ${user}`
  return { user, household, account, category }
}

const insertTransaction = (conn, h) => conn`
  insert into public.transactions (household_id, kind, account_id, amount, category_id, occurred_on, budget_month)
  values (${h.household}, 'expense', ${h.account}, 1000, ${h.category}, '2026-10-01', '2026-10-01')
  returning id, row_version`

async function pull(conn, h, cursor) {
  await conn`select set_config('request.jwt.claims', ${JSON.stringify({ sub: h.user, role: 'authenticated' })}, false)`
  await conn`set role authenticated`
  const [{ result }] = await conn`select public.sync_pull(${h.household}, ${cursor}) as result`
  await conn`reset role`
  return result
}

async function main() {
  const run = randomUUID().slice(0, 8)
  const home = await createHousehold(`sync-a-${run}@example.test`)
  const other = await createHousehold(`sync-b-${run}@example.test`)
  const [a, b, c, r] = await Promise.all([sql.reserve(), sql.reserve(), sql.reserve(), sql.reserve()])
  try {
    const start = await pull(r, home, 0)
    const cursor0 = start.next_cursor

    await a`begin`
    const [rowA] = await insertTransaction(a, home)

    await b`begin`
    const pendingB = insertTransaction(b, home)
    check(!(await settledWithin(pendingB, BLOCK_PROBE_MS)), "B shu byudjetga yozuvda A ni kutadi (advisory lock)")

    await c`begin`
    const otherDone = await settledWithin(insertTransaction(c, other), BLOCK_PROBE_MS)
    check(otherDone, 'boshqa byudjetga yozuv bloklanmaydi')
    await c`commit`

    const beforeCommit = await pull(r, home, cursor0)
    check(beforeCommit.changes.length === 0, "commit qilinmagan yozuvlar pull'da ko'rinmaydi")

    await a`commit`
    const [rowB] = await pendingB
    const afterA = await pull(r, home, cursor0)
    check(afterA.changes.map((change) => change.row.id).join() === rowA.id, "A commit'dan keyin faqat A (B hali commit qilinmagan)")
    await b`commit`

    check(BigInt(rowB.row_version) > BigInt(rowA.row_version), "B versiyasi A nikidan katta (commit tartibi)")
    const afterB = await pull(r, home, afterA.next_cursor)
    check(afterB.changes.map((change) => change.row.id).join() === rowB.id, "keyingi pull B ni oladi — hech narsa o'tkazib yuborilmadi")
  } finally {
    for (const conn of [a, b, c, r]) {
      await conn`rollback`.catch(() => {})
      conn.release()
    }
    await sql`delete from public.households where id in (${home.household}, ${other.household})`
    await sql`delete from auth.users where id in (${home.user}, ${other.user})`
    await sql.end()
  }
  console.log(failures.length === 0 ? '# parallel sinxron: hammasi mos' : `# ${failures.length} ta tekshiruv xato`)
  process.exitCode = failures.length === 0 ? 0 : 1
}

await main()
