import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import type { Account } from '@/entities/account'
import {
  fundReportQuery,
  savingsReportQuery,
  type SavingsReport,
} from '@/features/reports/api/reports-api'
import { savingsRows } from '@/features/reports/model/export-rows'
import { savingsChartPoints } from '@/features/reports/model/savings-report'
import { useAppLocale } from '@/shared/i18n'
import { formatDate } from '@/shared/lib/date'
import { formatMoney } from '@/shared/lib/money'
import { formatMonth, shiftMonth, type MonthKey } from '@/shared/lib/month'
import { Badge } from '@/shared/ui/badge'
import { ChartFigure, ChartLegend } from '@/shared/ui/chart/chart-figure'
import { ColumnChart } from '@/shared/ui/chart/column-chart'
import { ExportCsvButton } from '@/shared/ui/export-csv-button'
import { MoneyText } from '@/shared/ui/money-text'
import { PageHeader } from '@/shared/ui/page-header'
import { QueryError } from '@/shared/ui/query-error'
import { SectionCard } from '@/shared/ui/section-card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { TableSkeleton } from '@/shared/ui/table-skeleton'

const SERIES = { monthly: 'var(--chart-3)', accumulated: 'var(--chart-7)' }
/** Fond daftari va grafik uchun oynacha — so'nggi 12 oy. */
const MONTHS_BACK = 11

/**
 * E24-T04: jamg'arma (oylik va to'plangan), 👤 fond daftari va hisoblar
 * qoldig'i (BR-100..103, BR-060..065, BR-021).
 */
export function SavingsReportPage({
  householdId,
  currentMonth,
  baseCurrency,
  accounts,
}: {
  householdId: string
  currentMonth: MonthKey
  baseCurrency: string
  accounts: readonly Account[]
}) {
  const { t } = useTranslation()
  const locale = useAppLocale()
  const savings = useQuery(savingsReportQuery(householdId))
  const fund = useQuery(
    fundReportQuery(householdId, shiftMonth(currentMonth, -MONTHS_BACK), currentMonth),
  )
  const money = (value: number) => formatMoney(value, { currency: baseCurrency, locale })

  const header = (
    <PageHeader
      title={t('report.savingsPage.title')}
      description={t('report.savingsPage.description')}
      actions={
        savings.data && (
          <ExportCsvButton
            fileName="jamgarma.csv"
            rows={() =>
              savingsRows(savings.data, {
                t,
                major: (minor) => minor / 100,
                month: (iso) => formatMonth(iso.slice(0, 7), locale),
              })
            }
          />
        )
      }
    />
  )
  if (savings.isPending) {
    return (
      <div className="space-y-6">
        {header}
        <TableSkeleton />
      </div>
    )
  }
  if (savings.error) {
    return (
      <div className="space-y-6">
        {header}
        <QueryError
          error={savings.error}
          onRetry={() => {
            void savings.refetch()
          }}
        />
      </div>
    )
  }

  const months = savings.data.months
  const points = savingsChartPoints(months, locale)

  return (
    <div className="space-y-6">
      {header}

      {months.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('report.savingsPage.empty')}</p>
      ) : (
        <>
          <ChartFigure
            title={t('report.savingsPage.chart')}
            legend={
              <ChartLegend
                items={[
                  { label: t('report.savingsPage.monthly'), color: SERIES.monthly },
                  { label: t('report.savingsPage.accumulated'), color: SERIES.accumulated },
                ]}
              />
            }
          >
            <ColumnChart
              points={points}
              series={[
                { key: 'monthly', label: t('report.savingsPage.monthly'), color: SERIES.monthly },
              ]}
              line={{
                key: 'accumulated',
                label: t('report.savingsPage.accumulated'),
                color: SERIES.accumulated,
              }}
              formatValue={(value) => compact(value)}
              formatTooltip={money}
            />
          </ChartFigure>

          <SectionCard title={t('report.savingsPage.title')}>
            <SavingsTable months={months} baseCurrency={baseCurrency} />
          </SectionCard>
        </>
      )}

      <SectionCard
        title={t('report.fundPage.title')}
        description={t('report.fundPage.description')}
      >
        {fund.data ? (
          <div className="space-y-4">
            <dl className="grid gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-sm text-muted-foreground">{t('report.fundPage.allocated')}</dt>
                <dd className="font-medium">{money(fund.data.total_allocated)}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">{t('report.fundPage.spent')}</dt>
                <dd className="font-medium">{money(fund.data.total_spent)}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">{t('report.fundPage.balance')}</dt>
                <dd className="font-medium">
                  <MoneyText amount={fund.data.balance} currency={baseCurrency} tone="auto" />
                </dd>
              </div>
            </dl>
            <Table aria-label={t('report.fundPage.spends')}>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('report.fundPage.date')}</TableHead>
                  <TableHead>{t('report.fundPage.note')}</TableHead>
                  <TableHead className="text-right">{t('report.fundPage.amount')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fund.data.spends.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground">
                      {t('report.fundPage.emptySpends')}
                    </TableCell>
                  </TableRow>
                ) : (
                  fund.data.spends.map((spend) => (
                    <TableRow key={spend.id}>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {formatDate(spend.occurred_on, locale)}
                      </TableCell>
                      <TableCell>{spend.payee ?? spend.note ?? '—'}</TableCell>
                      <TableCell className="text-right">{money(spend.amount)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        ) : (
          <TableSkeleton rows={3} />
        )}
      </SectionCard>

      <SectionCard title={t('report.accounts.title')}>
        <AccountBalances accounts={accounts} baseCurrency={baseCurrency} />
      </SectionCard>
    </div>
  )
}

function SavingsTable({
  months,
  baseCurrency,
}: {
  months: SavingsReport['months']
  baseCurrency: string
}) {
  const { t } = useTranslation()
  const locale = useAppLocale()
  const money = (value: number) => formatMoney(value, { currency: baseCurrency, locale })
  return (
    <Table aria-label={t('report.savingsPage.title')}>
      <TableHeader>
        <TableRow>
          <TableHead>{t('report.savingsPage.month')}</TableHead>
          <TableHead className="text-right">{t('report.savingsPage.income')}</TableHead>
          <TableHead className="text-right">{t('report.savingsPage.expense')}</TableHead>
          <TableHead className="text-right">{t('report.savingsPage.monthly')}</TableHead>
          <TableHead className="text-right">{t('report.savingsPage.accumulated')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {[...months].reverse().map((row) => (
          <TableRow key={row.month}>
            <TableCell className="whitespace-nowrap">
              {formatMonth(row.month.slice(0, 7), locale)}
              {row.is_current && (
                <Badge variant="outline" className="ml-2">
                  ⏳ {t('report.savingsPage.current')}
                </Badge>
              )}
            </TableCell>
            <TableCell className="text-right">{money(row.income)}</TableCell>
            <TableCell className="text-right">{money(row.expense)}</TableCell>
            <TableCell className="text-right">
              <MoneyText amount={row.balance} currency={baseCurrency} tone="auto" />
            </TableCell>
            <TableCell className="text-right">
              <MoneyText amount={row.accumulated} currency={baseCurrency} tone="auto" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

/** BR-021: hisoblar qoldig'i (har biri o'z valyutasida; jami — asosiy valyutadagilar). */
function AccountBalances({
  accounts,
  baseCurrency,
}: {
  accounts: readonly Account[]
  baseCurrency: string
}) {
  const { t } = useTranslation()
  const locale = useAppLocale()
  if (accounts.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('report.accounts.empty')}</p>
  }
  const total = accounts
    .filter((account) => account.currency === baseCurrency)
    .reduce((sum, account) => sum + account.balance, 0)

  return (
    <Table aria-label={t('report.accounts.title')}>
      <TableHeader>
        <TableRow>
          <TableHead>{t('report.accounts.name')}</TableHead>
          <TableHead>{t('report.accounts.currency')}</TableHead>
          <TableHead className="text-right">{t('report.accounts.balance')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {accounts.map((account) => (
          <TableRow key={account.id}>
            <TableCell>{account.name}</TableCell>
            <TableCell className="text-muted-foreground">{account.currency}</TableCell>
            <TableCell className="text-right">
              <MoneyText amount={account.balance} currency={account.currency} tone="auto" />
            </TableCell>
          </TableRow>
        ))}
        <TableRow className="font-medium">
          <TableCell colSpan={2}>{t('report.accounts.total')}</TableCell>
          <TableCell className="text-right">
            <MoneyText amount={total} currency={baseCurrency} tone="auto" locale={locale} />
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  )
}

/** O'q yorlig'i: tiyin → qisqa ko'rinish. */
function compact(minor: number): string {
  const major = minor / 100
  if (major >= 1_000_000) return `${(major / 1_000_000).toFixed(1).replace('.0', '')}M`
  if (major >= 1000) return `${Math.round(major / 1000).toString()}K`
  return String(Math.round(major))
}
