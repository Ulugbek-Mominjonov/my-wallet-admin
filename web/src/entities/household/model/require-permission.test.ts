import { describe, expect, it } from 'vitest'

import { AppError } from '@/shared/api/errors'

import type { HouseholdSummary } from './bootstrap'
import { requirePermission } from './require-permission'

const household = (role: HouseholdSummary['role']): HouseholdSummary => ({
  id: '0198f000-0000-7000-8000-00000000000a',
  name: 'Oila',
  role,
  base_currency: 'UZS',
  timezone: 'Asia/Tashkent',
  onboarded: true,
})

describe('requirePermission', () => {
  it("rol yetarli — o'tkazadi", () => {
    expect(() => {
      requirePermission(household('admin'), 'manage')
    }).not.toThrow()
  })

  it('rol yetmasa — forbidden (403 sahifasi)', () => {
    expect(() => {
      requirePermission(household('viewer'), 'write')
    }).toThrow(expect.objectContaining({ code: 'forbidden' }) as AppError)
  })
})
