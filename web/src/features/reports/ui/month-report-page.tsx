import { useQuery } from '@tanstack/react-query'
import { Lock, Printer } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import {
  monthReportQuery,
  savingsReportQuery,
  type MonthReport,
  type SavingsReport,
} from '@/features/reports/api/reports-api'
import { monthReportRows } from '@/features/reports/model/export-rows'
import { incomeOutsideTypes } from '@/features/reports/model/month-report'
import { CategoryLimits, IncomeMatrix, UnpaidPlans } from '@/features/reports/ui/report-tables'
import { useAppLocale } from '@/shared/i18n'
import { formatMoney } from '@/shared/lib/money'
import { formatMonth, type MonthKey } from '@/shared/lib/month'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { ExportCsvButton } from '@/shared/ui/export-csv-button'
import { MoneyText } from '@/shared/ui/money-text'
import { MonthStepper } from '@/shared/ui/month-stepper'
import { PageHeader } from '@/shared/ui/page-header'
import { ProgressBar } from '@/shared/ui/progress-bar'
import { QueryError } from '@/shared/ui/query-error'
import { SectionCard } from '@/shared/ui/section-card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { TableSkeleton } from '@/shared/ui/table-skeleton'

/**
 * E24-T02: oylik hisobot — yakun, daromad turlari, orttirish, prognoz,
 * kategoriya/limitlar, fond, qarz, maqsad va to'lanmagan rejalar (BR-090..103).
 * Chop etishda faqat hisobot qoladi (print uslublari — index.css).
 */
export function MonthReportPage({
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
  const report = useQuery(monthReportQuery(householdId, month))
  const savings = useQuery(savingsReportQuery(householdId))
  const money = (value: number) => formatMoney(value, { currency: baseCurrency, locale })

  const header = (
    <>
      <PageHeader
        title={t('report.title')}
        description={t('report.description')}
        actions={
          <>
            {report.data && (
              <ExportCsvButton
                fileName={`hisobot-${month}.csv`}
                rows={() =>
                  monthReportRows(report.data, {
                    t,
                    major: (minor) => minor / 100,
                    month: (iso) => formatMonth(iso.slice(0, 7), locale),
                  })
                }
              />
            )}
            <Button
              variant="outline"
              className="print:hidden"
              onClick={() => {
                window.print()
              }}
            >
              <Printer aria-hidden />
              {t('report.print')}
            </Button>
          </>
        }
      />
      <div className="flex flex-wrap items-center gap-3">
        <div className="print:hidden">
          <MonthStepper value={month} current={currentMonth} onChange={onMonthChange} />
        </div>
        <span className="hidden font-medium print:inline">{formatMonth(month, locale)}</span>
        {report.data?.closed && (
          <Badge variant="secondary">
            <Lock aria-hidden />
            {t('report.closed')}
          </Badge>
        )}
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
  const { totals, derived, projection } = data

  return (
    <div className="space-y-6">
      {header}

      <SectionCard title={t('report.summary.title')}>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Figure label={t('report.summary.income')}>
            <MoneyText amount={totals.income} currency={baseCurrency} tone="income" />
          </Figure>
          <Figure
            label={t('report.summary.expense')}
            hint={`${t('report.summary.allocated')}: ${money(totals.allocated)}`}
          >
            <MoneyText amount={totals.expense} currency={baseCurrency} tone="expense" />
          </Figure>
          <Figure label={t('report.summary.planned')}>{money(totals.planned)}</Figure>
          <Figure
            label={t('report.summary.unpaid')}
            hint={
              totals.unknown_count > 0
                ? t('report.summary.unknown', { count: totals.unknown_count })
                : undefined
            }
          >
            {money(totals.unpaid)}
          </Figure>
          <Figure label={t('report.summary.balance')}>
            <MoneyText amount={derived.balance} currency={baseCurrency} tone="auto" />
          </Figure>
          <Figure label={t('report.summary.forecast')}>
            <MoneyText amount={derived.forecast} currency={baseCurrency} tone="auto" />
          </Figure>
          <Figure label={t('report.summary.card')}>{money(derived.card)}</Figure>
          <Figure label={t('report.summary.cash')}>{money(derived.cash)}</Figure>
          <Figure label={t('report.summary.spent')}>
            <span className="tabular-nums">{percent(derived.spent_ratio)}</span>
          </Figure>
          <Figure label={t('report.summary.fundSpent')}>{money(totals.fund_spent)}</Figure>
        </dl>
      </SectionCard>

      <SectionCard title={t('report.income.title')}>
        <IncomeMatrix
          rows={data.by_type}
          total={totals.income}
          outside={incomeOutsideTypes(data)}
          baseCurrency={baseCurrency}
        />
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title={t('report.savings.title')}>
          <SavingsFigures data={data} summary={savings.data?.summary} baseCurrency={baseCurrency} />
        </SectionCard>
        <SectionCard title={t('report.projection.title')}>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Figure label={t('report.projection.days')}>
              <span className="tabular-nums">
                {projection.days_elapsed} / {projection.days_in_month}
              </span>
            </Figure>
            <Figure label={t('report.projection.daily')}>{money(projection.daily_spend)}</Figure>
            <Figure label={t('report.projection.monthEndSpend')}>
              {money(projection.month_end_spend)}
            </Figure>
            <Figure
              label={t('report.projection.incomeExpected')}
              hint={
                projection.income_pending
                  ? t('report.projection.incomeReceived', {
                      amount: money(projection.income_received),
                    })
                  : undefined
              }
            >
              {money(projection.income_expected)}
            </Figure>
            <Figure label={t('report.projection.monthEndBalance')}>
              <MoneyText
                amount={projection.month_end_balance}
                currency={baseCurrency}
                tone="auto"
              />
            </Figure>
            <Figure label={t('report.projection.avgExpense')}>
              {savings.data ? money(savings.data.summary.avg_monthly_expense) : '—'}
            </Figure>
          </dl>
        </SectionCard>
      </div>

      <SectionCard title={t('report.categories.title')}>
        <CategoryLimits rows={data.by_category} baseCurrency={baseCurrency} />
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title={t('report.fund.title')}>
          <dl className="grid gap-4 sm:grid-cols-3">
            <Figure label={t('report.fund.allocated')}>{money(data.fund.allocated)}</Figure>
            <Figure label={t('report.fund.spent')}>{money(data.fund.spent)}</Figure>
            <Figure label={t('report.fund.balance')}>{money(data.fund.balance)}</Figure>
          </dl>
        </SectionCard>
        <SectionCard title={t('report.debts.title')}>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Figure label={t('report.debts.iOwe')}>{money(data.debts.i_owe)}</Figure>
            <Figure label={t('report.debts.owedToMe')}>{money(data.debts.owed_to_me)}</Figure>
            <Figure label={t('report.debts.monthly')}>
              {money(data.debts.monthly_obligation)}
            </Figure>
            <Figure label={t('report.debts.net')}>
              <MoneyText amount={data.debts.net} currency={baseCurrency} tone="auto" />
            </Figure>
            <Figure label={t('report.debts.paid')}>{money(data.debts.paid_this_month)}</Figure>
          </dl>
        </SectionCard>
      </div>

      <SectionCard title={t('report.goals.title')}>
        {data.goals.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('report.goals.empty')}</p>
        ) : (
          <Table aria-label={t('report.goals.title')}>
            <TableHeader>
              <TableRow>
                <TableHead>{t('report.goals.name')}</TableHead>
                <TableHead className="text-right">{t('report.goals.saved')}</TableHead>
                <TableHead className="text-right">{t('report.goals.remaining')}</TableHead>
                <TableHead className="w-40">{t('report.goals.progress')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.goals.map((goal) => (
                <TableRow key={goal.goal_id}>
                  <TableCell>{goal.name}</TableCell>
                  <TableCell className="text-right">{money(goal.saved)}</TableCell>
                  <TableCell className="text-right">{money(goal.remaining)}</TableCell>
                  <TableCell>
                    <ProgressBar value={goal.progress} label={percent(goal.progress)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>

      <SectionCard title={t('report.unpaid.title')}>
        <UnpaidPlans rows={data.unpaid} baseCurrency={baseCurrency} />
      </SectionCard>
    </div>
  )
}

function SavingsFigures({
  data,
  summary,
  baseCurrency,
}: {
  data: MonthReport
  summary: SavingsReport['summary'] | undefined
  baseCurrency: string
}) {
  const { t } = useTranslation()
  const locale = useAppLocale()
  const money = (value: number) => formatMoney(value, { currency: baseCurrency, locale })
  return (
    <dl className="grid gap-4 sm:grid-cols-2">
      <Figure label={t('report.savings.thisMonth')}>
        <MoneyText amount={data.savings.this_month} currency={baseCurrency} tone="auto" />
      </Figure>
      <Figure label={t('report.savings.ratio')}>
        <span className="tabular-nums">{percent(data.derived.saved_ratio)}</span>
      </Figure>
      <Figure label={t('report.savings.before')}>{money(data.savings.before)}</Figure>
      <Figure label={t('report.savings.total')}>
        <MoneyText amount={data.savings.total} currency={baseCurrency} tone="auto" />
      </Figure>
      <Figure label={t('report.savings.avg')}>
        {summary ? money(summary.avg_monthly_saved) : '—'}
      </Figure>
      <Figure label={t('report.savings.months')}>
        <span className="tabular-nums">{summary?.months_count ?? '—'}</span>
      </Figure>
    </dl>
  )
}

/** Hisobotdagi bitta ko'rsatkich: yorliq, qiymat va ixtiyoriy izoh. */
function Figure({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="font-medium">{children}</dd>
      {hint && <dd className="text-xs text-muted-foreground">{hint}</dd>}
    </div>
  )
}

const percent = (ratio: number | null) =>
  ratio === null ? '—' : `${String(Math.round(ratio * 100))}%`
