// Pul — hamma joyda eng kichik birlikda butun son (BR-001). Formatlash admin
// (web/src/shared/lib/money.ts) va mobil (lib/core/format/money_format.dart)
// bilan aynan bir xil — testlar ham bir xil holatlar bilan.

export type Locale = 'uz' | 'ru' | 'en'

export const LOCALES: readonly Locale[] = ['uz', 'ru', 'en']

/** ISO 4217 kasr xonalari (ma'lumotnoma — `currencies.exponent`). */
const CURRENCY_EXPONENT: Readonly<Record<string, number>> = { UZS: 2, USD: 2, EUR: 2, RUB: 2 }

/** UZS so'mgacha yaxlitlanadi va o'zimizning qo'shimcha bilan yoziladi. */
const UZS_SUFFIX: Readonly<Record<Locale, string>> = { uz: "so'm", ru: 'сум', en: 'UZS' }

const INTL_LOCALE: Readonly<Record<Locale, string>> = { uz: 'uz-Latn-UZ', ru: 'ru-RU', en: 'en-GB' }

const NBSP = ' '
const MINUS = '−'

export function toLocale(value: string | null | undefined): Locale {
  return LOCALES.includes(value as Locale) ? (value as Locale) : 'uz'
}

function groupDigits(value: number): string {
  return Math.abs(value).toLocaleString('en-US', { maximumFractionDigits: 0 }).replaceAll(',', NBSP)
}

export function formatMoney(minor: number, locale: Locale = 'uz', currency = 'UZS'): string {
  const major = minor / 10 ** (CURRENCY_EXPONENT[currency] ?? 2)
  if (currency === 'UZS') {
    const whole = Math.round(major)
    return `${whole < 0 ? MINUS : ''}${groupDigits(whole)}${NBSP}${UZS_SUFFIX[locale]}`
  }
  const formatted = new Intl.NumberFormat(INTL_LOCALE[locale], {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
  }).format(Math.abs(major))
  return `${major < 0 ? MINUS : ''}${formatted}`
}
