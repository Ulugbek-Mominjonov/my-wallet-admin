import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

import { accountsQuery } from '@/features/accounts'
import { categoriesQuery } from '@/features/categories'
import { debtsQuery } from '@/features/debts'
import { membersQuery } from '@/features/household-settings'
import { tagsQuery } from '@/features/tags'
import { TransactionsPage, transactionSearchSchema } from '@/features/transactions'
import { todayIso } from '@/shared/lib/date'
import { currentMonthKey } from '@/shared/lib/month'
import { QueryError } from '@/shared/ui/query-error'
import { TableSkeleton } from '@/shared/ui/table-skeleton'

/**
 * E23-T01: amallar. Filtrlar URL'da (ulashiladigan havola); nomlar uchun
 * spravochniklar arxivdagilari bilan — eski amal ham nomi bilan ko'rinadi.
 */
export const Route = createFileRoute('/_app/h/$householdId/transactions')({
  validateSearch: transactionSearchSchema,
  component: TransactionsRoute,
})

const toMemberOptions = (members: { userId: string; name: string }[]) =>
  members.map((m) => ({ value: m.userId, label: m.name }))
const toDebtOptions = (
  debts: {
    id: string
    name: string
    direction: 'i_owe' | 'owed_to_me'
    archivedAt: string | null
  }[],
) =>
  debts.map((d) => ({
    id: d.id,
    name: d.name,
    direction: d.direction,
    archived: d.archivedAt !== null,
  }))

function TransactionsRoute() {
  const { household } = Route.useRouteContext()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const accounts = useQuery(accountsQuery(household.id, { archived: true }))
  const categories = useQuery(categoriesQuery(household.id, { archived: true }))
  const tags = useQuery(tagsQuery(household.id))
  const members = useQuery({ ...membersQuery(household.id), select: toMemberOptions })
  const debts = useQuery({
    ...debtsQuery(household.id, { archived: true }),
    select: toDebtOptions,
  })
  const lookups = [accounts, categories, tags, members, debts]

  if (lookups.some((q) => q.isPending)) return <TableSkeleton />
  const error = lookups.find((q) => q.error)?.error
  if (error) {
    return (
      <QueryError
        error={error}
        onRetry={() => {
          for (const q of lookups) void q.refetch()
        }}
      />
    )
  }
  return (
    <TransactionsPage
      householdId={household.id}
      search={search}
      onSearchChange={(next) => {
        void navigate({ search: next, replace: true })
      }}
      currentMonth={currentMonthKey(new Date(), household.timezone)}
      today={todayIso(household.timezone)}
      baseCurrency={household.base_currency}
      accounts={accounts.data ?? []}
      categories={categories.data ?? []}
      tags={tags.data ?? []}
      members={members.data ?? []}
      debts={debts.data ?? []}
    />
  )
}
