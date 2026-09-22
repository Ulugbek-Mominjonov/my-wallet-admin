import { createFileRoute } from '@tanstack/react-router'

import { TagsPage } from '@/features/tags'

/** E22-T05: teglar — yaratish member'ga ham, tahrir owner/admin. */
export const Route = createFileRoute('/_app/h/$householdId/tags')({
  component: TagsRoute,
})

function TagsRoute() {
  const { household } = Route.useRouteContext()
  return <TagsPage householdId={household.id} />
}
