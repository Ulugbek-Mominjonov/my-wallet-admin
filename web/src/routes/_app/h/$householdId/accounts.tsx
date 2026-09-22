import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

import { AccountsPage } from '@/features/accounts'
import { bootstrapQuery } from '@/features/auth'
import { useAppLocale } from '@/shared/i18n'

/** E22-T02: hisoblar — hamma a'zolar ko'radi, owner/admin boshqaradi. */
export const Route = createFileRoute('/_app/h/$householdId/accounts')({
  component: AccountsRoute,
})

function AccountsRoute() {
  const { household } = Route.useRouteContext()
  const { data: boot } = useSuspenseQuery(bootstrapQuery)
  const locale = useAppLocale()
  const currencies = boot.currencies.map((currency) => ({
    code: currency.code,
    label: `${currency.code} — ${currency.name[locale] ?? currency.code}`,
  }))
  return (
    <AccountsPage
      householdId={household.id}
      currencies={currencies}
      baseCurrency={household.base_currency}
      timezone={household.timezone}
    />
  )
}
