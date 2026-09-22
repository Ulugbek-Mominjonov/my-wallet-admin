import { describe, expect, it } from 'vitest'

import type { Category } from '@/entities/category'
import {
  categoryFormDefaults,
  categoryFormSchema,
  parentOptions,
} from '@/features/categories/model/category-form'

const category = (id: string, patch: Partial<Category> = {}): Category => ({
  id,
  kind: 'expense',
  name: id,
  parentId: null,
  monthShift: 0,
  systemCode: null,
  icon: null,
  color: null,
  sortOrder: 0,
  archivedAt: null,
  ...patch,
})

describe('categoryFormSchema', () => {
  it("ota bo'sh — asosiy; siljish son (BR-031)", () => {
    expect(
      categoryFormSchema.parse({
        name: ' Oylik ',
        parentId: '',
        monthShift: '-1',
        icon: null,
        color: null,
      }),
    ).toEqual({ name: 'Oylik', parentId: null, monthShift: -1, icon: null, color: null })
  })

  it('tahrirlash qiymatlari (bola kategoriya, oldingi oy)', () => {
    expect(
      categoryFormDefaults(category('taksi', { parentId: 'transport', monthShift: -1 }), null),
    ).toMatchObject({ parentId: 'transport', monthShift: '-1' })
    expect(categoryFormDefaults(undefined, 'transport').parentId).toBe('transport')
  })
})

describe('parentOptions (BR-033, BR-034)', () => {
  it('faqat shu turdagi yuqori daraja; o‘zi, bola, arxiv va tizim emas', () => {
    const all = [
      category('transport'),
      category('taksi', { parentId: 'transport' }),
      category('eski', { archivedAt: '2026-01-01' }),
      category('ozim', { systemCode: 'personal_allocation' }),
      category('oylik', { kind: 'income' }),
      category('ovqat'),
    ]
    expect(parentOptions(all, 'expense', all[5]).map((c) => c.id)).toEqual(['transport'])
  })
})
