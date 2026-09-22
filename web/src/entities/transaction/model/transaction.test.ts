import { describe, expect, it } from 'vitest'

import { autoBudgetMonth } from '@/entities/transaction/model/transaction'

describe('autoBudgetMonth (BR-040..046)', () => {
  it('xarajat va o‘tkazma — sana oyi', () => {
    for (const kind of ['expense', 'transfer'] as const) {
      expect(
        autoBudgetMonth({ kind, occurredOn: '2026-10-02', monthShift: -1, planMonth: null }),
      ).toBe('2026-10')
    }
  })

  it('daromad — sana oyi + kategoriya siljishi (yil chegarasida ham)', () => {
    expect(
      autoBudgetMonth({
        kind: 'income',
        occurredOn: '2026-10-02',
        monthShift: -1,
        planMonth: null,
      }),
    ).toBe('2026-09')
    expect(
      autoBudgetMonth({
        kind: 'income',
        occurredOn: '2027-01-05',
        monthShift: -1,
        planMonth: null,
      }),
    ).toBe('2026-12')
    expect(
      autoBudgetMonth({ kind: 'income', occurredOn: '2026-10-16', monthShift: 0, planMonth: null }),
    ).toBe('2026-10')
  })

  it('BR-044: rejaga bog‘langan — reja oyi (to‘lov keyingi oyda bo‘lsa ham)', () => {
    expect(
      autoBudgetMonth({
        kind: 'expense',
        occurredOn: '2026-10-05',
        monthShift: 0,
        planMonth: '2026-09',
      }),
    ).toBe('2026-09')
  })
})
