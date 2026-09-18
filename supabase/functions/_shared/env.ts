// Edge Function muhit o'zgaruvchilari — sirlar faqat shu yerdan (kodda yo'q).
// SUPABASE_* nomlarini platforma o'zi beradi (o'zimiz o'rnata olmaymiz).

export class ConfigError extends Error {
  constructor(name: string) {
    super(`muhit o'zgaruvchisi yo'q: ${name}`)
    this.name = 'ConfigError'
  }
}

export function requireEnv(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new ConfigError(name)
  return value
}

export const optionalEnv = (name: string): string | undefined => Deno.env.get(name) || undefined

/** Yangi kalitlar JSON ko'rinishida keladi: {"default": "sb_secret_..."}. */
function platformKey(keysVar: string, legacyVar: string): string {
  const keys = optionalEnv(keysVar)
  if (keys) {
    const parsed: Record<string, string> = JSON.parse(keys)
    const key = parsed.default ?? Object.values(parsed)[0]
    if (key) return key
  }
  const legacy = optionalEnv(legacyVar)
  if (!legacy) throw new ConfigError(keysVar)
  return legacy
}

/** Service kaliti: `sb_secret_...` yoki eski service_role JWT. */
export const serviceKey = (): string => platformKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY')

/** Ochiq kalit (foydalanuvchi JWT'i bilan chaqiruvlar uchun). */
export const publishableKey = (): string => platformKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY')
