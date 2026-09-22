import { useMutation } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { QueryClientProvider } from '@tanstack/react-query'

import { optimisticList } from '@/shared/api/optimistic'
import { createTestQueryClient } from '@/shared/test/render'

const KEY = ['household', 'h', 'items']

function setup(mutationFn: (name: string) => Promise<void>) {
  const queryClient = createTestQueryClient()
  queryClient.setQueryData(KEY, [{ id: 'a', name: 'A' }])
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  const { result } = renderHook(
    () =>
      useMutation({
        mutationFn,
        ...optimisticList<{ id: string; name: string }, string>(queryClient, KEY, (items, name) =>
          items.map((item) => ({ ...item, name })),
        ),
      }),
    { wrapper },
  )
  return { queryClient, result }
}

describe('optimisticList', () => {
  it("o'zgarish server javobidan oldin ko'rinadi", async () => {
    let resolve: () => void = () => undefined
    const { queryClient, result } = setup(
      () =>
        new Promise<void>((r) => {
          resolve = r
        }),
    )
    act(() => {
      result.current.mutate('B')
    })
    await waitFor(() => {
      expect(queryClient.getQueryData(KEY)).toEqual([{ id: 'a', name: 'B' }])
    })
    resolve()
  })

  it('xatoda avvalgi holat qaytadi', async () => {
    const { queryClient, result } = setup(() => Promise.reject(new Error('boom')))
    act(() => {
      result.current.mutate('B')
    })
    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect(queryClient.getQueryData(KEY)).toEqual([{ id: 'a', name: 'A' }])
  })
})
