import { describe, expect, it } from 'vitest'

import {
  isMaintenanceActive,
  maintenanceToForm,
  maintenanceToValue,
} from '@/features/platform/model/config'

const VALUE = {
  message: { uz: 'Ish', ru: 'Работы', en: 'Maintenance' },
  until: '2026-10-05T12:00:00Z',
}

describe('maintenance (E26-T02)', () => {
  it('qiymat → forma → qiymat (bir xil ma’no)', () => {
    const form = maintenanceToForm(VALUE)
    expect(form).toEqual({
      enabled: true,
      uz: 'Ish',
      ru: 'Работы',
      en: 'Maintenance',
      until: '2026-10-05T12:00',
    })
    expect(maintenanceToValue(form)).toEqual(VALUE)
  })

  it('o‘chiq banner — null; noto‘g‘ri qiymat — bo‘sh forma', () => {
    expect(maintenanceToValue({ enabled: false, uz: '', ru: '', en: '', until: '' })).toBeNull()
    expect(maintenanceToForm({ message: { uz: 'Ish' } }).enabled).toBe(false)
    expect(maintenanceToForm(null).enabled).toBe(false)
  })

  it('muddati o‘tgan banner ko‘rsatilmaydi', () => {
    expect(isMaintenanceActive(VALUE, new Date('2026-10-05T11:00:00Z'))).toBe(true)
    expect(isMaintenanceActive(VALUE, new Date('2026-10-05T13:00:00Z'))).toBe(false)
    expect(isMaintenanceActive({ message: { uz: 'a', ru: 'b', en: 'c' } }, new Date())).toBe(true)
    expect(isMaintenanceActive(null, new Date())).toBe(false)
  })
})
