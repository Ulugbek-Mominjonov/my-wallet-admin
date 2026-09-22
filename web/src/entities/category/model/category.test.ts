import { describe, expect, it } from 'vitest'

import { categoryTree, type Category } from './category'

const category = (id: string, sortOrder: number, parentId: string | null = null): Category => ({
  id,
  kind: 'expense',
  name: id,
  parentId,
  monthShift: 0,
  systemCode: null,
  icon: null,
  color: null,
  sortOrder,
  archivedAt: null,
})

describe('categoryTree (BR-034)', () => {
  it('ota va bolalari ketma-ket, har daraja sort_order bo‘yicha', () => {
    const tree = categoryTree([
      category('taksi', 2, 'transport'),
      category('ovqat', 1),
      category('transport', 0),
      category('yoqilgi', 1, 'transport'),
    ])
    expect(tree.map((n) => [n.id, n.depth, n.parentName])).toEqual([
      ['transport', 0, null],
      ['yoqilgi', 1, 'transport'],
      ['taksi', 1, 'transport'],
      ['ovqat', 0, null],
    ])
  })

  it('otasi ro‘yxatda yo‘q bola — yuqori darajada', () => {
    expect(categoryTree([category('taksi', 0, 'arxivdagi')])[0]).toMatchObject({
      id: 'taksi',
      depth: 0,
    })
  })
})
