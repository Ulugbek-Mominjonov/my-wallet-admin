import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { isRetryable, toAppError } from '@/shared/api/errors'

const SECOND = 1000
const MAX_RETRIES = 2

/**
 * DB yuklamasini kamaytirish (ARXITEKTURA 8-bo'lim, 9-qoida): ma'lumot 30 s
 * "yangi" hisoblanadi — shu vaqt ichida qayta so'rov yuborilmaydi. Hisobot va
 * spravochniklar o'z `staleTime` ini beradi.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({
      // Faqat fonda yangilashdagi xato uchun toast; birinchi yuklash xatosini
      // sahifaning o'zi (error holati) ko'rsatadi.
      onError: (error, query) => {
        if (query.state.data !== undefined) toast.error(toAppError(error).message)
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        if (mutation.meta?.silent !== true) toast.error(toAppError(error).message)
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 30 * SECOND,
        retry: (failureCount, error) => failureCount < MAX_RETRIES && isRetryable(error),
      },
      mutations: { retry: false },
    },
  })
}

declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: { silent?: boolean }
  }
}
