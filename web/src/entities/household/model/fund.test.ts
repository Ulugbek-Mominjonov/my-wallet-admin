import { describe, expect, it } from 'vitest'

import { fundAllocation } from './fund'

describe('fundAllocation (BR-060, server bilan bir xil)', () => {
  it('10% — so‘mda 1000 lik birlikka yaxlitlanadi', () => {
    // 14 996 000 so'm × 10% = 1 499 600 → 1 500 000 (birlik 1000 so'm = 100 000 tiyin).
    expect(fundAllocation(1499600000, 10, 100000)).toBe(150000000)
  })

  it('yarim birlik — yuqoriga (Postgres round bilan bir xil)', () => {
    expect(fundAllocation(50000, 100, 100000)).toBe(100000)
  })

  it('daromad yo‘q yoki kichik — ajratma yo‘q', () => {
    expect(fundAllocation(0, 10, 100000)).toBeNull()
    expect(fundAllocation(40000, 10, 100000)).toBeNull()
  })
})
