import { DEFAULT_LOCALE, type AppLocale } from '@/shared/config/locale'

/**
 * Oy kaliti — `YYYY-MM` (BR-040..046). Byudjet hisobi shu kalit bo'yicha.
 * Sanalar byudjet vaqt zonasida (BR-002, standart Asia/Tashkent).
 */
export type MonthKey = `${number}-${string}`

const MONTH_KEY_RE = /^(\d{4})-(0[1-9]|1[0-2])$/

export const DEFAULT_TIMEZONE = 'Asia/Tashkent'

const MONTH_NAMES: Record<AppLocale, readonly string[]> = {
  uz: [
    'Yanvar',
    'Fevral',
    'Mart',
    'Aprel',
    'May',
    'Iyun',
    'Iyul',
    'Avgust',
    'Sentabr',
    'Oktabr',
    'Noyabr',
    'Dekabr',
  ],
  ru: [
    'Январь',
    'Февраль',
    'Март',
    'Апрель',
    'Май',
    'Июнь',
    'Июль',
    'Август',
    'Сентябрь',
    'Октябрь',
    'Ноябрь',
    'Декабрь',
  ],
  en: [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ],
}

export function isMonthKey(value: string): value is MonthKey {
  return MONTH_KEY_RE.test(value)
}

export function parseMonthKey(value: string): { year: number; month: number } {
  const match = MONTH_KEY_RE.exec(value)
  if (!match) throw new Error(`Oy YYYY-MM ko'rinishida bo'lishi kerak: ${value}`)
  return { year: Number(match[1]), month: Number(match[2]) }
}

export function toMonthKey(year: number, month: number): MonthKey {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}` as MonthKey
}

/** Oyni `delta` ga suradi (manfiy ham bo'ladi): shiftMonth('2026-01', -1) → '2025-12'. */
export function shiftMonth(key: string, delta: number): MonthKey {
  const { year, month } = parseMonthKey(key)
  const index = year * 12 + (month - 1) + delta
  return toMonthKey(Math.floor(index / 12), (index % 12) + 1)
}

/** Berilgan vaqt zonasidagi joriy oy. */
export function currentMonthKey(now = new Date(), timeZone = DEFAULT_TIMEZONE): MonthKey {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now)
  const year = Number(parts.find((part) => part.type === 'year')?.value)
  const month = Number(parts.find((part) => part.type === 'month')?.value)
  return toMonthKey(year, month)
}

/** formatMonth('2026-09') → "Sentabr 2026". */
export function formatMonth(key: string, locale: AppLocale = DEFAULT_LOCALE): string {
  const { year, month } = parseMonthKey(key)
  return `${MONTH_NAMES[locale][month - 1] ?? ''} ${String(year)}`
}
