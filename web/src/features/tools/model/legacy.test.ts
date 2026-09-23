import { describe, expect, it } from 'vitest'

import { parseLegacyFile } from '@/features/tools/model/legacy'

describe('parseLegacyFile (E27-T04)', () => {
  it('v1 fayl o‘qiladi, boshqa versiya rad etiladi', () => {
    const result = parseLegacyFile('{"version": 1, "incomes": [{}, {}]}')
    expect('summary' in result && result.summary.incomes).toBe(2)
    expect(parseLegacyFile('{"version": 2}')).toEqual({ error: 'unsupported_version' })
    expect(parseLegacyFile('salom')).toEqual({ error: 'invalid_json' })
  })

  it('payload kesilmaydi — `settings` va etalon oylar serverga to‘liq boradi', () => {
    const text =
      '{"version": 1, "settings": {"limits": [{"category": "Oziq-ovqat"}]},' +
      ' "expectedMonths": [{"monthKey": "2026-08", "balance": 10, "saved": 20}]}'
    const result = parseLegacyFile(text)
    expect('payload' in result && result.payload).toEqual(JSON.parse(text))
    expect('summary' in result && result.summary.months).toBe(1)
  })
})
