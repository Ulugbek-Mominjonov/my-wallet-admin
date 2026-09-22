import { QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'

import { useDirectoryMutations } from '@/shared/api/use-directory-mutations'
import { createTestQueryClient } from '@/shared/test/render'

const KEY = ['household', 'h', 'items', { archived: false }]
const item = (id: string, sortOrder: number) => ({ id, archivedAt: null, sortOrder })

function setup(reorder: (ids: string[]) => Promise<void>) {
  const queryClient = createTestQueryClient()
  queryClient.setQueryData(KEY, [item('a', 0), item('b', 1), item('c', 2)])
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  const { result } = renderHook(
    () =>
      useDirectoryMutations<ReturnType<typeof item>>({
        listKey: KEY,
        allKey: ['household', 'h', 'items'],
        showingArchived: false,
        archive: () => Promise.resolve(),
        remove: () => Promise.resolve(),
        reorder,
      }),
    { wrapper },
  )
  return { queryClient, result }
}

describe('useDirectoryMutations — tartib', () => {
  it("optimistik: tartib va sort_order darhol o'zgaradi", async () => {
    const { queryClient, result } = setup(() => new Promise<void>(() => undefined))
    act(() => {
      result.current.reorder.mutate(['c', 'a', 'b'])
    })
    await waitFor(() => {
      expect(queryClient.getQueryData(KEY)).toEqual([item('c', 0), item('a', 1), item('b', 2)])
    })
  })

  it('xatoda avvalgi tartib qaytadi', async () => {
    const { queryClient, result } = setup(() => Promise.reject(new Error('forbidden')))
    act(() => {
      result.current.reorder.mutate(['c', 'a', 'b'])
    })
    await waitFor(() => {
      expect(result.current.reorder.isError).toBe(true)
    })
    expect(queryClient.getQueryData(KEY)).toEqual([item('a', 0), item('b', 1), item('c', 2)])
  })
})
