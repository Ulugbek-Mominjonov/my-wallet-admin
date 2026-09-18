import { createRouter } from '@tanstack/react-router'

import { NotFound } from '@/app/not-found'
import { RouteError } from '@/app/route-error'
import { routeTree } from '@/routeTree.gen'
import { createQueryClient } from '@/shared/api/query-client'

/** Ilova bo'ylab yagona kesh — providerga ham, router loader'lariga ham beriladi. */
export const queryClient = createQueryClient()

export const router = createRouter({
  routeTree,
  context: { queryClient },
  // Havola ustiga kelganda keyingi sahifa kodi va ma'lumoti oldindan yuklanadi.
  defaultPreload: 'intent',
  // Oldindan yuklangan ma'lumotni router emas, TanStack Query keshlaydi.
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
  defaultNotFoundComponent: NotFound,
  defaultErrorComponent: RouteError,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
