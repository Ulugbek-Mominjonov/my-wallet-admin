import { RouterProvider } from '@tanstack/react-router'

import { AppProviders } from '@/app/providers'
import { queryClient, router } from '@/app/router'

export function App() {
  return (
    <AppProviders queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>
  )
}
