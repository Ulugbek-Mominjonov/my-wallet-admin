import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { Smartphone } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  devicesQuery,
  syncJournalQuery,
  SYNC_STATUSES,
  type SyncStatus,
} from '@/features/tools/api/sync-api'
import { useAppLocale } from '@/shared/i18n'
import { formatDateTime } from '@/shared/lib/date'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { EmptyState } from '@/shared/ui/empty-state'
import { FilterMultiSelect } from '@/shared/ui/filter-multi-select'
import { PageHeader } from '@/shared/ui/page-header'
import { QueryError } from '@/shared/ui/query-error'
import { SectionCard } from '@/shared/ui/section-card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { TableSkeleton } from '@/shared/ui/table-skeleton'

/** Jurnal standart holati — muammolar (ARXITEKTURA 6). */
const PROBLEM_STATUSES: readonly SyncStatus[] = ['conflict', 'rejected']

const STATUS_VARIANT: Record<SyncStatus, 'default' | 'secondary' | 'destructive'> = {
  ok: 'default',
  conflict: 'secondary',
  rejected: 'destructive',
}

export interface DeviceMember {
  value: string
  label: string
}

/**
 * E25-T07: a'zolar qurilmalari (oxirgi ko'rinish, ilova versiyasi), qurilma
 * bo'yicha sinxron holati va to'qnashuv/rad etish jurnali.
 */
export function DevicesPage({
  householdId,
  members,
}: {
  householdId: string
  members: readonly DeviceMember[]
}) {
  const { t } = useTranslation()
  const locale = useAppLocale()
  const [statuses, setStatuses] = useState<readonly SyncStatus[]>(PROBLEM_STATUSES)
  const devices = useQuery(devicesQuery(householdId))
  const journal = useInfiniteQuery(syncJournalQuery(householdId, statuses))

  const name = (userId: string | null) =>
    members.find((member) => member.value === userId)?.label ?? t('devices.unknownMember')
  const entries = journal.data?.pages.flat() ?? []

  return (
    <div className="space-y-6">
      <PageHeader title={t('devices.title')} description={t('devices.description')} />

      <SectionCard title={t('devices.list')} description={t('devices.listHint')}>
        {devices.isPending ? (
          <TableSkeleton />
        ) : devices.error ? (
          <QueryError
            error={devices.error}
            onRetry={() => {
              void devices.refetch()
            }}
          />
        ) : devices.data.devices.length === 0 ? (
          <EmptyState icon={Smartphone} title={t('devices.empty')} />
        ) : (
          <Table aria-label={t('devices.list')}>
            <TableHeader>
              <TableRow>
                <TableHead>{t('devices.columns.member')}</TableHead>
                <TableHead>{t('devices.columns.platform')}</TableHead>
                <TableHead>{t('devices.columns.version')}</TableHead>
                <TableHead>{t('devices.columns.lastSeen')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {devices.data.devices.map((device) => (
                <TableRow key={`${device.user_id}:${device.last_seen_at}`}>
                  <TableCell>{name(device.user_id)}</TableCell>
                  <TableCell>{device.platform}</TableCell>
                  <TableCell>{device.app_version ?? '—'}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatDateTime(device.last_seen_at, locale)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>

      {devices.data && devices.data.sync.length > 0 && (
        <SectionCard title={t('devices.sync')} description={t('devices.syncHint')}>
          <Table aria-label={t('devices.sync')}>
            <TableHeader>
              <TableRow>
                <TableHead>{t('devices.columns.member')}</TableHead>
                <TableHead>{t('devices.columns.device')}</TableHead>
                <TableHead>{t('devices.columns.lastSync')}</TableHead>
                <TableHead className="text-right">{t('devices.columns.ok')}</TableHead>
                <TableHead className="text-right">{t('devices.columns.conflicts')}</TableHead>
                <TableHead className="text-right">{t('devices.columns.rejected')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {devices.data.sync.map((row) => (
                <TableRow key={`${row.user_id ?? ''}:${row.device_id}`}>
                  <TableCell>{name(row.user_id)}</TableCell>
                  <TableCell className="font-mono text-xs">{row.device_id}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatDateTime(row.last_sync_at, locale)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{row.ok}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.conflicts}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.rejected}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SectionCard>
      )}

      <SectionCard title={t('devices.journal')} description={t('devices.journalHint')}>
        <div className="mb-4">
          <FilterMultiSelect
            label={t('devices.columns.status')}
            options={SYNC_STATUSES.map((status) => ({
              value: status,
              label: t(`devices.statuses.${status}`),
            }))}
            value={statuses}
            onChange={(next) => {
              setStatuses(next.length === 0 ? PROBLEM_STATUSES : (next as SyncStatus[]))
            }}
          />
        </div>
        {journal.isPending ? (
          <TableSkeleton />
        ) : journal.error ? (
          <QueryError
            error={journal.error}
            onRetry={() => {
              void journal.refetch()
            }}
          />
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('devices.journalEmpty')}</p>
        ) : (
          <>
            <Table aria-label={t('devices.journal')}>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('devices.columns.at')}</TableHead>
                  <TableHead>{t('devices.columns.member')}</TableHead>
                  <TableHead>{t('devices.columns.device')}</TableHead>
                  <TableHead>{t('devices.columns.table')}</TableHead>
                  <TableHead>{t('devices.columns.status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.mutation_id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDateTime(entry.applied_at, locale)}
                    </TableCell>
                    <TableCell>{name(entry.user_id)}</TableCell>
                    <TableCell className="font-mono text-xs">{entry.device_id}</TableCell>
                    <TableCell>
                      {t(`audit.tables.${entry.table_name}`, { defaultValue: entry.table_name })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[entry.status]}>
                        {t(`devices.statuses.${entry.status}`)}
                      </Badge>
                      {entry.code !== null && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {t(`devices.codes.${entry.code}`, { defaultValue: entry.code })}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {journal.hasNextPage && (
              <Button
                variant="outline"
                className="mt-4"
                disabled={journal.isFetchingNextPage}
                onClick={() => {
                  void journal.fetchNextPage()
                }}
              >
                {t('transactions.loadMore')}
              </Button>
            )}
          </>
        )}
      </SectionCard>
    </div>
  )
}
