import { describe, expect, it } from 'vitest'

import { diffRows } from '@/features/tools/model/audit'

describe('diffRows (E25-T05, BR-008)', () => {
  it('tahrir: faqat o‘zgargan maydonlar, nomi bo‘yicha tartibda', () => {
    expect(diffRows({ name: 'Bozor', sort_order: 1 }, { name: 'Bozorlik', sort_order: 2 })).toEqual(
      [
        { field: 'name', before: 'Bozor', after: 'Bozorlik' },
        { field: 'sort_order', before: 1, after: 2 },
      ],
    )
  })

  it('qo‘shish: texnik maydonlar va bo‘shlar tushmaydi', () => {
    expect(
      diffRows(null, {
        id: '0198f000-0000-7000-8000-00000000000a',
        household_id: '0198f000-0000-7000-8000-00000000000b',
        created_at: '2026-09-23T10:00:00Z',
        created_by: null,
        row_version: 0,
        name: 'Bozor',
        archived_at: null,
      }),
    ).toEqual([{ field: 'name', before: null, after: 'Bozor' }])
  })

  it('o‘chirish: eski qiymatlar qoladi', () => {
    expect(diffRows({ name: 'Bozor', deleted_at: null }, null)).toEqual([
      { field: 'name', before: 'Bozor', after: null },
    ])
  })
})
