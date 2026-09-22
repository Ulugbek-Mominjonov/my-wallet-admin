import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

import { categoriesQuery } from '@/features/categories'
import { LimitsPage } from '@/features/limits'
import { currentMonthKey } from '@/shared/lib/month'
import { QueryError } from '@/shared/ui/query-error'
import { TableSkeleton } from '@/shared/ui/table-skeleton'

/** E22-T05: limitlar — kategoriyalar ro'yxati marshrutdan (feature'lar mustaqil). */
export const Route = createFileRoute('/_app/h/$householdId/limits')({
  component: LimitsRoute,
})

function LimitsRoute() {
  const { household } = Route.useRouteContext()
  const categories = useQuery(categoriesQuery(household.id, { archived: false }))
  if (categories.isPending) return <TableSkeleton />
  if (categories.isError) {
    return (
      <QueryError
        error={categories.error}
        onRetry={() => {
          void categories.refetch()
        }}
      />
    )
  }
  return (
    <LimitsPage
      householdId={household.id}
      month={`${currentMonthKey(new Date(), household.timezone)}-01`}
      categories={categories.data}
      baseCurrency={household.base_currency}
    />
  )
}
