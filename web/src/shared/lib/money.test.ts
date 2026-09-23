import { describe, expect, it } from 'vitest'

import { formatMoney, formatMoneyInput, parseMoney, parseRate } from '@/shared/lib/money'

const NBSP = ' '

describe('formatMoney (BR-001)', () => {
  it("UZS: tiyindan so'mga, minglik guruhlari bilan", () => {
    expect(formatMoney(123_456_700)).toBe(`1${NBSP}234${NBSP}567${NBSP}so'm`)
  })

  it("UZS: so'mgacha yaxlitlanadi", () => {
    expect(formatMoney(150)).toBe(`2${NBSP}so'm`)
  })

  it('manfiy summa haqiqiy minus belgisi bilan', () => {
    expect(formatMoney(-50_000)).toBe(`−500${NBSP}so'm`)
  })

  it("signed: musbat summa oldida '+'", () => {
    expect(formatMoney(120_000_000, { signed: true })).toBe(`+1${NBSP}200${NBSP}000${NBSP}so'm`)
    expect(formatMoney(0, { signed: true })).toBe(`0${NBSP}so'm`)
  })

  it('tilga qarab UZS qo‘shimchasi', () => {
    expect(formatMoney(100_00, { locale: 'ru' })).toBe(`100${NBSP}сум`)
    expect(formatMoney(100_00, { locale: 'en' })).toBe(`100${NBSP}UZS`)
  })

  it('boshqa valyutalar — Intl, sent bilan', () => {
    expect(formatMoney(123_45, { currency: 'USD', locale: 'en' })).toBe('$123.45')
  })
})

describe('parseMoney / formatMoneyInput', () => {
  it.each([
    ['1 234 567', 123456700],
    ['1 234 567,5', 123456750],
    ['0.01', 1],
    ['-500', -50000],
    ['−500', -50000],
    ['12,', 1200],
  ])('%s → %d tiyin', (text, minor) => {
    expect(parseMoney(text)).toBe(minor)
  })

  it.each(['', 'abc', '1,234', '1.2.3', '--5', '1e5'])('%s — son emas', (text) => {
    expect(parseMoney(text)).toBeNull()
  })

  it('forma matni: butun — kasrsiz, qolgani vergul bilan; qaytadan o‘qiladi', () => {
    expect(formatMoneyInput(150000000)).toBe('1 500 000')
    expect(formatMoneyInput(123456750)).toBe('1 234 567,5')
    expect(formatMoneyInput(-1)).toBe('-0,01')
    for (const minor of [0, 1, 99, 150000000, -123456750]) {
      expect(parseMoney(formatMoneyInput(minor))).toBe(minor)
    }
  })
})

describe('parseRate (E29-T04, BR-191)', () => {
  it('musbat o‘nlik son (6 xonagacha); boshqasi — null', () => {
    expect(parseRate('12650.55')).toBe(12650.55)
    expect(parseRate('1,5')).toBe(1.5)
    expect(parseRate('12 650')).toBeNull()
    expect(parseRate('0')).toBeNull()
    expect(parseRate('-1')).toBeNull()
    expect(parseRate('1.1234567')).toBeNull()
  })
})
