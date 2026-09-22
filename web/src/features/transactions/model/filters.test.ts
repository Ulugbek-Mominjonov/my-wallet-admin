import { describe, expect, it } from 'vitest'

import {
  activeFilterCount,
  clearFilters,
  periodOf,
  toRpcFilters,
  transactionSearchSchema,
} from '@/features/transactions/model/filters'

const ACCOUNT = '0198f000-0000-7000-8000-00000000000a'
const CATEGORY = '0198f000-0000-7000-8000-00000000000c'

describe('transactionSearchSchema (URL)', () => {
  it("to'g'ri qiymatlarni o'qiydi, qidiruvni kesadi", () => {
    expect(
      transactionSearchSchema.parse({
        month: '2026-09',
        kinds: ['expense'],
        accounts: [ACCOUNT],
        min: 100000,
        q: '  korzinka ',
      }),
    ).toEqual({
      month: '2026-09',
      kinds: ['expense'],
      accounts: [ACCOUNT],
      min: 100000,
      q: 'korzinka',
    })
  })

  it('buzilgan havola sahifani yiqitmaydi — yaroqsiz maydon tashlanadi', () => {
    expect(
      transactionSearchSchema.parse({
        month: '2026-13',
        from: '22.09.2026',
        kinds: ['refund'],
        accounts: ['not-an-id'],
        min: -5,
        max: 1.5,
        q: '   ',
        tags: [],
      }),
    ).toEqual({})
  })

  it('`all` — butun tarix', () => {
    expect(transactionSearchSchema.parse({ month: 'all' })).toEqual({ month: 'all' })
  })
})

describe('periodOf / toRpcFilters', () => {
  it('standart — joriy oy (URL toza)', () => {
    expect(periodOf({}, '2026-09')).toEqual({ mode: 'month', month: '2026-09' })
    expect(toRpcFilters({}, '2026-09')).toEqual({ month: '2026-09-01' })
  })

  it('sana oralig‘i oydan ustun; `all` — oy filtri yo‘q', () => {
    expect(toRpcFilters({ month: '2026-08', from: '2026-01-01' }, '2026-09')).toEqual({
      from: '2026-01-01',
    })
    expect(toRpcFilters({ month: 'all', q: 'evos' }, '2026-09')).toEqual({ q: 'evos' })
  })

  it('ro‘yxat, summa va qidiruv filtrlari RPC ga o‘tadi', () => {
    expect(
      toRpcFilters(
        { month: '2026-08', categories: [CATEGORY], kinds: ['income'], min: 0, max: 500000 },
        '2026-09',
      ),
    ).toEqual({
      month: '2026-08-01',
      categories: [CATEGORY],
      kinds: ['income'],
      min: 0,
      max: 500000,
    })
  })
})

describe('activeFilterCount / clearFilters', () => {
  const search = {
    month: '2026-08' as const,
    kinds: ['expense' as const],
    accounts: [ACCOUNT],
    min: 100,
    max: 200,
    q: 'zara',
  }

  it('davr hisoblanmaydi; summa oralig‘i — bitta filtr', () => {
    expect(activeFilterCount({ month: '2026-08' })).toBe(0)
    expect(activeFilterCount(search)).toBe(4)
  })

  it('tozalash davrni saqlaydi', () => {
    expect(clearFilters(search)).toEqual({ month: '2026-08' })
  })
})
