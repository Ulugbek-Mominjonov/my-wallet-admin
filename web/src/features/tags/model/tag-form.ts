import { z } from 'zod'

import type { Tag } from '@/entities/tag'
import type { TagInput } from '@/features/tags/api/tags-api'

export const NAME_MAX = 60

export const tagFormSchema = z.object({
  name: z.string().trim().min(1).max(NAME_MAX),
  color: z.string().nullable(),
}) satisfies z.ZodType<TagInput>

export type TagFormValues = z.input<typeof tagFormSchema>

export const tagFormDefaults = (tag: Tag | undefined): TagFormValues => ({
  name: tag?.name ?? '',
  color: tag?.color ?? null,
})
