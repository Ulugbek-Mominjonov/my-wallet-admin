import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

import { accountsQuery } from '@/features/accounts'
import { bootstrapQuery } from '@/features/auth'
import { GoalsPage } from '@/features/goals'
import { useAppLocale } from '@/shared/i18n'
import { QueryError } from '@/shared/ui/query-error'
import { TableSkeleton } from '@/shared/ui/table-skeleton'

/** E22-T06: maqsadlar — hisoblar (bog'lash uchun) marshrutdan. */
export const Route = createFileRoute('/_app/h/$householdId/goals')({
  component: GoalsRoute,
})

function GoalsRoute() {
  const { household } = Route.useRouteContext()
  const { data: boot } = useSuspenseQuery(bootstrapQuery)
  const locale = useAppLocale()
  const accounts = useQuery(accountsQuery(household.id, { archived: false }))
  if (accounts.isPending) return <TableSkeleton />
  if (accounts.isError) {
    return (
      <QueryError
        error={accounts.error}
        onRetry={() => {
          void accounts.refetch()
        }}
      />
    )
  }
  const currencies = boot.currencies.map((c) => ({
    value: c.code,
    label: `${c.code} — ${c.name[locale] ?? c.code}`,
  }))
  return (
    <GoalsPage
      householdId={household.id}
      currencies={currencies}
      accounts={accounts.data.filter((a) => a.type !== 'personal_fund')}
      baseCurrency={household.base_currency}
    />
  )
}
