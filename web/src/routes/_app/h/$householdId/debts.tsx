import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

import { bootstrapQuery } from '@/features/auth'
import { DebtsPage } from '@/features/debts'
import { useAppLocale } from '@/shared/i18n'

/** E22-T06: qarzlar — hamma a'zolar ko'radi, member ham yozadi. */
export const Route = createFileRoute('/_app/h/$householdId/debts')({
  component: DebtsRoute,
})

function DebtsRoute() {
  const { household } = Route.useRouteContext()
  const { data: boot } = useSuspenseQuery(bootstrapQuery)
  const locale = useAppLocale()
  const currencies = boot.currencies.map((c) => ({
    value: c.code,
    label: `${c.code} — ${c.name[locale] ?? c.code}`,
  }))
  return (
    <DebtsPage
      householdId={household.id}
      currencies={currencies}
      baseCurrency={household.base_currency}
    />
  )
}
