import type { QueryClient } from '@tanstack/react-query'

/** Marshrut loader'lari oladigan kontekst (ma'lumotni oldindan yuklash uchun). */
export interface RouterContext {
  queryClient: QueryClient
}
