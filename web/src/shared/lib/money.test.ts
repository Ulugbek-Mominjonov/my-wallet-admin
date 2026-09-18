import { describe, expect, it } from 'vitest'

import { formatMoney } from '@/shared/lib/money'

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
