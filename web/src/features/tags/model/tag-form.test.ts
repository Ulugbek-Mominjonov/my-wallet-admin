import { describe, expect, it } from 'vitest'

import { tagFormSchema } from '@/features/tags/model/tag-form'

describe('tagFormSchema (BR-200)', () => {
  it('nom qirqiladi, rang ixtiyoriy', () => {
    expect(tagFormSchema.parse({ name: " Ta'til ", color: null })).toEqual({
      name: "Ta'til",
      color: null,
    })
    expect(tagFormSchema.safeParse({ name: '  ', color: null }).success).toBe(false)
  })
})
