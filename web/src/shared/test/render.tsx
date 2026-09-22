import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { render, type RenderOptions } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'

import { createQueryClient } from '@/shared/api/query-client'

/**
 * Har test uchun toza kesh — ilovadagi bilan bir xil (global xato → toast),
 * faqat qayta urinish yo'q: testlar bir-biriga ta'sir qilmaydi, tez tugaydi.
 */
export function createTestQueryClient(): QueryClient {
  const client = createQueryClient()
  client.setDefaultOptions({
    queries: { retry: false, gcTime: Infinity },
    mutations: { retry: false },
  })
  return client
}

export function renderWithProviders(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  const queryClient = createTestQueryClient()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return { queryClient, ...render(ui, { wrapper, ...options }) }
}
