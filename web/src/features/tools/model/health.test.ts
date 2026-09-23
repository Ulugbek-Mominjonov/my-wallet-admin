import { describe, expect, it } from 'vitest'

import { issueMessage } from '@/features/tools/model/health'
import { i18n } from '@/shared/i18n'

const labels = {
  t: i18n.t,
  money: (minor: number) => `${String(minor / 100)} so'm`,
  date: (iso: string) => iso,
}

describe('issueMessage (E25-T01)', () => {
  it('kod va tafsilotlardan matn quradi', () => {
    expect(issueMessage({ code: 'month_not_opened', count: 2 }, labels)).toContain('2 ta')
    expect(issueMessage({ code: 'negative_cash', balance: -20000 }, labels)).toContain("-200 so'm")
    expect(
      issueMessage(
        { code: 'fx_rate_stale', currency: 'USD', last_rate_date: '2026-09-01' },
        labels,
      ),
    ).toContain('USD')
  })

  it('noma’lum kod — kodning o‘zi (sahifa buzilmaydi)', () => {
    expect(issueMessage({ code: 'something_new' }, labels)).toBe('something_new')
  })
})
