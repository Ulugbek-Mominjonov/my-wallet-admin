import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

import { accountsQuery } from '@/features/accounts'
import { categoriesQuery } from '@/features/categories'
import { QuickActionsPage } from '@/features/quick-actions'
import { QueryError } from '@/shared/ui/query-error'
import { TableSkeleton } from '@/shared/ui/table-skeleton'

/** E22-T05: tez tugmalar — hisob va kategoriya ro'yxatlari marshrutdan. */
export const Route = createFileRoute('/_app/h/$householdId/quick-actions')({
  component: QuickActionsRoute,
})

function QuickActionsRoute() {
  const { household } = Route.useRouteContext()
  const accounts = useQuery(accountsQuery(household.id, { archived: false }))
  const categories = useQuery(categoriesQuery(household.id, { archived: false }))
  if (accounts.isPending || categories.isPending) return <TableSkeleton />
  const error = accounts.error ?? categories.error
  if (error) {
    return (
      <QueryError
        error={error}
        onRetry={() => {
          void accounts.refetch()
          void categories.refetch()
        }}
      />
    )
  }
  return (
    <QuickActionsPage
      householdId={household.id}
      categories={categories.data ?? []}
      accounts={accounts.data ?? []}
      baseCurrency={household.base_currency}
    />
  )
}
