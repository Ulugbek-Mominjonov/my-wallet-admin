import { createFileRoute } from '@tanstack/react-router'

import { CategoriesPage } from '@/features/categories'

/** E22-T03: kategoriyalar — hamma a'zolar ko'radi, owner/admin boshqaradi. */
export const Route = createFileRoute('/_app/h/$householdId/categories')({
  component: CategoriesRoute,
})

function CategoriesRoute() {
  const { household } = Route.useRouteContext()
  return <CategoriesPage householdId={household.id} baseCurrency={household.base_currency} />
}
