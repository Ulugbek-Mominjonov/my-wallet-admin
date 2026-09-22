import { Constants } from '@/shared/api/database.types'

/** BR-030: daromad turi yoki xarajat kategoriyasi (yaratilgandan keyin o'zgarmaydi). */
export const CATEGORY_KINDS = Constants.public.Enums.category_kind
export type CategoryKind = (typeof CATEGORY_KINDS)[number]

/** BR-031/BR-040: daromad qaysi oyga tegishli — `0` joriy, `−1` oldingi oy. */
export const MONTH_SHIFTS = [0, -1] as const

export interface Category {
  id: string
  kind: CategoryKind
  name: string
  parentId: string | null
  monthShift: number
  /** BR-033: `personal_allocation` — "O'zim uchun" (tizim). */
  systemCode: string | null
  icon: string | null
  color: string | null
  sortOrder: number
  archivedAt: string | null
}

/** Daraxt qatori: ota, keyin uning bolalari (BR-034 — bir daraja). */
export interface CategoryNode extends Category {
  depth: 0 | 1
  parentName: string | null
}

export const isSystemCategory = (category: Pick<Category, 'systemCode'>): boolean =>
  category.systemCode !== null

const byOrder = (a: Category, b: Category) =>
  a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)

/**
 * Ro'yxatni daraxt tartibida yassilaydi: har ota va uning bolalari ketma-ket.
 * Otasi ro'yxatda yo'q bola (masalan otasi arxivda) — yuqori darajada.
 */
export function categoryTree(categories: readonly Category[]): CategoryNode[] {
  const ids = new Set(categories.map((c) => c.id))
  const children = new Map<string, Category[]>()
  const roots: Category[] = []
  for (const category of categories) {
    if (category.parentId && ids.has(category.parentId)) {
      const siblings = children.get(category.parentId) ?? []
      siblings.push(category)
      children.set(category.parentId, siblings)
    } else {
      roots.push(category)
    }
  }
  return roots
    .sort(byOrder)
    .flatMap((root) => [
      { ...root, depth: 0 as const, parentName: null },
      ...(children.get(root.id) ?? [])
        .sort(byOrder)
        .map((child) => ({ ...child, depth: 1 as const, parentName: root.name })),
    ])
}
