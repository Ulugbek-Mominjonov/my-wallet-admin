import { createFileRoute } from '@tanstack/react-router'

import { NotificationsPage } from '@/features/notifications'
import { currentMonthKey } from '@/shared/lib/month'

/** E25-T06: bildirishnomalar — o'z sozlamalari, Telegram, sinov, jurnal. */
export const Route = createFileRoute('/_app/h/$householdId/notifications')({
  component: NotificationsRoute,
})

function NotificationsRoute() {
  const { household } = Route.useRouteContext()
  return (
    <NotificationsPage
      householdId={household.id}
      currentMonth={currentMonthKey(new Date(), household.timezone)}
      baseCurrency={household.base_currency}
    />
  )
}
