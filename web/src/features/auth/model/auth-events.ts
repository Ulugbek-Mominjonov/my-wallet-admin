import type { QueryClient } from '@tanstack/react-query'

import { supabase } from '@/shared/api/supabase'

interface RouterLike {
  invalidate: () => Promise<void>
  navigate: (options: { to: '/login' }) => Promise<void>
}

/**
 * Sessiya holati o'zgarsa (chiqish — boshqa tabda ham, token eskirishi,
 * kirish): kesh tozalanadi va marshrut himoyasi qayta tekshiriladi.
 * Qaytaradi — obunani bekor qilish funksiyasi.
 */
export function watchAuthEvents(router: RouterLike, queryClient: QueryClient): () => void {
  const { data } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') {
      queryClient.clear()
      void router.navigate({ to: '/login' })
    } else if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
      void router.invalidate()
    }
  })
  return () => {
    data.subscription.unsubscribe()
  }
}
