import { describe, expect, it } from 'vitest'

import { AppError, isRetryable, toAppError } from '@/shared/api/errors'

describe('toAppError', () => {
  it('tarmoq xatosi (fetch TypeError) → network', () => {
    expect(toAppError(new TypeError('Failed to fetch')).code).toBe('network')
  })

  it('401 / PGRST301 → unauthorized, qayta urinilmaydi', () => {
    const error = toAppError({ status: 401, message: 'JWT expired' })
    expect(error.code).toBe('unauthorized')
    expect(isRetryable(error)).toBe(false)
  })

  it('RLS rad etishi (42501) → forbidden', () => {
    expect(toAppError({ code: '42501', message: 'permission denied' }).code).toBe('forbidden')
  })

  it('biznes xato (P0001) → kod va tarjima', () => {
    const error = toAppError({ code: 'P0001', message: 'invite_expired' })
    expect(error.code).toBe('invite_expired')
    expect(error.message).toBe('Kod muddati tugagan (7 kun)')
  })

  it('noma’lum biznes kod — kod saqlanadi, matn umumiy', () => {
    const error = toAppError({ code: 'P0001', message: 'something_new' })
    expect(error.code).toBe('something_new')
    expect(error.message).toBe("Kutilmagan xato. Qayta urinib ko'ring.")
  })

  it('AppError o‘zgarishsiz qaytadi', () => {
    const original = new AppError('planned_already_paid', 'x')
    expect(toAppError(original)).toBe(original)
  })

  it('noma’lum qiymat → unknown, qayta urinish mumkin', () => {
    const error = toAppError('boom')
    expect(error.code).toBe('unknown')
    expect(isRetryable(error)).toBe(true)
  })
})
