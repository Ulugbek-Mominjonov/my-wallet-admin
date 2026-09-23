import { describe, expect, it } from 'vitest'

import { inviteLink } from '@/shared/lib/invite-link'

describe('inviteLink (E30-T01, BR-012)', () => {
  it('muhit sxemasi bilan deep link', () => {
    // Testlarda VITE_APP_ENV = local (vitest.config.ts).
    expect(inviteLink('ABCD2345')).toBe('mywallet-dev://invite/ABCD2345')
  })
})
