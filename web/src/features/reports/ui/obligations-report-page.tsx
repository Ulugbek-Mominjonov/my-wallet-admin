import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { debtsReportQuery, goalsReportQuery } from '@/features/reports/api/reports-api'
import { obligationsRows } from '@/features/reports/model/export-rows'
import { useAppLocale } from '@/shared/i18n'
import { formatMoney } from '@/shared/lib/money'
import { formatMonth } from '@/shared/lib/month'
import { Badge } from '@/shared/ui/badge'
import { ExportCsvButton } from '@/shared/ui/export-csv-button'
import { MoneyText } from '@/shared/ui/money-text'
import { PageHeader } from '@/shared/ui/page-header'
import { ProgressBar } from '@/shared/ui/progress-bar'
import { QueryError } from '@/shared/ui/query-error'
import { SectionCard } from '@/shared/ui/section-card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { TableSkeleton } from '@/shared/ui/table-skeleton'

/** BR-116: qarz holati rangi. */
const DEBT_STATUS: Record<string, 'outline' | 'secondary' | 'default'> = {
  unlinked: 'outline',
  pending: 'secondary',
  paying: 'default',
  closed: 'secondary',
}

/** E24-T04: qarzlar (holat, progress, tugash) va maqsadlar (prognoz, ulguradimi). */
export function ObligationsReportPage({
  householdId,
  baseCurrency,
}: {
  householdId: string
  baseCurrency: string
}) {
  const { t } = useTranslation()
  const locale = useAppLocale()
  const debts = useQuery(debtsReportQuery(householdId))
  const goals = useQuery(goalsReportQuery(householdId))
  const money = (value: number) => formatMoney(value, { currency: baseCurrency, locale })
  const percent = (ratio: number) => `${String(Math.round(ratio * 100))}%`
  const month = (value: string | null) =>
    value === null ? '—' : formatMonth(value.slice(0, 7), locale)

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('report.debtsPage.title')}
        description={t('report.debtsPage.description')}
        actions={
          debts.data &&
          goals.data && (
            <ExportCsvButton
              fileName="qarz-maqsad.csv"
              rows={() =>
                obligationsRows(debts.data, goals.data, {
                  t,
                  major: (minor) => minor / 100,
                  month: (iso) => formatMonth(iso.slice(0, 7), locale),
                })
              }
            />
          )
        }
      />

      <SectionCard title={t('report.debtsPage.title')}>
        {debts.isPending ? (
          <TableSkeleton rows={3} />
        ) : debts.error ? (
          <QueryError
            error={debts.error}
            onRetry={() => {
              void debts.refetch()
            }}
          />
        ) : debts.data.debts.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('report.debtsPage.empty')}</p>
        ) : (
          <div className="space-y-4">
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label={t('report.debts.iOwe')}>{money(debts.data.totals.i_owe)}</Stat>
              <Stat label={t('report.debts.owedToMe')}>{money(debts.data.totals.owed_to_me)}</Stat>
              <Stat label={t('report.debts.monthly')}>
                {money(debts.data.totals.monthly_obligation)}
              </Stat>
              <Stat label={t('report.debts.net')}>
                <MoneyText amount={debts.data.totals.net} currency={baseCurrency} tone="auto" />
              </Stat>
            </dl>
            <Table aria-label={t('report.debtsPage.title')}>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('report.debtsPage.name')}</TableHead>
                  <TableHead className="text-right">{t('report.debtsPage.remaining')}</TableHead>
                  <TableHead className="w-40">{t('report.debtsPage.progress')}</TableHead>
                  <TableHead className="text-right">{t('report.debtsPage.monthly')}</TableHead>
                  <TableHead>{t('report.debtsPage.end')}</TableHead>
                  <TableHead>{t('report.debtsPage.status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {debts.data.debts.map((debt) => (
                  <TableRow key={debt.debt_id}>
                    <TableCell>
                      {debt.name}
                      <span className="block text-xs text-muted-foreground">
                        {t(`debts.directions.${debt.direction}`)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <MoneyText amount={debt.remaining} currency={debt.currency} />
                    </TableCell>
                    <TableCell>
                      <ProgressBar value={debt.progress} label={percent(debt.progress)} />
                    </TableCell>
                    <TableCell className="text-right">
                      {debt.monthly_payment === null
                        ? t('report.debtsPage.unknown')
                        : formatMoney(debt.monthly_payment, { currency: debt.currency, locale })}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{month(debt.end_month)}</TableCell>
                    <TableCell>
                      <Badge variant={DEBT_STATUS[debt.status] ?? 'outline'}>
                        {t(`debts.status.${debt.status}`, { defaultValue: debt.status })}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title={t('report.goalsPage.title')}
        description={t('report.goalsPage.description')}
      >
        {goals.isPending ? (
          <TableSkeleton rows={3} />
        ) : goals.error ? (
          <QueryError
            error={goals.error}
            onRetry={() => {
              void goals.refetch()
            }}
          />
        ) : goals.data.goals.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('report.goalsPage.empty')}</p>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t('report.goalsPage.avg')}: {money(goals.data.avg_monthly_saved)}
            </p>
            <Table aria-label={t('report.goalsPage.title')}>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('report.goalsPage.name')}</TableHead>
                  <TableHead className="text-right">{t('report.goalsPage.saved')}</TableHead>
                  <TableHead className="w-40">{t('report.goalsPage.progress')}</TableHead>
                  <TableHead className="text-right">{t('report.goalsPage.monthly')}</TableHead>
                  <TableHead>{t('report.goalsPage.end')}</TableHead>
                  <TableHead>{t('report.goalsPage.deadline')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {goals.data.goals.map((goal) => (
                  <TableRow key={goal.goal_id}>
                    <TableCell>{goal.name}</TableCell>
                    <TableCell className="text-right">
                      <MoneyText amount={goal.saved} currency={goal.currency} />
                    </TableCell>
                    <TableCell>
                      <ProgressBar
                        value={goal.progress}
                        tone={goal.on_track === false ? 'warning' : 'income'}
                        label={percent(goal.progress)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      {goal.monthly === null ? (
                        '—'
                      ) : (
                        <>
                          {formatMoney(goal.monthly, { currency: goal.currency, locale })}
                          {goal.monthly_source === 'average' && (
                            <span className="block text-xs text-muted-foreground">
                              {t('report.goalsPage.fromAverage')}
                            </span>
                          )}
                        </>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{month(goal.end_month)}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {goal.deadline === null ? (
                        '—'
                      ) : (
                        <Badge variant={goal.on_track === false ? 'destructive' : 'secondary'}>
                          {goal.on_track === false
                            ? t('report.goalsPage.late')
                            : t('report.goalsPage.onTrack')}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>
    </div>
  )
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  )
}
