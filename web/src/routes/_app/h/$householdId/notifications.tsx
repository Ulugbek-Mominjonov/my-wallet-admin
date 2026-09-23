import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

import { membersQuery } from '@/features/household-settings'
import { NotificationsPage } from '@/features/notifications'
import { currentMonthKey } from '@/shared/lib/month'

/** E25-T06: bildirishnomalar — o'z sozlamalari, Telegram, sinov, jurnal. */
export const Route = createFileRoute('/_app/h/$householdId/notifications')({
  component: NotificationsRoute,
})

function NotificationsRoute() {
  const { household } = Route.useRouteContext()
  // E30-T03: katta xarajat sozlamasi — faqat oilaviy byudjetda.
  const members = useQuery(membersQuery(household.id))
  return (
    <NotificationsPage
      householdId={household.id}
      currentMonth={currentMonthKey(new Date(), household.timezone)}
      baseCurrency={household.base_currency}
      multiMember={(members.data?.length ?? 1) > 1}
    />
  )
}
