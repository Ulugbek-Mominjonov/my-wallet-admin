import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { prefsQuery, telegramQuery } from '@/features/notifications/api/notifications-api'
import { ArchiveSection, OutboxSection } from '@/features/notifications/ui/log-section'
import { PrefsSection } from '@/features/notifications/ui/prefs-section'
import { TelegramSection } from '@/features/notifications/ui/telegram-section'
import { TestSection } from '@/features/notifications/ui/test-section'
import type { MonthKey } from '@/shared/lib/month'
import { PageHeader } from '@/shared/ui/page-header'
import { QueryError } from '@/shared/ui/query-error'
import { Skeleton } from '@/shared/ui/skeleton'

/**
 * E25-T06: har a'zoning o'z bildirishnoma sozlamalari (BR-160..165),
 * Telegram'ni ulash (BR-163), sinov va "hozir yuborish" (BR-164),
 * yuborish jurnali (BR-166) va oylik hisobotlar arxivi (BR-167).
 */
export function NotificationsPage({
  householdId,
  currentMonth,
  baseCurrency,
}: {
  householdId: string
  currentMonth: MonthKey
  baseCurrency: string
}) {
  const { t } = useTranslation()
  const prefs = useQuery(prefsQuery(householdId))
  const telegram = useQuery(telegramQuery)

  return (
    <div className="space-y-6">
      <PageHeader title={t('notifications.title')} description={t('notifications.description')} />

      {prefs.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : prefs.error ? (
        <QueryError
          error={prefs.error}
          onRetry={() => {
            void prefs.refetch()
          }}
        />
      ) : (
        <PrefsSection
          householdId={householdId}
          prefs={prefs.data}
          telegramLinked={telegram.data != null}
        />
      )}

      <TelegramSection householdId={householdId} />
      <TestSection
        householdId={householdId}
        currentMonth={currentMonth}
        baseCurrency={baseCurrency}
      />
      <OutboxSection householdId={householdId} />
      <ArchiveSection householdId={householdId} baseCurrency={baseCurrency} />
    </div>
  )
}
