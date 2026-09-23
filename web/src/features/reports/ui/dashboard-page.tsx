import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { CalendarClock, PiggyBank, Wallet } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  healthCheckQuery,
  monthReportQuery,
  savingsReportQuery,
  type MonthReport,
} from '@/features/reports/api/reports-api'
import { dashboardFlow, topCategories, UPCOMING_LIMIT } from '@/features/reports/model/dashboard'
import { useAppLocale } from '@/shared/i18n'
import { formatDate } from '@/shared/lib/date'
import { formatMoney } from '@/shared/lib/money'
import { formatMonth, type MonthKey } from '@/shared/lib/month'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { BarList } from '@/shared/ui/chart/bar-list'
import { ChartFigure, ChartLegend } from '@/shared/ui/chart/chart-figure'
import { ColumnChart } from '@/shared/ui/chart/column-chart'
import { MoneyText } from '@/shared/ui/money-text'
import { PageHeader } from '@/shared/ui/page-header'
import { QueryError } from '@/shared/ui/query-error'
import { SectionCard } from '@/shared/ui/section-card'
import { StatCard } from '@/shared/ui/stat-card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { TableSkeleton } from '@/shared/ui/table-skeleton'

/** Grafik qatorlari — tekshirilgan kategorik palitra (yashil/qizil rang ko'rmaslikda ajralmaydi). */
const SERIES = {
  income: 'var(--chart-1)',
  expense: 'var(--chart-2)',
  saved: 'var(--chart-7)',
}

/**
 * E24-T01: joriy oy ko'rsatkichlari, 12 oylik daromad/xarajat, ko'p
 * sarflangan kategoriyalar, yaqin to'lovlar va ogohlantirishlar.
 */
export function DashboardPage({
  householdId,
  month,
  baseCurrency,
}: {
  householdId: string
  month: MonthKey
  baseCurrency: string
}) {
  const { t } = useTranslation()
  const locale = useAppLocale()
  const report = useQuery(monthReportQuery(householdId, month))
  const savings = useQuery(savingsReportQuery(householdId))
  const health = useQuery(healthCheckQuery(householdId))
  const money = (value: number) => formatMoney(value, { currency: baseCurrency, locale })

  // Sarlavha holatdan qat'i nazar ko'rinadi (yuklanish/xato — ostida).
  const header = (
    <PageHeader
      title={t('dashboard.title')}
      description={`${formatMonth(month, locale)} · ${t('dashboard.description')}`}
    />
  )
  if (report.isPending) {
    return (
      <div className="space-y-6">
        {header}
        <TableSkeleton />
      </div>
    )
  }
  if (report.error) {
    return (
      <div className="space-y-6">
        {header}
        <QueryError
          error={report.error}
          onRetry={() => {
            void report.refetch()
          }}
        />
      </div>
    )
  }

  const { derived, projection, totals } = report.data
  const flow = dashboardFlow(savings.data?.months ?? [], locale)
  const top = topCategories(report.data.by_category)
  const upcoming = [...report.data.unpaid]
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .slice(0, UPCOMING_LIMIT)

  return (
    <div className="space-y-6">
      {header}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t('dashboard.kpi.balance')}
          value={<MoneyText amount={derived.balance} currency={baseCurrency} tone="auto" />}
          hint={t('dashboard.kpi.balanceHint')}
          icon={Wallet}
        />
        <StatCard
          label={t('dashboard.kpi.forecast')}
          value={
            <MoneyText amount={projection.month_end_balance} currency={baseCurrency} tone="auto" />
          }
          hint={t('dashboard.kpi.forecastHint')}
          icon={CalendarClock}
        />
        <StatCard
          label={t('dashboard.kpi.saved')}
          value={<MoneyText amount={derived.saved} currency={baseCurrency} tone="auto" />}
          hint={t('dashboard.kpi.savedHint', { percent: Math.round(derived.saved_ratio * 100) })}
          icon={PiggyBank}
        />
        <StatCard
          label={t('dashboard.kpi.perDay')}
          value={projection.per_day_available === null ? '—' : money(projection.per_day_available)}
          hint={t('dashboard.kpi.perDayHint', {
            days: projection.days_in_month - projection.days_elapsed,
          })}
          icon={Wallet}
        />
      </div>

      <ChartFigure
        title={t('dashboard.flow.title')}
        description={t('dashboard.flow.description', { count: flow.length })}
        legend={
          <ChartLegend
            items={[
              { label: t('dashboard.flow.income'), color: SERIES.income },
              { label: t('dashboard.flow.expense'), color: SERIES.expense },
              { label: t('dashboard.flow.saved'), color: SERIES.saved },
            ]}
          />
        }
        table={
          <Table aria-label={t('dashboard.flow.title')}>
            <TableHeader>
              <TableRow>
                <TableHead>{t('chart.month')}</TableHead>
                <TableHead className="text-right">{t('dashboard.flow.income')}</TableHead>
                <TableHead className="text-right">{t('dashboard.flow.expense')}</TableHead>
                <TableHead className="text-right">{t('dashboard.flow.saved')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {flow.map((point) => (
                <TableRow key={point.key}>
                  <TableCell>{point.label}</TableCell>
                  <TableCell className="text-right">{money(point.values.income ?? 0)}</TableCell>
                  <TableCell className="text-right">{money(point.values.expense ?? 0)}</TableCell>
                  <TableCell className="text-right">{money(point.values.saved ?? 0)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        }
      >
        {flow.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t('chart.empty')}</p>
        ) : (
          <ColumnChart
            points={flow}
            series={[
              { key: 'income', label: t('dashboard.flow.income'), color: SERIES.income },
              { key: 'expense', label: t('dashboard.flow.expense'), color: SERIES.expense },
            ]}
            line={{ key: 'saved', label: t('dashboard.flow.saved'), color: SERIES.saved }}
            formatValue={(value) => compact(value, baseCurrency, locale)}
            formatTooltip={money}
          />
        )}
      </ChartFigure>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartFigure
          title={t('dashboard.top.title')}
          description={t('dashboard.top.description', { month: formatMonth(month, locale) })}
          table={
            <Table aria-label={t('dashboard.top.title')}>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('transactions.columns.category')}</TableHead>
                  <TableHead className="text-right">{t('chart.value')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {top.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.name}</TableCell>
                    <TableCell className="text-right">{money(item.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          }
        >
          {top.items.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t('dashboard.top.empty')}
            </p>
          ) : (
            <BarList
              total={top.total}
              items={top.items.map((item) => ({
                key: item.id,
                label: item.id === 'other' ? t('dashboard.top.other') : item.name,
                value: item.amount,
                text: money(item.amount),
              }))}
            />
          )}
        </ChartFigure>

        <SectionCard
          title={t('dashboard.upcoming.title')}
          description={t('dashboard.upcoming.description')}
          action={
            <Button
              variant="outline"
              size="sm"
              render={<Link to="/h/$householdId/plans" params={{ householdId }} />}
            >
              {t('dashboard.upcoming.all')}
            </Button>
          }
        >
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('dashboard.upcoming.empty')}</p>
          ) : (
            <ul className="divide-y">
              {upcoming.map((plan) => (
                <li key={plan.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{plan.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(plan.due_date, locale)}
                      {plan.auto_pay && ` · ${t('plans.autoPay')}`}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm tabular-nums">
                    {plan.planned_amount === null
                      ? t('dashboard.upcoming.unknown')
                      : money(Math.max(plan.planned_amount - plan.paid_amount, 0))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <Alerts
        report={report.data}
        problems={health.data?.problems.length ?? 0}
        warnings={health.data?.warnings.length ?? 0}
        unknownCount={totals.unknown_count}
      />
    </div>
  )
}

/** Ogohlantirishlar: limitlar, kechikkan rejalar va tekshiruv natijasi (BR-130). */
function Alerts({
  report,
  problems,
  warnings,
}: {
  report: MonthReport
  problems: number
  warnings: number
  unknownCount: number
}) {
  const { t } = useTranslation()
  const over = report.by_category.filter((row) => row.limit_status === 'over').length
  const near = report.by_category.filter((row) => row.limit_status === 'near').length
  const overdue = report.unpaid.filter((plan) => plan.status === 'overdue').length
  const items = [
    over > 0 && {
      key: 'over',
      text: t('dashboard.alerts.limits', { count: over }),
      tone: 'destructive' as const,
    },
    near > 0 && {
      key: 'near',
      text: t('dashboard.alerts.limitsNear', { count: near }),
      tone: 'secondary' as const,
    },
    overdue > 0 && {
      key: 'overdue',
      text: t('dashboard.alerts.overdue', { count: overdue }),
      tone: 'destructive' as const,
    },
    problems > 0 && {
      key: 'problems',
      text: t('dashboard.alerts.problems', { count: problems }),
      tone: 'destructive' as const,
    },
    warnings > 0 && {
      key: 'warnings',
      text: t('dashboard.alerts.warnings', { count: warnings }),
      tone: 'secondary' as const,
    },
  ].filter((item) => item !== false)

  return (
    <SectionCard title={t('dashboard.alerts.title')}>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('dashboard.alerts.none')}</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {items.map((item) => (
            <li key={item.key}>
              <Badge variant={item.tone}>{item.text}</Badge>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  )
}

/** O'q yorliqlari uchun qisqa summa: 1 200 000 → "1,2 mln". */
function compact(value: number, currency: string, locale: string): string {
  const major = value / 100
  if (major >= 1_000_000) return `${(major / 1_000_000).toFixed(1).replace('.0', '')}M`
  if (major >= 1000) return `${Math.round(major / 1000).toString()}K`
  return formatMoney(value, { currency, locale: locale as 'uz' | 'ru' | 'en' })
}
