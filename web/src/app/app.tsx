import { RouterProvider } from '@tanstack/react-router'

import { router } from '@/app/router'

/** Ilova ildizi. Providerlar (Query, i18n, tema) E02-T04..T06 da qo'shiladi. */
export function App() {
  return <RouterProvider router={router} />
}
