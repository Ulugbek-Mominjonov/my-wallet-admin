import { describe, expect, it } from 'vitest'

import { bootstrapSchema, pickHousehold, roleCan, type Bootstrap } from './bootstrap'

const HOME = '0198f000-0000-7000-8000-00000000000a'
const FAMILY = '0198f000-0000-7000-8000-00000000000b'

const household = (id: string, role: 'owner' | 'viewer') => ({
  id,
  name: id === HOME ? 'Shaxsiy byudjet' : 'Oila',
  role,
  base_currency: 'UZS',
  timezone: 'Asia/Tashkent',
  onboarded: true,
})

const boot = (last: string | null, households = [household(HOME, 'owner')]): Bootstrap => ({
  schema_version: 1,
  is_platform_admin: false,
  profile: {
    user_id: '0198f000-0000-7000-8000-000000000001',
    display_name: 'Ali',
    locale: 'uz',
    last_household_id: last,
  },
  households,
  currencies: [],
  app_config: {},
})

describe('pickHousehold', () => {
  it('oxirgi tanlangan byudjet (a’zo bo‘lsa)', () => {
    const both = [household(HOME, 'owner'), household(FAMILY, 'viewer')]
    expect(pickHousehold(boot(FAMILY, both))?.id).toBe(FAMILY)
  })

  it('oxirgisidan chiqib ketgan — birinchi byudjet', () => {
    expect(pickHousehold(boot(FAMILY))?.id).toBe(HOME)
  })

  it('byudjet yo‘q — undefined (sozlash sahifasi)', () => {
    expect(pickHousehold(boot(null, []))).toBeUndefined()
  })
})

describe('roleCan (BR-011)', () => {
  it.each([
    ['owner', 'own', true],
    ['admin', 'own', false],
    ['admin', 'manage', true],
    ['member', 'manage', false],
    ['member', 'write', true],
    ['viewer', 'write', false],
    ['viewer', 'read', true],
  ] as const)('%s → %s = %s', (role, permission, expected) => {
    expect(roleCan(role, permission)).toBe(expected)
  })
})

describe('bootstrapSchema', () => {
  it('shartnomadan tashqari rol — aniq xato', () => {
    const invalid = { ...boot(null), households: [{ ...household(HOME, 'owner'), role: 'guest' }] }
    expect(bootstrapSchema.safeParse(invalid).success).toBe(false)
  })
})
