import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'

import { invalidateMoneyWrite } from '@/shared/api/cache'
import { part, qk } from '@/shared/api/query-keys'

const HOUSEHOLD = 'h1'

type Key = readonly unknown[]

function seed(client: QueryClient, keys: readonly Key[]) {
  for (const key of keys) client.setQueryData(key, 'x')
}

describe('invalidateMoneyWrite (E24-T07)', () => {
  it('pulga bog‘liq keshlarni eskirtiradi, spravochniklarga tegmaydi', async () => {
    const client = new QueryClient()
    const reportMonth = [...part(HOUSEHOLD, 'reports'), 'month', '2026-09']
    const categories = [...qk.household(HOUSEHOLD), 'categories']
    const otherHousehold = [...part('h2', 'reports'), 'month', '2026-09']
    seed(client, [reportMonth, part(HOUSEHOLD, 'accounts'), categories, otherHousehold])

    await invalidateMoneyWrite(client, HOUSEHOLD)

    const stale = (key: Key) => client.getQueryState(key)?.isInvalidated
    expect(stale(reportMonth)).toBe(true)
    expect(stale(part(HOUSEHOLD, 'accounts'))).toBe(true)
    expect(stale(categories)).toBe(false)
    expect(stale(otherHousehold)).toBe(false)
  })
})
