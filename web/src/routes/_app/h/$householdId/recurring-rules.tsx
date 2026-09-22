import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

import { accountsQuery } from '@/features/accounts'
import { categoriesQuery } from '@/features/categories'
import { RecurringRulesPage } from '@/features/recurring-rules'
import { QueryError } from '@/shared/ui/query-error'
import { TableSkeleton } from '@/shared/ui/table-skeleton'

/**
 * E22-T04: doimiy rejalar. Hisob va kategoriya ro'yxatlari (forma tanlovlari)
 * shu yerda — feature'lar bir-birini import qilmaydi, marshrut birlashtiradi.
 */
export const Route = createFileRoute('/_app/h/$householdId/recurring-rules')({
  component: RecurringRulesRoute,
})

function RecurringRulesRoute() {
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
    <RecurringRulesPage
      householdId={household.id}
      categories={categories.data ?? []}
      accounts={accounts.data ?? []}
      baseCurrency={household.base_currency}
      timezone={household.timezone}
    />
  )
}
