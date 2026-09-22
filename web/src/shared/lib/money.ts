import { DEFAULT_LOCALE, INTL_LOCALE, type AppLocale } from '@/shared/config/locale'

/**
 * Pul summalari hamma joyda eng kichik birlikda butun son (tiyin/sent) —
 * BR-001. Kasr faqat shu yerda, ko'rsatishda paydo bo'ladi.
 */

/** ISO 4217 bo'yicha kasr xonalari. Ma'lumotnoma — `currencies.exponent` (E06). */
const CURRENCY_EXPONENT: Readonly<Record<string, number>> = { UZS: 2, USD: 2, EUR: 2, RUB: 2 }

/** UZS ekranda so'mgacha yaxlitlanadi va o'zimizning qo'shimcha bilan yoziladi. */
const UZS_SUFFIX: Record<AppLocale, string> = { uz: "so'm", ru: 'сум', en: 'UZS' }

const NBSP = ' '
const MINUS = '−'

export interface FormatMoneyOptions {
  currency?: string
  locale?: AppLocale
  /** `true` — musbat summa oldida ham `+` (o'zgarish/delta uchun). */
  signed?: boolean
}

export function currencyExponent(currency: string): number {
  return CURRENCY_EXPONENT[currency] ?? 2
}

/** Minglik guruhlari bo'lingan butun son: 1234567 → "1 234 567". */
function groupDigits(value: number): string {
  return Math.abs(value).toLocaleString('en-US', { maximumFractionDigits: 0 }).replaceAll(',', NBSP)
}

function signOf(value: number, signed: boolean): string {
  if (value < 0) return MINUS
  return signed && value > 0 ? '+' : ''
}

/**
 * @example formatMoney(123456700) // "1 234 567 so'm"
 * @example formatMoney(-50000, { signed: true }) // "−500 so'm"
 */
export function formatMoney(minor: number, options: FormatMoneyOptions = {}): string {
  const { currency = 'UZS', locale = DEFAULT_LOCALE, signed = false } = options
  const major = minor / 10 ** currencyExponent(currency)

  if (currency === 'UZS') {
    const whole = Math.round(major)
    return `${signOf(whole, signed)}${groupDigits(whole)}${NBSP}${UZS_SUFFIX[locale]}`
  }

  const formatted = new Intl.NumberFormat(INTL_LOCALE[locale], {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
  }).format(Math.abs(major))
  return `${signOf(major, signed)}${formatted}`
}

/**
 * Forma maydonidagi summa → eng kichik birlik (BR-001). Bo'shliqlar (guruh),
 * `,` yoki `.` kasr belgisi, boshida `-`/`−`; kasr xonalari valyutanikidan
 * ko'p bo'lsa yoki son bo'lmasa — `null`.
 *
 * @example parseMoney('1 234 567,5') // 123456750
 */
export function parseMoney(text: string, currency = 'UZS'): number | null {
  const exponent = currencyExponent(currency)
  const normalized = text.replace(/\s/g, '').replace(MINUS, '-').replace(',', '.')
  const match = new RegExp(`^(-?)(\\d+)(?:\\.(\\d{0,${String(exponent)}}))?$`).exec(normalized)
  if (!match) return null
  const [, sign = '', whole = '0', fraction = ''] = match
  const minor = Number(whole) * 10 ** exponent + Number(fraction.padEnd(exponent, '0') || '0')
  if (!Number.isSafeInteger(minor)) return null
  return sign === '-' ? -minor : minor
}

/**
 * Eng kichik birlik → forma maydoni matni (qo'shimchasiz, guruhlangan):
 * butun bo'lsa kasrsiz, aks holda `,` bilan.
 *
 * @example formatMoneyInput(150000000) // "1 500 000"
 */
export function formatMoneyInput(minor: number, currency = 'UZS'): string {
  const exponent = currencyExponent(currency)
  const unit = 10 ** exponent
  const whole = Math.trunc(Math.abs(minor) / unit)
  const fraction = Math.abs(minor) % unit
  const sign = minor < 0 ? '-' : ''
  const tail =
    fraction === 0 ? '' : `,${String(fraction).padStart(exponent, '0').replace(/0+$/, '')}`
  return `${sign}${groupDigits(whole)}${tail}`
}
