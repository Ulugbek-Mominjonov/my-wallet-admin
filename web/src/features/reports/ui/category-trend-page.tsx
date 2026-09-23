import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import type { Category } from '@/entities/category'
import { categoryTrendQuery } from '@/features/reports/api/reports-api'
import { compareRows, trendPoints } from '@/features/reports/model/category-trend'
import { useAppLocale } from '@/shared/i18n'
import { formatMoney } from '@/shared/lib/money'
import { formatMonth, shiftMonth, type MonthKey } from '@/shared/lib/month'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { ChartFigure } from '@/shared/ui/chart/chart-figure'
import { ColumnChart } from '@/shared/ui/chart/column-chart'
import { FormSelect } from '@/shared/ui/form-select'
import { Label } from '@/shared/ui/label'
import { PageHeader } from '@/shared/ui/page-header'
import { QueryError } from '@/shared/ui/query-error'
import { SectionCard } from '@/shared/ui/section-card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { TableSkeleton } from '@/shared/ui/table-skeleton'

const SERIES_COLOR = 'var(--chart-1)'
/** Davr tanlovidagi oylar (joriydan orqaga). */
const MONTH_OPTIONS = 24

/**
 * E24-T05: kategoriya tahlili — tanlangan davr, oyma-oy trend, o'tgan oy va
 * 3 oylik o'rtacha bilan solishtirish (BR-095), kategoriyaga tushish.
 */
export function CategoryTrendPage({
  householdId,
  from,
  to,
  categoryId,
  onRangeChange,
  onCategoryChange,
  currentMonth,
  baseCurrency,
  categories,
}: {
  householdId: string
  from: MonthKey
  to: MonthKey
  categoryId: string | null
  onRangeChange: (range: { from: MonthKey; to: MonthKey }) => void
  onCategoryChange: (categoryId: string | null) => void
  currentMonth: MonthKey
  baseCurrency: string
  categories: readonly Category[]
}) {
  const { t } = useTranslation()
  const locale = useAppLocale()
  const trend = useQuery(categoryTrendQuery(householdId, from, to, categoryId ?? undefined))
  const byId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const money = (value: number) => formatMoney(value, { currency: baseCurrency, locale })
  const months = Array.from({ length: MONTH_OPTIONS }, (_, i) => shiftMonth(currentMonth, -i))
  const monthOptions = months.map((month) => ({
    value: month,
    label: formatMonth(month, locale),
  }))

  const header = (
    <>
      <PageHeader
        title={t('report.categoriesPage.title')}
        description={t('report.categoriesPage.description')}
      />
      <div className="flex flex-wrap items-end gap-3 print:hidden">
        <div className="grid gap-1.5">
          <Label id="trend-from">{t('report.categoriesPage.from')}</Label>
          <FormSelect
            labelId="trend-from"
            value={from}
            options={monthOptions}
            onChange={(value) => {
              onRangeChange({ from: value as MonthKey, to: value > to ? (value as MonthKey) : to })
            }}
          />
        </div>
        <div className="grid gap-1.5">
          <Label id="trend-to">{t('report.categoriesPage.to')}</Label>
          <FormSelect
            labelId="trend-to"
            value={to}
            options={monthOptions}
            onChange={(value) => {
              onRangeChange({
                from: value < from ? (value as MonthKey) : from,
                to: value as MonthKey,
              })
            }}
          />
        </div>
        <div className="grid gap-1.5">
          <Label id="trend-category">{t('report.categoriesPage.category')}</Label>
          <FormSelect
            labelId="trend-category"
            value={categoryId ?? 'all'}
            options={[
              { value: 'all', label: t('report.categoriesPage.all') },
              ...categories
                .filter((c) => c.kind === 'expense')
                .map((c) => ({ value: c.id, label: c.name })),
            ]}
            onChange={(value) => {
              onCategoryChange(value === 'all' ? null : value)
            }}
          />
        </div>
        {categoryId !== null && (
          <Button
            variant="outline"
            render={
              <Link
                to="/h/$householdId/transactions"
                params={{ householdId }}
                search={{ categories: [categoryId], from: `${from}-01`, month: undefined }}
              />
            }
          >
            {t('report.categoriesPage.transactions')}
          </Button>
        )}
      </div>
    </>
  )

  if (trend.isPending) {
    return (
      <div className="space-y-6">
        {header}
        <TableSkeleton />
      </div>
    )
  }
  if (trend.error) {
    return (
      <div className="space-y-6">
        {header}
        <QueryError
          error={trend.error}
          onRetry={() => {
            void trend.refetch()
          }}
        />
      </div>
    )
  }

  const points = trendPoints(trend.data.series, categoryId, locale)
  const rows = compareRows(trend.data.compare, byId, t('report.categoriesPage.unknown'))

  return (
    <div className="space-y-6">
      {header}
      {points.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('report.categoriesPage.empty')}</p>
      ) : (
        <ChartFigure
          title={t('report.categoriesPage.chart')}
          description={
            categoryId === null
              ? t('report.categoriesPage.all')
              : (byId.get(categoryId)?.name ?? t('report.categoriesPage.unknown'))
          }
        >
          <ColumnChart
            points={points}
            series={[
              {
                key: 'actual',
                label: t('report.categoriesPage.actualSeries'),
                color: SERIES_COLOR,
              },
            ]}
            formatValue={(value) => compact(value)}
            formatTooltip={money}
          />
        </ChartFigure>
      )}

      {rows.length > 0 && (
        <SectionCard title={t('report.categoriesPage.category')}>
          <Table aria-label={t('report.categoriesPage.title')}>
            <TableHeader>
              <TableRow>
                <TableHead>{t('report.categoriesPage.category')}</TableHead>
                <TableHead className="text-right">{t('report.categoriesPage.actual')}</TableHead>
                <TableHead className="text-right">{t('report.categoriesPage.prev')}</TableHead>
                <TableHead className="text-right">{t('report.categoriesPage.avg3')}</TableHead>
                <TableHead className="text-right">{t('report.categoriesPage.vsPrev')}</TableHead>
                <TableHead className="text-right">{t('report.categoriesPage.vsAvg3')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={row.categoryId}
                  data-state={row.categoryId === categoryId ? 'selected' : undefined}
                >
                  <TableCell>
                    <Button
                      variant="link"
                      className="h-auto p-0"
                      onClick={() => {
                        onCategoryChange(row.categoryId === categoryId ? null : row.categoryId)
                      }}
                    >
                      {row.name}
                    </Button>
                  </TableCell>
                  <TableCell className="text-right">{money(row.actual)}</TableCell>
                  <TableCell className="text-right">{money(row.prev)}</TableCell>
                  <TableCell className="text-right">{money(row.avg3)}</TableCell>
                  <TableCell className="text-right">
                    <Change value={row.vsPrev} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Change value={row.vsAvg3} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SectionCard>
      )}
    </div>
  )
}

/** O'sish/kamayish: xarajatda o'sish — yomon (qizil), kamayish — yaxshi. */
function Change({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground">—</span>
  const percent = Math.round(value * 100)
  return (
    <span className={cn('tabular-nums', percent > 0 ? 'text-expense' : 'text-income')}>
      {percent > 0 ? '+' : ''}
      {percent}%
    </span>
  )
}

function compact(minor: number): string {
  const major = minor / 100
  if (major >= 1_000_000) return `${(major / 1_000_000).toFixed(1).replace('.0', '')}M`
  if (major >= 1000) return `${Math.round(major / 1000).toString()}K`
  return String(Math.round(major))
}
