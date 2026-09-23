import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

import { membersQuery } from '@/features/household-settings'
import { DevicesPage } from '@/features/tools'
import { QueryError } from '@/shared/ui/query-error'
import { TableSkeleton } from '@/shared/ui/table-skeleton'

/** E25-T07: qurilmalar va sinxron; a'zolar nomi — marshrut beradi. */
export const Route = createFileRoute('/_app/h/$householdId/devices')({
  component: DevicesRoute,
})

const toMemberOptions = (members: { userId: string; name: string }[]) =>
  members.map((member) => ({ value: member.userId, label: member.name }))

function DevicesRoute() {
  const { household } = Route.useRouteContext()
  const members = useQuery({ ...membersQuery(household.id), select: toMemberOptions })

  if (members.isPending) return <TableSkeleton />
  if (members.error) {
    return (
      <QueryError
        error={members.error}
        onRetry={() => {
          void members.refetch()
        }}
      />
    )
  }
  return <DevicesPage householdId={household.id} members={members.data} />
}
