import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import {
  archiveQuery,
  outboxQuery,
  type OutboxEntry,
} from '@/features/notifications/api/notifications-api'
import { useAppLocale } from '@/shared/i18n'
import { formatDateTime } from '@/shared/lib/date'
import { formatMoney } from '@/shared/lib/money'
import { formatMonth, type MonthKey } from '@/shared/lib/month'
import { Badge } from '@/shared/ui/badge'
import { SectionCard } from '@/shared/ui/section-card'
import { Skeleton } from '@/shared/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'

const STATUS_VARIANT: Record<OutboxEntry['status'], 'default' | 'outline' | 'destructive'> = {
  pending: 'outline',
  sending: 'outline',
  sent: 'default',
  failed: 'destructive',
  skipped: 'outline',
}

/** BR-166: o'z yuborish jurnali (90 kun) — oxirgi yozuvlar. */
export function OutboxSection({ householdId }: { householdId: string }) {
  const { t } = useTranslation()
  const locale = useAppLocale()
  const log = useQuery(outboxQuery(householdId))

  return (
    <SectionCard title={t('notifications.log.title')} description={t('notifications.log.hint')}>
      {log.isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : (log.data?.length ?? 0) === 0 ? (
        <p className="text-sm text-muted-foreground">{t('notifications.log.empty')}</p>
      ) : (
        <Table aria-label={t('notifications.log.title')}>
          <TableHeader>
            <TableRow>
              <TableHead>{t('notifications.log.at')}</TableHead>
              <TableHead>{t('notifications.log.channel')}</TableHead>
              <TableHead>{t('notifications.log.type')}</TableHead>
              <TableHead>{t('notifications.log.status')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(log.data ?? []).map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="whitespace-nowrap">
                  {formatDateTime(entry.createdAt, locale)}
                </TableCell>
                <TableCell>{t(`notifications.channel.${entry.channel}`)}</TableCell>
                <TableCell>
                  {t(`notifications.types.${entry.type}`, { defaultValue: entry.type })}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[entry.status]}>
                    {t(`notifications.statuses.${entry.status}`)}
                  </Badge>
                  {entry.error !== null && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {t(`notifications.reasons.${entry.error}`, { defaultValue: entry.error })}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </SectionCard>
  )
}

/** BR-167: oylik hisobotlar arxivi (byudjet a'zolari ko'radi). */
export function ArchiveSection({
  householdId,
  baseCurrency,
}: {
  householdId: string
  baseCurrency: string
}) {
  const { t } = useTranslation()
  const locale = useAppLocale()
  const archive = useQuery(archiveQuery(householdId))
  const money = (value: number) => formatMoney(value, { currency: baseCurrency, locale })

  return (
    <SectionCard
      title={t('notifications.archive.title')}
      description={t('notifications.archive.hint')}
    >
      {archive.isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : (archive.data?.length ?? 0) === 0 ? (
        <p className="text-sm text-muted-foreground">{t('notifications.archive.empty')}</p>
      ) : (
        <Table aria-label={t('notifications.archive.title')}>
          <TableHeader>
            <TableRow>
              <TableHead>{t('notifications.archive.month')}</TableHead>
              <TableHead className="text-right">{t('notifications.archive.income')}</TableHead>
              <TableHead className="text-right">{t('notifications.archive.expense')}</TableHead>
              <TableHead className="text-right">{t('notifications.archive.saved')}</TableHead>
              <TableHead>{t('notifications.archive.generatedAt')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(archive.data ?? []).map((report) => (
              <TableRow key={report.month}>
                <TableCell>{formatMonth(report.month.slice(0, 7) as MonthKey, locale)}</TableCell>
                <TableCell className="text-right tabular-nums">{money(report.income)}</TableCell>
                <TableCell className="text-right tabular-nums">{money(report.expense)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {money(report.saved)}
                  {report.savedRatio !== null && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      {Math.round(report.savedRatio * 100)}%
                    </span>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {formatDateTime(report.generatedAt, locale)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </SectionCard>
  )
}
