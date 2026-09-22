import { describe, expect, it } from 'vitest'

import { mfaGate } from '@/features/auth/model/mfa-gate'

describe('mfaGate (E21-T04, BR-213)', () => {
  it('2FA yoqilmagan — oddiy sahifalar ochiq, platforma yoqishni talab qiladi', () => {
    const level = { currentLevel: 'aal1', nextLevel: 'aal1' }
    expect(mfaGate(level, { required: false })).toBe('ok')
    expect(mfaGate(level, { required: true })).toBe('enroll')
  })

  it('2FA yoqilgan, kod kiritilmagan — tekshiruv', () => {
    const level = { currentLevel: 'aal1', nextLevel: 'aal2' }
    expect(mfaGate(level, { required: false })).toBe('challenge')
    expect(mfaGate(level, { required: true })).toBe('challenge')
  })

  it('aal2 sessiya — hamma joy ochiq', () => {
    const level = { currentLevel: 'aal2', nextLevel: 'aal2' }
    expect(mfaGate(level, { required: true })).toBe('ok')
  })
})
