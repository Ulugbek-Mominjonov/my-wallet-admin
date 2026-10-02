#!/usr/bin/env node
// E03-T08: `.env.deploy` dagi qiymatlarni GitHub'ga yuklaydi — repo
// o'zgaruvchilari, repo sirlari va `staging` / `production` muhitlari
// (DEPLOY.md 9-bo'lim). Bo'sh yoki yo'q qiymat o'tkazib yuboriladi; qayta
// ishga tushirish xavfsiz (mavjud qiymat ustiga yoziladi).
//
//   GITHUB_TOKEN=… make github-secrets                 # ikkala repo
//   GITHUB_TOKEN=… make github-secrets ARGS=--dry-run  # faqat ko'rsatadi
//   GITHUB_TOKEN=… make github-secrets ARGS=--repo=mobil
//   node scripts/github-secrets.mjs --template >> .env.deploy   # bo'sh nomlar
//
// Token: klassik `repo` scope, yoki fine-grained — Administration,
// Environments, Secrets va Variables (Read and write) shu ikki repoga.
// Token va qiymatlar logga chiqmaydi: faqat nom va natija ko'rinadi.
// Muhitlar oldin yaratilgan bo'lishi kerak (`make github-setup`).
import { readFileSync } from 'node:fs'
import sodium from 'libsodium-wrappers'

const OWNER = process.env.GITHUB_OWNER || 'Ulugbek-Mominjonov'
const API = process.env.GITHUB_API || 'https://api.github.com'
const TOKEN = process.env.GITHUB_TOKEN
const ENVS = ['staging', 'production']
const REPOS = { admin: 'my-wallet-admin', mobil: 'my-wallet-mobil' }

// Repo darajasidagi nomlar — `.env.deploy` dagi nom bilan bir xil.
const repoLevel = {
  admin: {
    variable: [
      'DEPLOY_ENABLED',
      'SUPABASE_PROJECT_REF_STAGING',
      'SUPABASE_PROJECT_REF_PRODUCTION',
      'SUPABASE_URL_STAGING',
      'SUPABASE_URL_PRODUCTION',
      'SUPABASE_PUBLISHABLE_KEY_STAGING',
      'SUPABASE_PUBLISHABLE_KEY_PRODUCTION',
      'ADMIN_URL_STAGING',
      'ADMIN_URL_PRODUCTION',
      'CLOUDFLARE_ACCOUNT_ID',
      'BACKUP_AGE_RECIPIENT',
      'OPS_TELEGRAM_CHAT_ID',
      'TELEGRAM_BOT',
    ],
    secret: [
      'SUPABASE_ACCESS_TOKEN',
      'SUPABASE_DB_URL_PRODUCTION',
      'CLOUDFLARE_API_TOKEN',
      'OPS_TELEGRAM_BOT_TOKEN',
    ],
  },
  mobil: {
    variable: ['GOOGLE_WEB_CLIENT_ID', 'ANDROID_RELEASE_ENABLED'],
    secret: [
      'ANDROID_KEYSTORE_BASE64',
      'ANDROID_KEYSTORE_PASSWORD',
      'ANDROID_KEY_ALIAS',
      'ANDROID_KEY_PASSWORD',
    ],
  },
}

// Muhit darajasi: GitHub'dagi nom shu, manbasi esa `<nom>_STAGING` / `_PRODUCTION`.
const envLevel = {
  admin: {
    variable: [],
    secret: [
      'SUPABASE_DB_PASSWORD',
      'SUPABASE_SECRET_KEY',
      'CRON_SECRET',
      'TELEGRAM_BOT_TOKEN',
      'TELEGRAM_WEBHOOK_SECRET',
      'FCM_SERVICE_ACCOUNT',
    ],
  },
  mobil: {
    variable: [
      'SUPABASE_URL',
      'SUPABASE_PUBLISHABLE_KEY',
      'TELEGRAM_BOT_USERNAME',
      'FIREBASE_API_KEY',
      'FIREBASE_APP_ID_ANDROID',
      'FIREBASE_MESSAGING_SENDER_ID',
      'FIREBASE_PROJECT_ID',
    ],
    secret: ['FIREBASE_APPDIST_SA'],
  },
}

// Barcha nishonlar: { repo, source (fayldagi nom), name (GitHub'dagi), kind, env }.
function targets() {
  const list = []
  // Tartib = chiqishdagi guruhlar: repo, so'ng har muhit (bir guruh — bir sarlavha).
  for (const repo of Object.keys(REPOS)) {
    for (const kind of ['variable', 'secret']) {
      for (const name of repoLevel[repo][kind]) {
        list.push({ repo, source: name, name, kind })
      }
    }
    for (const env of ENVS) {
      for (const kind of ['variable', 'secret']) {
        for (const name of envLevel[repo][kind]) {
          list.push({ repo, source: `${name}_${env.toUpperCase()}`, name, kind, env })
        }
      }
    }
  }
  return list
}

// `NAME=VALUE` satrlari; `#` izohlar va bo'sh satrlar tashlanadi. Bo'sh qiymat
// ham yoziladi: `--template` faylda turgan nomni qayta qo'shmasligi uchun.
function readValues(path) {
  const values = new Map()
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const text = line.trim()
    if (!text || text.startsWith('#')) continue
    const eq = text.indexOf('=')
    if (eq < 1) continue
    let value = text.slice(eq + 1).trim()
    const quote = value.at(0)
    if (value.length > 1 && (quote === '"' || quote === "'") && value.at(-1) === quote) {
      value = value.slice(1, -1)
    }
    values.set(text.slice(0, eq), value)
  }
  return values
}

async function call(method, path, body) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${TOKEN}`,
      'x-github-api-version': '2022-11-28',
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  // Tana faqat ochiq kalit va xato sababi uchun kerak — logga chiqarilmaydi.
  return { ok: response.ok, status: response.status, text: await response.text() }
}

// Sirlar GitHub'ning ochiq kaliti bilan shifrlanadi (libsodium sealed box).
const publicKeys = new Map()

async function publicKeyFor(path) {
  const cached = publicKeys.get(path)
  if (cached) return cached
  const result = await call('GET', `${path}/public-key`)
  if (!result.ok) throw new Error(`ochiq kalit olinmadi: ${reason(result)}`)
  const key = JSON.parse(result.text || '{}')
  publicKeys.set(path, key)
  return key
}

function seal(value, publicKey) {
  const variant = sodium.base64_variants.ORIGINAL
  const sealed = sodium.crypto_box_seal(
    sodium.from_string(value),
    sodium.from_base64(publicKey, variant),
  )
  return sodium.to_base64(sealed, variant)
}

function basePath({ repo, kind, env }) {
  const base = `/repos/${OWNER}/${REPOS[repo]}`
  const group = kind === 'secret' ? 'secrets' : 'variables'
  return env ? `${base}/environments/${env}/${group}` : `${base}/actions/${group}`
}

// Bitta qiymatni yuklaydi; xato bo'lsa — sababi, bo'lmasa bo'sh satr.
async function upload(target, value) {
  const path = basePath(target)
  if (target.kind === 'secret') {
    const key = await publicKeyFor(path)
    const result = await call('PUT', `${path}/${target.name}`, {
      encrypted_value: seal(value, key.key),
      key_id: key.key_id,
    })
    return result.ok ? '' : reason(result)
  }
  // O'zgaruvchi: avval yangilash, bo'lmasa (404) — yaratish.
  const patch = await call('PATCH', `${path}/${target.name}`, { name: target.name, value })
  if (patch.ok) return ''
  if (patch.status !== 404) return reason(patch)
  const post = await call('POST', path, { name: target.name, value })
  return post.ok ? '' : reason(post)
}

function reason({ status, text }) {
  let message = ''
  try {
    message = JSON.parse(text).message || ''
  } catch {
    message = ''
  }
  if (status === 404 && !message) message = 'topilmadi — muhit yaratilganmi? (make github-setup)'
  return `HTTP ${status}${message ? ` — ${message}` : ''}`
}

// Faylning izoh sarlavhasi — `--help` uchun.
function usage() {
  return readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 14).join('\n')
}

// Faylda yo'q nomlarni `NAME=` ko'rinishida guruhlab chiqaradi.
function template(values) {
  const groups = new Map()
  // Bir nom ikki joyga ketishi mumkin (masalan `SUPABASE_URL_PRODUCTION`) —
  // faylda bir marta turadi.
  const seen = new Set()
  for (const target of targets()) {
    if (values.has(target.source) || seen.has(target.source)) continue
    seen.add(target.source)
    const where = `${REPOS[target.repo]}${target.env ? ` / ${target.env}` : ''}`
    const title = `${where} — ${target.kind === 'secret' ? 'sirlar' : "o'zgaruvchilar"}`
    const names = groups.get(title) ?? new Set()
    names.add(target.source)
    groups.set(title, names)
  }
  const lines = []
  for (const [title, names] of groups) {
    lines.push(`\n# --- ${title} ---`)
    for (const name of names) lines.push(`${name}=`)
  }
  return lines.join('\n')
}

async function main() {
  const args = process.argv.slice(2)
  if (args.includes('-h') || args.includes('--help')) {
    console.log(usage())
    return 0
  }
  const dryRun = args.includes('--dry-run')
  const asTemplate = args.includes('--template')
  const repoArg = args.find((a) => a.startsWith('--repo='))?.slice('--repo='.length)
  const file = args.find((a) => !a.startsWith('--')) ?? '.env.deploy'
  if (repoArg && !(repoArg in REPOS)) {
    console.error(`--repo= qiymati: ${Object.keys(REPOS).join(' yoki ')}`)
    return 2
  }
  if (!TOKEN && !dryRun && !asTemplate) {
    console.error("GITHUB_TOKEN kerak (env orqali): DEPLOY.md 9-bo'lim")
    return 2
  }

  let values
  try {
    values = readValues(file)
  } catch {
    if (!asTemplate) {
      console.error(`${file} o'qilmadi — avval \`make deploy-env\` ishga tushiring`)
      return 2
    }
    values = new Map()
  }

  if (asTemplate) {
    console.log(template(values))
    return 0
  }

  await sodium.ready
  let done = 0
  let failed = 0
  const missing = new Set()
  let group = ''

  for (const target of targets()) {
    if (repoArg && target.repo !== repoArg) continue
    const value = values.get(target.source)
    if (!value) {
      missing.add(target.source)
      continue
    }
    const where = `${REPOS[target.repo]}${target.env ? ` / ${target.env}` : ''}`
    if (where !== group) {
      console.log(`\n${where}:`)
      group = where
    }
    const label = `${target.kind === 'secret' ? 'sir' : "o'zgaruvchi"} ${target.name}`
    if (dryRun) {
      console.log(`  → ${label}`)
      continue
    }
    const error = await upload(target, value)
    console.log(error ? `  ❌ ${label}: ${error}` : `  ✅ ${label}`)
    if (error) failed += 1
    else done += 1
  }

  console.log(
    dryRun
      ? '\nSinov ishi — hech narsa yuborilmadi.'
      : `\nYuklandi: ${done}${failed ? `, xato: ${failed}` : ''}`,
  )
  if (missing.size) {
    console.log(`${file} da yo'q yoki bo'sh (${missing.size} ta): ${[...missing].join(', ')}`)
  }
  return failed ? 1 : 0
}

process.exit(await main())
