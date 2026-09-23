import { useQuery } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { healthQuery, type PlatformHealth } from '@/features/platform/api/platform-api'
import { useAppLocale } from '@/shared/i18n'
import { formatDateTime } from '@/shared/lib/date'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { PageHeader } from '@/shared/ui/page-header'
import { ProgressBar } from '@/shared/ui/progress-bar'
import { QueryError } from '@/shared/ui/query-error'
import { SectionCard } from '@/shared/ui/section-card'
import { Skeleton } from '@/shared/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'

/** Hajmlarni odam o'qiydigan ko'rinishda (MB/GB). */
const MB = 1024 * 1024

const formatBytes = (bytes: number): string =>
  bytes >= 1024 * MB ? `${(bytes / (1024 * MB)).toFixed(1)} GB` : `${Math.round(bytes / MB)} MB`

const STATUS_VARIANT = {
  ok: 'default',
  running: 'outline',
  failed: 'destructive',
} as const

/**
 * E26-T05: bepul reja chegaralari (ARXITEKTURA 1), rejali ishlar va
 * bildirishnoma navbati. 70% dan oshsa — ogohlantirish rangi.
 */
export function PlatformHealthPage() {
  const { t } = useTranslation()
  const locale = useAppLocale()
  const health = useQuery(healthQuery)

  const header = (
    <PageHeader
      title={t('platform.health.title')}
      description={t('platform.health.description')}
      actions={
        <Button
          variant="outline"
          disabled={health.isFetching}
          onClick={() => {
            void health.refetch()
          }}
        >
          <RefreshCw aria-hidden />
          {t('platform.health.refresh')}
        </Button>
      }
    />
  )

  if (health.isPending) {
    return (
      <div className="space-y-6">
        {header}
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }
  if (health.error) {
    return (
      <div className="space-y-6">
        {header}
        <QueryError
          error={health.error}
          onRetry={() => {
            void health.refetch()
          }}
        />
      </div>
    )
  }

  const { stats, limits, jobs, outbox } = health.data

  return (
    <div className="space-y-6">
      {header}

      <SectionCard
        title={t('platform.health.limits')}
        description={t('platform.health.limitsHint')}
      >
        <div className="grid gap-6 sm:grid-cols-2">
          <Usage
            label={t('platform.health.db')}
            bytes={stats.db_bytes}
            limit={limits.db_bytes}
            pct={stats.db_limit_pct}
            warnPct={limits.warn_pct}
          />
          <Usage
            label={t('platform.health.storage')}
            bytes={stats.storage_bytes}
            limit={limits.storage_bytes}
            pct={stats.storage_limit_pct}
            warnPct={limits.warn_pct}
          />
        </div>
        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-muted-foreground">{t('platform.health.users')}</dt>
            <dd className="font-medium tabular-nums">{stats.users}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">{t('platform.health.households')}</dt>
            <dd className="font-medium tabular-nums">{stats.households}</dd>
          </div>
        </dl>
      </SectionCard>

      <SectionCard title={t('platform.health.jobs')} description={t('platform.health.jobsHint')}>
        {jobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('platform.health.noJobs')}</p>
        ) : (
          <Table aria-label={t('platform.health.jobs')}>
            <TableHeader>
              <TableRow>
                <TableHead>{t('platform.health.job')}</TableHead>
                <TableHead>{t('platform.health.lastRun')}</TableHead>
                <TableHead className="text-right">{t('platform.health.duration')}</TableHead>
                <TableHead>{t('platform.health.status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => (
                <TableRow key={job.job}>
                  <TableCell className="font-mono text-xs">{job.job}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatDateTime(job.started_at, locale)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{duration(job)}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[job.status]}>
                      {t(`platform.health.statuses.${job.status}`)}
                    </Badge>
                    {job.status === 'failed' && jobError(job.details) !== '' && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {jobError(job.details)}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>

      <SectionCard title={t('platform.health.queue')} description={t('platform.health.queueHint')}>
        <ul className="flex flex-wrap gap-2">
          <li>
            <Badge variant="outline">
              {t('platform.health.queuePending', { count: outbox.pending })}
            </Badge>
          </li>
          <li>
            <Badge>{t('platform.health.queueSent', { count: outbox.sent })}</Badge>
          </li>
          <li>
            <Badge variant={outbox.failed > 0 ? 'destructive' : 'outline'}>
              {t('platform.health.queueFailed', { count: outbox.failed })}
            </Badge>
          </li>
        </ul>
        {outbox.oldest_pending !== null && (
          <p className="mt-3 text-sm text-muted-foreground">
            {t('platform.health.oldestPending', {
              at: formatDateTime(outbox.oldest_pending, locale),
            })}
          </p>
        )}
      </SectionCard>

      <SectionCard
        title={t('platform.health.tables')}
        description={t('platform.health.tablesHint')}
      >
        <Table aria-label={t('platform.health.tables')}>
          <TableHeader>
            <TableRow>
              <TableHead>{t('platform.health.table')}</TableHead>
              <TableHead className="text-right">{t('platform.health.size')}</TableHead>
              <TableHead className="text-right">{t('platform.health.rows')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(stats.largest_tables ?? []).map((row) => (
              <TableRow key={row.table}>
                <TableCell className="font-mono text-xs">{row.table}</TableCell>
                <TableCell className="text-right tabular-nums">{formatBytes(row.bytes)}</TableCell>
                <TableCell className="text-right tabular-nums">{row.rows}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SectionCard>
    </div>
  )
}

function Usage({
  label,
  bytes,
  limit,
  pct,
  warnPct,
}: {
  label: string
  bytes: number
  limit: number
  pct: number
  warnPct: number
}) {
  const { t } = useTranslation()
  const text = t('platform.health.usage', {
    used: formatBytes(bytes),
    limit: formatBytes(limit),
    pct,
  })
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{text}</span>
      </div>
      <ProgressBar value={pct / 100} tone={pct >= warnPct ? 'warning' : 'primary'} label={text} />
    </div>
  )
}

/** Xato sababi (`details.error`) — boshqa shakldagi tafsilot ko'rsatilmaydi. */
function jobError(details: unknown): string {
  if (details === null || typeof details !== 'object') return ''
  const error = (details as Record<string, unknown>).error
  return typeof error === 'string' ? error : ''
}

/** Ish davomiyligi — soniyada (tugamagan bo'lsa chiziqcha). */
function duration(job: PlatformHealth['jobs'][number]): string {
  if (job.finished_at === null) return '—'
  const ms = new Date(job.finished_at).getTime() - new Date(job.started_at).getTime()
  return `${(ms / 1000).toFixed(1)} s`
}
