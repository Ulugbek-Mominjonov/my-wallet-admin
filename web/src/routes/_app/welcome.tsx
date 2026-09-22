import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { pickHousehold } from '@/entities/household'
import { HouseholdSetup } from '@/features/household'
import { Button } from '@/shared/ui/button'

/** Byudjeti yo'q foydalanuvchi (yoki almashtirgichdan "Yangi byudjet") — E21-T02. */
export const Route = createFileRoute('/_app/welcome')({
  component: WelcomePage,
})

function WelcomePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const current = pickHousehold(Route.useRouteContext().boot)

  return (
    <main className="mx-auto grid min-h-svh w-full max-w-3xl content-center gap-6 p-4 md:p-6">
      {current && (
        <Button
          variant="ghost"
          className="justify-self-start"
          render={<Link to="/h/$householdId" params={{ householdId: current.id }} />}
        >
          <ArrowLeft aria-hidden />
          {t('household.back')}
        </Button>
      )}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t('household.setupTitle')}</h1>
        <p className="text-muted-foreground">{t('household.setupSubtitle')}</p>
      </div>
      <HouseholdSetup
        onReady={(householdId) => {
          void navigate({ to: '/h/$householdId', params: { householdId } })
        }}
      />
    </main>
  )
}
