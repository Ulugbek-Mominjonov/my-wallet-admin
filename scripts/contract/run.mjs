#!/usr/bin/env node
// E09-T06: kontrakt testlari — contracts/fixtures/*.json holatlarini lokal
// bazaga yozib, RPC javobini kutilgan qiymat bilan solishtiradi (ADR-14).
// Mobil ilova xuddi shu fixture'larni o'z hisob-kitobi bilan tekshiradi.
//
//   DB_URL=postgresql://... node scripts/contract/run.mjs [fixture.json ...]
//
// Har holat alohida tranzaksiyada va oxirida ROLLBACK — baza toza qoladi.
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import postgres from 'postgres'

const DB_URL = process.env.DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const FIXTURES_DIR = 'contracts/fixtures'
const LOADER_FILE = 'scripts/contract/load_fixture.sql'

// Ruxsat etilgan RPC'lar va fixture `args` → pozitsion argumentlar.
const RPC_ARGS = {
  report_month: (args) => [args.month],
  report_year: (args) => [args.year],
  report_savings: () => [],
  report_personal_fund: (args) => [args.from, args.to],
  report_debts: () => [],
  report_goals: () => [],
  report_category_trend: (args) => [args.from, args.to, args.category ?? null],
  health_check: () => [],
}

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Kutilgan qiymat — javobning qismi: obyektda faqat ko'rsatilgan kalitlar
 * tekshiriladi. Kutilgan obyekt, javob esa `name` maydonli obyektlar
 * massivi bo'lsa — massiv nom bo'yicha lug'atga aylanadi va nomlar to'plami
 * aynan mos bo'lishi shart (ortiqcha yoki yetishmayotgan qator — xato).
 */
function compare(expected, actual, path, errors) {
  if (isObject(expected) && Array.isArray(actual) && actual.every((row) => isObject(row) && 'name' in row)) {
    const byName = Object.fromEntries(actual.map((row) => [row.name, row]))
    const want = Object.keys(expected).sort()
    const got = Object.keys(byName).sort()
    if (JSON.stringify(want) !== JSON.stringify(got)) {
      errors.push(`${path}: nomlar ${JSON.stringify(want)} kutilgan, ${JSON.stringify(got)} keldi`)
      return
    }
    for (const name of want) compare(expected[name], byName[name], `${path}[${name}]`, errors)
    return
  }
  if (isObject(expected)) {
    if (!isObject(actual)) {
      errors.push(`${path}: obyekt kutilgan, ${JSON.stringify(actual)} keldi`)
      return
    }
    for (const [key, value] of Object.entries(expected)) compare(value, actual[key], `${path}.${key}`, errors)
    return
  }
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length !== expected.length) {
      errors.push(`${path}: ${expected.length} ta element kutilgan, ${JSON.stringify(actual)} keldi`)
      return
    }
    expected.forEach((value, index) => compare(value, actual[index], `${path}[${index}]`, errors))
    return
  }
  if (expected !== actual) errors.push(`${path}: ${JSON.stringify(expected)} kutilgan, ${JSON.stringify(actual)} keldi`)
}

async function runCase(sql, loader, testCase) {
  const conn = await sql.reserve()
  try {
    await conn`begin`
    await conn.unsafe(loader)
    const [{ household_id: household, user_id: user }] =
      await conn`select * from pg_temp.load_fixture(${testCase}::jsonb)`
    await conn`select set_config('app.today', ${testCase.today}, true)`
    await conn`select set_config('request.jwt.claims', ${JSON.stringify({ sub: user, role: 'authenticated' })}, true)`
    await conn`set local role authenticated`

    const errors = []
    for (const [index, step] of testCase.expect.entries()) {
      const argsOf = RPC_ARGS[step.rpc]
      if (!argsOf) throw new Error(`noma'lum RPC: ${step.rpc}`)
      const args = [household, ...argsOf(step.args ?? {})]
      const placeholders = args.map((_, i) => `$${i + 1}`).join(', ')
      const [{ result }] = await conn.unsafe(`select public.${step.rpc}(${placeholders}) as result`, args)
      compare(step.result, result, `expect[${index}].${step.rpc}`, errors)
    }
    return errors
  } finally {
    await conn`rollback`
    conn.release()
  }
}

async function main() {
  const files = process.argv.length > 2
    ? process.argv.slice(2)
    : (await readdir(FIXTURES_DIR)).filter((file) => file.endsWith('.json')).sort().map((file) => join(FIXTURES_DIR, file))
  const loader = await readFile(LOADER_FILE, 'utf8')
  const sql = postgres(DB_URL, { max: 1, onnotice: () => {} })

  let number = 0
  let failed = 0
  try {
    for (const file of files) {
      const { cases } = JSON.parse(await readFile(file, 'utf8'))
      for (const testCase of cases) {
        number += 1
        const errors = await runCase(sql, loader, testCase)
        const label = `${file}: ${testCase.name}`
        if (errors.length === 0) {
          console.log(`ok ${number} - ${label}`)
        } else {
          failed += 1
          console.log(`not ok ${number} - ${label}`)
          for (const error of errors) console.log(`  # ${error}`)
        }
      }
    }
  } finally {
    await sql.end()
  }
  console.log(`1..${number}`)
  console.log(failed === 0 ? `# ${number} ta holat — hammasi mos` : `# ${failed}/${number} holat mos emas`)
  process.exitCode = failed === 0 ? 0 : 1
}

await main()
