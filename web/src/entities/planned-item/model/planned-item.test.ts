import { describe, expect, it } from 'vitest'

import {
  planBoard,
  plannedStatus,
  type PlannedItem,
} from '@/entities/planned-item/model/planned-item'

const plan = (name: string, overrides: Partial<PlannedItem> = {}): PlannedItem => ({
  id: name,
  kind: 'expense',
  name,
  categoryId: null,
  accountId: null,
  plannedAmount: 1000,
  paidAmount: 0,
  dueDate: '2026-09-22',
  budgetMonth: '2026-09-01',
  autoPay: false,
  debtId: null,
  systemCode: null,
  settled: false,
  skipped: false,
  ...overrides,
})

const TODAY = '2026-09-22'

describe('plannedStatus (BR-071, private.planned_status)', () => {
  it('tartib: o‘tkazilgan → to‘langan → kechikkan → qisman → kutilmoqda', () => {
    expect(plannedStatus(plan('a', { skipped: true, settled: true }), TODAY)).toBe('skipped')
    expect(plannedStatus(plan('a', { settled: true, dueDate: '2026-09-01' }), TODAY)).toBe('paid')
    expect(plannedStatus(plan('a', { paidAmount: 500, dueDate: '2026-09-21' }), TODAY)).toBe(
      'overdue',
    )
    expect(plannedStatus(plan('a', { paidAmount: 500 }), TODAY)).toBe('partial')
    expect(plannedStatus(plan('a'), TODAY)).toBe('pending')
  })
})

describe('planBoard (mobil PlanBoard bilan bir xil)', () => {
  it('bo‘limlar va jami: to‘lanmagan qoldiq + noma‘lum summalar soni (BR-076)', () => {
    const board = planBoard(
      [
        plan('Ijara', { dueDate: '2026-09-05', paidAmount: 400 }),
        plan('Internet', { dueDate: TODAY }),
        plan('Svet', { dueDate: '2026-09-25', plannedAmount: null }),
        plan('Suv', { dueDate: '2026-09-25' }),
        plan('Kredit', { dueDate: '2026-09-26' }),
        plan('Sport', { paidAmount: 1000, settled: true }),
        plan('Kino', { skipped: true }),
      ],
      TODAY,
    )
    expect(board.overdue.map((p) => p.name)).toEqual(['Ijara'])
    expect(board.today.map((p) => p.name)).toEqual(['Internet'])
    expect(board.soon.map((p) => p.name)).toEqual(['Suv', 'Svet'])
    expect(board.later.map((p) => p.name)).toEqual(['Kredit'])
    expect(board.paid.map((p) => p.name)).toEqual(['Sport'])
    expect(board.skipped.map((p) => p.name)).toEqual(['Kino'])
    expect(board.unpaid).toBe(600 + 1000 + 1000 + 1000)
    expect(board.unknownCount).toBe(1)
  })
})
