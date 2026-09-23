import { createFileRoute, Link, Outlet } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Button } from '@/shared/ui/button'

/** E24: hisobotlar bo'limi — oylik va yillik ko'rinishlar (umumiy tablar). */
export const Route = createFileRoute('/_app/h/$householdId/report')({
  component: ReportLayout,
})

function ReportLayout() {
  const { householdId } = Route.useParams()
  const { t } = useTranslation()
  return (
    <div className="space-y-4">
      <nav aria-label={t('report.title')} className="flex flex-wrap gap-2 print:hidden">
        <Button
          variant="ghost"
          size="sm"
          render={
            <Link
              to="/h/$householdId/report"
              params={{ householdId }}
              activeOptions={{ exact: true }}
              activeProps={{ 'data-active': 'true' }}
            />
          }
          className="data-active:bg-muted"
        >
          {t('report.tabs.month')}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          render={
            <Link
              to="/h/$householdId/report/year"
              params={{ householdId }}
              activeProps={{ 'data-active': 'true' }}
            />
          }
          className="data-active:bg-muted"
        >
          {t('report.tabs.year')}
        </Button>
      </nav>
      <Outlet />
    </div>
  )
}
