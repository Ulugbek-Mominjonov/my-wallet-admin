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
    // Har muhitning o'z boti bor — admin paneldagi ulash havolasi shundan
    // quriladi (`VITE_TELEGRAM_BOT`). Qiymat mobil bilan bir xil manbadan.
    variable: [{ name: 'TELEGRAM_BOT', source: 'TELEGRAM_BOT_USERNAME' }],
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
        for (const entry of envLevel[repo][kind]) {
          // Element — nom yoki {name, source}: bitta qiymat ikki repoda boshqa
          // nom bilan ketishi mumkin (TELEGRAM_BOT ↔ TELEGRAM_BOT_USERNAME).
          const name = entry.name ?? entry
          const base = entry.source ?? name
          list.push({ repo, source: `${base}_${env.toUpperCase()}`, name, kind, env })
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

// Yuborishdan oldingi ko'rinish tekshiruvi: noto'g'ri nusxalangan qiymat
// (masalan DB ulanish satri o'rniga API manzili) GitHub'ga chiqmasin.
const checks = [
  [/^SUPABASE_DB_URL_/, (v) => v.startsWith('postgres'), 'postgresql://… bilan boshlanadi (Connect → Session pooler)'],
  [/^SUPABASE_URL_/, (v) => v.startsWith('https://'), 'https://… bo\'lishi kerak'],
  [/^ADMIN_URL_/, (v) => v.startsWith('https://'), 'https://… bo\'lishi kerak'],
  [/^SUPABASE_PUBLISHABLE_KEY_/, (v) => v.startsWith('sb_publishable_'), 'sb_publishable_… bo\'lishi kerak'],
  [/^SUPABASE_SECRET_KEY_/, (v) => v.startsWith('sb_secret_'), 'sb_secret_… bo\'lishi kerak'],
  [/^SUPABASE_ACCESS_TOKEN$/, (v) => v.startsWith('sbp_'), 'sbp_… bo\'lishi kerak (Account → Access Tokens)'],
  [/^BACKUP_AGE_RECIPIENT$/, (v) => v.startsWith('age1'), 'age1… ochiq kalit bo\'lishi kerak'],
  [/^CLOUDFLARE_ACCOUNT_ID$/, (v) => /^[0-9a-f]{32}$/.test(v), '32 ta hex belgi'],
  [/TELEGRAM_BOT_TOKEN/, (v) => /^\d+:[\w-]+$/.test(v), '123456:ABC-… ko\'rinishida'],
  [/^OPS_TELEGRAM_CHAT_ID$/, (v) => /^-?\d+$/.test(v), 'butun son (manfiy ham bo\'ladi)'],
  [/^(DEPLOY_ENABLED|ANDROID_RELEASE_ENABLED)$/, (v) => v === 'true' || v === 'false', "'true' yoki 'false'"],
  [/^(FCM_SERVICE_ACCOUNT|FIREBASE_APPDIST_SA)_/, isServiceAccount, 'base64 qilingan servis akkaunt JSON'],
]

function isServiceAccount(value) {
  try {
    const json = JSON.parse(Buffer.from(value, 'base64').toString('utf8'))
    return Boolean(json.project_id && json.client_email && json.private_key)
  } catch {
    return false
  }
}

// Qiymat ko'rinishi noto'g'ri bo'lsa — sabab, to'g'ri bo'lsa bo'sh satr.
// `values` — boshqa qiymatga bog'liq tekshiruvlar uchun.
function invalid(name, value, values) {
  // PKCS12 keystore'da kalit paroli store paroli bilan bir xil bo'lishi shart
  // (keytool `-keypass` ni e'tiborga olmaydi) — aks holda Gradle imzolashda
  // "Given final block not properly padded" beradi.
  if (name === 'ANDROID_KEY_PASSWORD') {
    const store = values.get('ANDROID_KEYSTORE_PASSWORD') ?? ''
    const keystore = values.get('ANDROID_KEYSTORE_BASE64') ?? ''
    const header = Buffer.from(keystore.slice(0, 8), 'base64')
    const pkcs12 = header[0] === 0x30 && header[1] === 0x82
    if (pkcs12 && store && store !== value) {
      return "PKCS12 keystore: kalit paroli store paroli bilan bir xil bo'lishi kerak"
    }
  }
  // Ops chat ID botning o'z ID si bo'lsa, bot o'ziga yoza olmaydi (403).
  if (name === 'OPS_TELEGRAM_CHAT_ID') {
    const botId = (values.get('OPS_TELEGRAM_BOT_TOKEN') ?? '').split(':')[0]
    if (botId && botId === value) {
      return "bu botning o'z ID si — o'zingizning chat ID kerak (botga /start yozing)"
    }
  }
  // Nusxalashda qolib ketgan shablon: `[YOUR-PASSWORD]`, `<ref>` kabi.
  const placeholder = value.match(/\[[A-Za-z0-9_-]+\]|<[A-Za-z0-9_-]+>/)
  if (placeholder) return `shablon qolgan: ${placeholder[0]} — haqiqiy qiymat bilan almashtiring`
  for (const [pattern, ok, message] of checks) {
    if (pattern.test(name) && !ok(value)) return message
  }
  return ''
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

// Huquq xatosi bo'lsa qolgan 50 ta chaqiruv ham shunday tugaydi — to'xtaymiz.
function authFailure(error) {
  return error.startsWith('HTTP 401') || error.startsWith('HTTP 403')
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
    const problem = invalid(target.source, value, values)
    if (problem) {
      console.log(`  ❌ ${label}: ${target.source} — ${problem}`)
      failed += 1
      continue
    }
    if (dryRun) {
      console.log(`  → ${label}`)
      continue
    }
    const error = await upload(target, value)
    console.log(error ? `  ❌ ${label}: ${error}` : `  ✅ ${label}`)
    if (!error) {
      done += 1
      continue
    }
    failed += 1
    if (authFailure(error)) {
      console.log(
        '\nToken huquqi yetmaydi. Fine-grained tokenda shu 4 ruxsat' +
          " **Read and write** bo'lishi kerak (Read-only yetmaydi):\n" +
          '  Secrets · Variables · Environments · Administration\n' +
          "Mavjud tokenni tahrirlash kifoya (qiymati o'zgarmaydi):\n" +
          '  Settings → Developer settings → Fine-grained tokens → <token> → Permissions\n' +
          "Yoki klassik token: Settings → Developer settings → Tokens (classic) → `repo` scope.",
      )
      break
    }
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
