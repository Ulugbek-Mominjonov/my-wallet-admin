import type { DateString, MonthKey } from './types.js';

/** `Code.gs` dagi `OY_REGEX` ning aynan o'zi. */
export const MONTH_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export const isValidMonthKey = (value: unknown): value is MonthKey =>
  typeof value === 'string' && MONTH_KEY_PATTERN.test(value.trim());

const pad = (value: number, length = 2): string =>
  value.toString().padStart(length, '0');

/**
 * Sanadan oy kaliti. Sana LOKAL kun sifatida talqin qilinadi —
 * `new Date('2026-09-01')` UTC bo'lib ketishi mumkin, shuning uchun
 * `YYYY-MM-DD` matni qo'lda parse qilinadi.
 */
export const parseDate = (value: DateString): Date => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
};

export const formatDate = (date: Date): DateString =>
  `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const monthKeyOf = (date: Date): MonthKey =>
  `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}`;

export const monthKeyOfDateString = (value: DateString): MonthKey =>
  monthKeyOf(parseDate(value));

export const monthYear = (key: MonthKey): number => Number(key.slice(0, 4));

export const monthNumber = (key: MonthKey): number => Number(key.slice(5, 7));

/** `oySurish_` — oyni siljitadi (manfiy ham bo'ladi). */
export const shiftMonth = (key: MonthKey, months: number): MonthKey => {
  if (months === 0) return key;
  return monthKeyOf(new Date(monthYear(key), monthNumber(key) - 1 + months, 1));
};

export const daysInMonth = (key: MonthKey): number =>
  new Date(monthYear(key), monthNumber(key), 0).getDate();

/** Oy ichidagi kun; oy oxiridan oshsa qisiladi (`sanaYasa_`). */
export const dayOfMonth = (key: MonthKey, day: number): Date => {
  const last = daysInMonth(key);
  const clamped = Math.min(Math.max(day, 1), last);
  return new Date(monthYear(key), monthNumber(key) - 1, clamped);
};

/** Kun aniqligida solishtirish uchun — soat tashlab yuboriladi. */
export const dateOnly = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());
