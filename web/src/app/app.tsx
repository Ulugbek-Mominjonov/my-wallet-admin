import { RouterProvider } from '@tanstack/react-router'
import { useEffect } from 'react'

import { AppProviders } from '@/app/providers'
import { watchAuthEvents } from '@/features/auth'
import { queryClient, router } from '@/app/router'

export function App() {
  useEffect(() => watchAuthEvents(router, queryClient), [])
  return (
    <AppProviders queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>
  )
}
