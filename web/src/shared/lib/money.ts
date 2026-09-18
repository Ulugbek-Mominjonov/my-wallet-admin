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
