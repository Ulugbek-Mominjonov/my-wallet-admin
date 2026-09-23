import { useInfiniteQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, ScrollText, X } from 'lucide-react'
import { Fragment, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { auditQuery, type AuditEntry, type AuditFilters } from '@/features/tools/api/audit-api'
import { AUDITED_TABLES, diffRows } from '@/features/tools/model/audit'
import { useAppLocale } from '@/shared/i18n'
import { formatDateTime } from '@/shared/lib/date'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { DateInput } from '@/shared/ui/date-input'
import { EmptyState } from '@/shared/ui/empty-state'
import { FilterMultiSelect } from '@/shared/ui/filter-multi-select'
import { PageHeader } from '@/shared/ui/page-header'
import { QueryError } from '@/shared/ui/query-error'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { TableSkeleton } from '@/shared/ui/table-skeleton'

const NO_FILTERS: AuditFilters = { tables: [], actors: [] }

/** Amal → nishon ko'rinishi. */
const ACTION_VARIANT = {
  insert: 'outline',
  update: 'secondary',
  delete: 'destructive',
} as const

export interface AuditMember {
  value: string
  label: string
}

/**
 * E25-T05 (BR-008): kim, qachon, nimani o'zgartirgani. Filtr (jadval, a'zo,
 * davr) serverda, sahifalar keyset bilan; har yozuvning eski → yangi farqi
 * ochiladi.
 */
export function AuditPage({
  householdId,
  members,
}: {
  householdId: string
  members: readonly AuditMember[]
}) {
  const { t } = useTranslation()
  const locale = useAppLocale()
  const [filters, setFilters] = useState<AuditFilters>(NO_FILTERS)
  const [expanded, setExpanded] = useState<readonly number[]>([])
  const log = useInfiniteQuery(auditQuery(householdId, filters))

  const entries = log.data?.pages.flat() ?? []
  const active =
    filters.tables.length + filters.actors.length + (filters.from ? 1 : 0) + (filters.to ? 1 : 0)
  const memberName = (id: string | null) =>
    members.find((member) => member.value === id)?.label ?? t('audit.system')

  return (
    <div className="space-y-6">
      <PageHeader title={t('audit.title')} description={t('audit.description')} />

      <div className="flex flex-wrap items-center gap-2">
        <FilterMultiSelect
          label={t('audit.filters.tables')}
          options={AUDITED_TABLES.map((table) => ({
            value: table,
            label: t(`audit.tables.${table}`),
          }))}
          value={filters.tables}
          onChange={(tables) => {
            setFilters({ ...filters, tables })
          }}
        />
        <FilterMultiSelect
          label={t('audit.filters.actors')}
          options={members}
          value={filters.actors}
          onChange={(actors) => {
            setFilters({ ...filters, actors })
          }}
        />
        <DateInput
          label={t('transactions.period.from')}
          value={filters.from}
          onChange={(from) => {
            setFilters({ ...filters, from })
          }}
        />
        <DateInput
          label={t('transactions.period.to')}
          value={filters.to}
          onChange={(to) => {
            setFilters({ ...filters, to })
          }}
        />
        {active > 0 && (
          <Button
            variant="ghost"
            onClick={() => {
              setFilters(NO_FILTERS)
            }}
          >
            <X aria-hidden />
            {t('transactions.filters.clear')}
          </Button>
        )}
      </div>

      {log.isPending ? (
        <TableSkeleton />
      ) : log.error ? (
        <QueryError
          error={log.error}
          onRetry={() => {
            void log.refetch()
          }}
        />
      ) : entries.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title={t('audit.empty')}
          description={active > 0 ? t('audit.emptyFiltered') : undefined}
        />
      ) : (
        <>
          <Table aria-label={t('audit.title')}>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>{t('audit.columns.at')}</TableHead>
                <TableHead>{t('audit.columns.actor')}</TableHead>
                <TableHead>{t('audit.columns.table')}</TableHead>
                <TableHead>{t('audit.columns.action')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <Entry
                  key={entry.id}
                  entry={entry}
                  actor={memberName(entry.actor_id)}
                  at={formatDateTime(entry.at, locale)}
                  open={expanded.includes(entry.id)}
                  onToggle={() => {
                    setExpanded(
                      expanded.includes(entry.id)
                        ? expanded.filter((id) => id !== entry.id)
                        : [...expanded, entry.id],
                    )
                  }}
                />
              ))}
            </TableBody>
          </Table>
          {log.hasNextPage && (
            <Button
              variant="outline"
              disabled={log.isFetchingNextPage}
              onClick={() => {
                void log.fetchNextPage()
              }}
            >
              {t('transactions.loadMore')}
            </Button>
          )}
        </>
      )}
    </div>
  )
}

function Entry({
  entry,
  actor,
  at,
  open,
  onToggle,
}: {
  entry: AuditEntry
  actor: string
  at: string
  open: boolean
  onToggle: () => void
}) {
  const { t } = useTranslation()
  const rows = diffRows(entry.old_values, entry.new_values)

  return (
    <>
      <TableRow>
        <TableCell>
          <Button
            variant="ghost"
            size="icon"
            aria-expanded={open}
            aria-label={t('audit.diff')}
            onClick={onToggle}
          >
            {open ? <ChevronDown aria-hidden /> : <ChevronRight aria-hidden />}
          </Button>
        </TableCell>
        <TableCell className="whitespace-nowrap">{at}</TableCell>
        <TableCell>{actor}</TableCell>
        <TableCell>
          {t(`audit.tables.${entry.table_name}`, { defaultValue: entry.table_name })}
        </TableCell>
        <TableCell>
          <Badge variant={ACTION_VARIANT[entry.action]}>{t(`audit.actions.${entry.action}`)}</Badge>
        </TableCell>
      </TableRow>
      {open && (
        <TableRow>
          <TableCell colSpan={5} className="bg-muted/40">
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('audit.noDiff')}</p>
            ) : (
              <dl className="grid gap-1 text-sm sm:grid-cols-[minmax(0,12rem)_1fr]">
                {rows.map((row) => (
                  <Fragment key={row.field}>
                    <dt className="font-mono text-xs text-muted-foreground">{row.field}</dt>
                    <dd className="break-all">
                      {entry.action === 'insert' ? (
                        formatValue(row.after)
                      ) : entry.action === 'delete' ? (
                        formatValue(row.before)
                      ) : (
                        <>
                          <s className="text-muted-foreground">{formatValue(row.before)}</s>{' '}
                          <span aria-hidden>→</span> {formatValue(row.after)}
                        </>
                      )}
                    </dd>
                  </Fragment>
                ))}
              </dl>
            )}
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

/** Xom qiymat → o'qiladigan matn (obyekt va ro'yxat JSON ko'rinishida). */
function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}
