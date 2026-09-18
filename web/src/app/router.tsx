import { createRouter } from '@tanstack/react-router'

import { NotFound } from '@/app/not-found'
import { RouteError } from '@/app/route-error'
import { routeTree } from '@/routeTree.gen'

export const router = createRouter({
  routeTree,
  // Havola ustiga kelganda keyingi sahifa kodi va ma'lumoti oldindan yuklanadi.
  defaultPreload: 'intent',
  scrollRestoration: true,
  defaultNotFoundComponent: NotFound,
  defaultErrorComponent: RouteError,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
