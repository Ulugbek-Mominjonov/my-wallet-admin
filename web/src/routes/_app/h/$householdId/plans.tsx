import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

import { accountsQuery } from '@/features/accounts'
import { categoriesQuery } from '@/features/categories'
import { PlansPage, plansSearchSchema } from '@/features/plans'
import { todayIso } from '@/shared/lib/date'
import { currentMonthKey } from '@/shared/lib/month'
import { QueryError } from '@/shared/ui/query-error'
import { TableSkeleton } from '@/shared/ui/table-skeleton'

/** E23-T04: oy rejalari. Oy va tab URL'da; hisob/kategoriya — nomlar va to'lov uchun. */
export const Route = createFileRoute('/_app/h/$householdId/plans')({
  validateSearch: plansSearchSchema,
  component: PlansRoute,
})

function PlansRoute() {
  const { household } = Route.useRouteContext()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const accounts = useQuery(accountsQuery(household.id, { archived: true }))
  const categories = useQuery(categoriesQuery(household.id, { archived: true }))
  const currentMonth = currentMonthKey(new Date(), household.timezone)

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
    <PlansPage
      householdId={household.id}
      month={search.month ?? currentMonth}
      tab={search.tab ?? 'expense'}
      onMonthChange={(month) => {
        void navigate({
          search: (prev) => ({ ...prev, month: month === currentMonth ? undefined : month }),
          replace: true,
        })
      }}
      onTabChange={(tab) => {
        void navigate({
          search: (prev) => ({ ...prev, tab: tab === 'expense' ? undefined : tab }),
          replace: true,
        })
      }}
      currentMonth={currentMonth}
      today={todayIso(household.timezone)}
      baseCurrency={household.base_currency}
      accounts={accounts.data ?? []}
      categories={categories.data ?? []}
    />
  )
}
