import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

import { membersQuery } from '@/features/household-settings'
import { AuditPage } from '@/features/tools'
import { QueryError } from '@/shared/ui/query-error'
import { TableSkeleton } from '@/shared/ui/table-skeleton'

/** E25-T05: audit jurnali (BR-008); a'zolar nomi — marshrut beradi. */
export const Route = createFileRoute('/_app/h/$householdId/audit')({
  component: AuditRoute,
})

const toMemberOptions = (members: { userId: string; name: string }[]) =>
  members.map((member) => ({ value: member.userId, label: member.name }))

function AuditRoute() {
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
  return <AuditPage householdId={household.id} members={members.data} />
}
