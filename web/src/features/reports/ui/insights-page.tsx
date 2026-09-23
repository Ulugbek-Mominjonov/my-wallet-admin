import { useQuery } from '@tanstack/react-query'
import { Lightbulb } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { insightsQuery } from '@/features/reports/api/reports-api'
import { busiestWeekday, yearlyTotal } from '@/features/reports/model/insights'
import { SpikeList } from '@/features/reports/ui/report-tables'
import { useAppLocale } from '@/shared/i18n'
import { formatDate, weekdayName } from '@/shared/lib/date'
import { formatMoney } from '@/shared/lib/money'
import type { MonthKey } from '@/shared/lib/month'
import { BarList } from '@/shared/ui/chart/bar-list'
import { EmptyState } from '@/shared/ui/empty-state'
import { MonthStepper } from '@/shared/ui/month-stepper'
import { PageHeader } from '@/shared/ui/page-header'
import { QueryError } from '@/shared/ui/query-error'
import { SectionCard } from '@/shared/ui/section-card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { TableSkeleton } from '@/shared/ui/table-skeleton'

/**
 * E32-T02: "Tahlillar" — kategoriya sakrashi, obunalar, eng katta xarajatlar
 * va hafta kunlari kesimi (`report_insights`, E32-T01).
 */
export function InsightsPage({
  householdId,
  month,
  currentMonth,
  onMonthChange,
  baseCurrency,
}: {
  householdId: string
  month: MonthKey
  currentMonth: MonthKey
  onMonthChange: (month: MonthKey) => void
  baseCurrency: string
}) {
  const { t } = useTranslation()
  const locale = useAppLocale()
  const insights = useQuery(insightsQuery(householdId, month))
  const money = (value: number) => formatMoney(value, { currency: baseCurrency, locale })

  const header = (
    <>
      <PageHeader
        title={t('report.insights.title')}
        description={t('report.insights.description')}
      />
      <MonthStepper value={month} current={currentMonth} onChange={onMonthChange} />
    </>
  )

  if (insights.isPending) {
    return (
      <div className="space-y-6">
        {header}
        <TableSkeleton />
      </div>
    )
  }
  if (insights.error) {
    return (
      <div className="space-y-6">
        {header}
        <QueryError
          error={insights.error}
          onRetry={() => {
            void insights.refetch()
          }}
        />
      </div>
    )
  }

  const data = insights.data
  const busiest = busiestWeekday(data.weekdays)
  if (data.expense === 0 && data.subscriptions.length === 0) {
    return (
      <div className="space-y-6">
        {header}
        <EmptyState
          icon={Lightbulb}
          title={t('report.insights.emptyTitle')}
          description={t('report.insights.emptyText')}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {header}

      <SectionCard
        title={t('report.insights.spikes')}
        description={t('report.insights.spikesHint')}
      >
        {data.spikes.length > 0 ? (
          <SpikeList rows={data.spikes} baseCurrency={baseCurrency} />
        ) : (
          <p className="text-sm text-muted-foreground">{t('report.insights.spikesEmpty')}</p>
        )}
      </SectionCard>

      <SectionCard
        title={t('report.insights.subscriptions')}
        description={t('report.insights.subscriptionsHint')}
      >
        {data.subscriptions.length > 0 ? (
          <div className="space-y-3">
            <Table aria-label={t('report.insights.subscriptions')}>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('report.insights.payee')}</TableHead>
                  <TableHead className="text-right">{t('report.insights.amount')}</TableHead>
                  <TableHead className="text-right">{t('report.insights.months')}</TableHead>
                  <TableHead className="text-right">{t('report.insights.lastOn')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.subscriptions.map((row) => (
                  <TableRow key={`${row.payee}-${String(row.amount)}`}>
                    <TableCell>{row.payee}</TableCell>
                    <TableCell className="text-right">{money(row.amount)}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.months}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {formatDate(row.last_on, locale)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="text-sm text-muted-foreground">
              {t('report.insights.subscriptionsTotal', {
                monthly: money(data.subscriptions_total),
                yearly: money(yearlyTotal(data.subscriptions_total)),
              })}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t('report.insights.subscriptionsEmpty')}</p>
        )}
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title={t('report.insights.top')}>
          {data.top_expenses.length > 0 ? (
            <Table aria-label={t('report.insights.top')}>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('report.insights.date')}</TableHead>
                  <TableHead>{t('report.insights.payee')}</TableHead>
                  <TableHead className="text-right">{t('report.insights.amount')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.top_expenses.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(row.occurred_on, locale)}
                    </TableCell>
                    <TableCell>
                      <span className="block truncate">{row.payee ?? row.category}</span>
                      {row.payee && (
                        <span className="block text-xs text-muted-foreground">{row.category}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{money(row.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">{t('report.insights.topEmpty')}</p>
          )}
        </SectionCard>

        <SectionCard
          title={t('report.insights.weekdays')}
          description={
            busiest === null
              ? t('report.insights.weekdaysHint')
              : t('report.insights.busiest', { day: weekdayName(busiest, locale) })
          }
        >
          <BarList
            items={data.weekdays.map((row) => ({
              key: String(row.dow),
              label: weekdayName(row.dow, locale),
              value: row.amount,
              text: money(row.amount),
            }))}
            total={data.expense}
          />
        </SectionCard>
      </div>
    </div>
  )
}
