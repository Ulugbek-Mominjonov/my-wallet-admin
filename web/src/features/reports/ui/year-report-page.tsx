import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Lock } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { yearReportQuery, type YearReport } from '@/features/reports/api/reports-api'
import { yearReportRows } from '@/features/reports/model/export-rows'
import { yearSummary } from '@/features/reports/model/insights'
import { yearChartPoints } from '@/features/reports/model/year-report'
import { useAppLocale } from '@/shared/i18n'
import { formatMoney } from '@/shared/lib/money'
import { formatMonth } from '@/shared/lib/month'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { ChartFigure, ChartLegend } from '@/shared/ui/chart/chart-figure'
import { ColumnChart } from '@/shared/ui/chart/column-chart'
import { ExportCsvButton } from '@/shared/ui/export-csv-button'
import { MoneyText } from '@/shared/ui/money-text'
import { Figure } from '@/features/reports/ui/report-tables'
import { PageHeader } from '@/shared/ui/page-header'
import { QueryError } from '@/shared/ui/query-error'
import { SectionCard } from '@/shared/ui/section-card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { TableSkeleton } from '@/shared/ui/table-skeleton'

/** Grafik qatorlari — xulosadagi bilan bir xil (tekshirilgan palitra). */
const SERIES = {
  income: 'var(--chart-1)',
  expense: 'var(--chart-2)',
  saved: 'var(--chart-7)',
}

/**
 * E24-T03: yillik ko'rinish — 12 oy jadvali (JAMI qatori bilan) va ustunli
 * grafik (daromad/xarajat) + orttirgan chizig'i.
 */
export function YearReportPage({
  householdId,
  year,
  currentYear,
  onYearChange,
  baseCurrency,
}: {
  householdId: string
  year: number
  currentYear: number
  onYearChange: (year: number) => void
  baseCurrency: string
}) {
  const { t } = useTranslation()
  const locale = useAppLocale()
  const report = useQuery(yearReportQuery(householdId, year))
  const money = (value: number) => formatMoney(value, { currency: baseCurrency, locale })

  const header = (
    <>
      <PageHeader
        title={t('report.year.title')}
        description={t('report.year.description')}
        actions={
          report.data && (
            <ExportCsvButton
              fileName={`hisobot-${String(year)}.csv`}
              rows={() =>
                yearReportRows(report.data, {
                  t,
                  major: (minor) => minor / 100,
                  month: (iso) => formatMonth(iso.slice(0, 7), locale),
                })
              }
            />
          )
        }
      />
      <div className="flex flex-wrap items-center gap-1 print:hidden">
        <Button
          variant="outline"
          size="icon"
          aria-label={t('report.year.prev')}
          onClick={() => {
            onYearChange(year - 1)
          }}
        >
          <ChevronLeft aria-hidden />
        </Button>
        <span aria-live="polite" className="min-w-20 text-center text-sm font-medium tabular-nums">
          {year}
        </span>
        <Button
          variant="outline"
          size="icon"
          aria-label={t('report.year.next')}
          disabled={year >= currentYear}
          onClick={() => {
            onYearChange(year + 1)
          }}
        >
          <ChevronRight aria-hidden />
        </Button>
      </div>
    </>
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

  const data = report.data
  const points = yearChartPoints(data.months, locale)
  const hasRecords = data.months.some((month) => month.has_records)

  return (
    <div className="space-y-6">
      {header}
      {hasRecords ? (
        <>
          <YearSummaryCard data={data} baseCurrency={baseCurrency} />
          <ChartFigure
            title={t('report.year.chart')}
            legend={
              <ChartLegend
                items={[
                  { label: t('report.year.income'), color: SERIES.income },
                  { label: t('report.year.expense'), color: SERIES.expense },
                  { label: t('report.year.saved'), color: SERIES.saved },
                ]}
              />
            }
          >
            <ColumnChart
              points={points}
              series={[
                { key: 'income', label: t('report.year.income'), color: SERIES.income },
                { key: 'expense', label: t('report.year.expense'), color: SERIES.expense },
              ]}
              line={{ key: 'saved', label: t('report.year.saved'), color: SERIES.saved }}
              formatValue={(value) => compact(value)}
              formatTooltip={money}
            />
          </ChartFigure>
          <YearTable data={data} baseCurrency={baseCurrency} />
        </>
      ) : (
        <p className="text-sm text-muted-foreground">{t('report.year.empty')}</p>
      )}
    </div>
  )
}

/** E32-T02: "Yil xulosasi" — jamlar, oylik o'rtacha va eng yaxshi/og'ir oy. */
function YearSummaryCard({ data, baseCurrency }: { data: YearReport; baseCurrency: string }) {
  const { t } = useTranslation()
  const locale = useAppLocale()
  const money = (value: number) => formatMoney(value, { currency: baseCurrency, locale })
  const summary = yearSummary(data)
  const monthLabel = (month: YearReport['months'][number]) =>
    `${formatMonth(month.month.slice(0, 7), locale)} · ${money(month.saved)}`

  return (
    <SectionCard
      title={t('report.year.summary.title')}
      description={t('report.year.summary.hint', { count: summary.monthsCount })}
    >
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Figure label={t('report.year.income')}>
          <MoneyText amount={summary.income} currency={baseCurrency} tone="income" />
        </Figure>
        <Figure label={t('report.year.expense')}>
          <MoneyText amount={summary.expense} currency={baseCurrency} tone="expense" />
        </Figure>
        <Figure
          label={t('report.year.saved')}
          hint={`${String(Math.round(summary.savedRatio * 100))}%`}
        >
          <MoneyText amount={summary.saved} currency={baseCurrency} tone="auto" />
        </Figure>
        <Figure label={t('report.year.summary.avgExpense')}>{money(summary.avgExpense)}</Figure>
        {summary.best && (
          <Figure label={t('report.year.summary.best')}>
            <span className="text-base font-medium">{monthLabel(summary.best)}</span>
          </Figure>
        )}
        {summary.worst && (
          <Figure label={t('report.year.summary.worst')}>
            <span className="text-base font-medium">{monthLabel(summary.worst)}</span>
          </Figure>
        )}
      </dl>
    </SectionCard>
  )
}

function YearTable({ data, baseCurrency }: { data: YearReport; baseCurrency: string }) {
  const { t } = useTranslation()
  const locale = useAppLocale()
  const money = (value: number) => formatMoney(value, { currency: baseCurrency, locale })
  const percent = (ratio: number) => `${String(Math.round(ratio * 100))}%`

  return (
    <div className="rounded-lg border">
      <Table aria-label={t('report.year.title')}>
        <TableHeader>
          <TableRow>
            <TableHead>{t('report.year.month')}</TableHead>
            <TableHead className="text-right">{t('report.year.income')}</TableHead>
            <TableHead className="text-right">{t('report.year.expense')}</TableHead>
            <TableHead className="text-right">{t('report.year.allocated')}</TableHead>
            <TableHead className="text-right">{t('report.year.balance')}</TableHead>
            <TableHead className="text-right">{t('report.year.savedRatio')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.months.map((month) => (
            <TableRow
              key={month.month}
              className={cn(!month.has_records && 'text-muted-foreground')}
            >
              <TableCell className="whitespace-nowrap">
                {formatMonth(month.month.slice(0, 7), locale)}
                {month.closed && (
                  <Lock aria-label={t('report.year.closed')} className="ml-1 inline size-3" />
                )}
              </TableCell>
              <TableCell className="text-right">{money(month.income)}</TableCell>
              <TableCell className="text-right">{money(month.expense)}</TableCell>
              <TableCell className="text-right">{money(month.allocated)}</TableCell>
              <TableCell className="text-right">
                <MoneyText amount={month.balance} currency={baseCurrency} tone="auto" />
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {percent(month.saved_ratio)}
              </TableCell>
            </TableRow>
          ))}
          <TableRow className="font-medium">
            <TableCell>{t('report.year.total')}</TableCell>
            <TableCell className="text-right">{money(data.totals.income)}</TableCell>
            <TableCell className="text-right">{money(data.totals.expense)}</TableCell>
            <TableCell className="text-right">{money(data.totals.allocated)}</TableCell>
            <TableCell className="text-right">
              <MoneyText amount={data.totals.balance} currency={baseCurrency} tone="auto" />
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {percent(data.totals.saved_ratio)}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  )
}

/** O'q yorlig'i: 1 200 000 00 tiyin → "12M" (asosiy birlikda). */
function compact(minor: number): string {
  const major = minor / 100
  if (major >= 1_000_000) return `${(major / 1_000_000).toFixed(1).replace('.0', '')}M`
  if (major >= 1000) return `${Math.round(major / 1000).toString()}K`
  return String(Math.round(major))
}
