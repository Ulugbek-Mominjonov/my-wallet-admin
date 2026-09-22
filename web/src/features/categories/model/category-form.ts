import { z } from 'zod'

import type { Category } from '@/entities/category'
import type { CategoryInput } from '@/features/categories/api/categories-api'

/** `entity_name` domeni (BR-003). */
export const NAME_MAX = 60

/** Tanlovlar matn qiymatda: ota — `''` = asosiy; siljish — `'0'` / `'-1'`. */
export const categoryFormSchema = z
  .object({
    name: z.string().trim().min(1).max(NAME_MAX),
    parentId: z.string(),
    monthShift: z.enum(['0', '-1']),
    icon: z.string().nullable(),
    color: z.string().nullable(),
  })
  .transform((values): CategoryInput => ({
    name: values.name,
    parentId: values.parentId || null,
    monthShift: Number(values.monthShift),
    icon: values.icon,
    color: values.color,
  }))

export type CategoryFormValues = z.input<typeof categoryFormSchema>

export function categoryFormDefaults(
  category: Category | undefined,
  parentId: string | null,
): CategoryFormValues {
  return {
    name: category?.name ?? '',
    parentId: category?.parentId ?? parentId ?? '',
    monthShift: category?.monthShift === -1 ? '-1' : '0',
    icon: category?.icon ?? null,
    color: category?.color ?? null,
  }
}

/**
 * BR-034: ota bo'la oladigan kategoriyalar — shu tur, yuqori daraja, o'zi
 * emas, arxivda emas. Tizim kategoriyasi (BR-033) ota ham, bola ham emas.
 */
export function parentOptions(
  categories: readonly Category[],
  kind: Category['kind'],
  self: Category | undefined,
): Category[] {
  return categories.filter(
    (c) =>
      c.kind === kind &&
      c.parentId === null &&
      c.id !== self?.id &&
      c.archivedAt === null &&
      c.systemCode === null,
  )
}
