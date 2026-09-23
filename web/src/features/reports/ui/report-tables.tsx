import { useTranslation } from 'react-i18next'

import type { MembersReport, MonthReport } from '@/features/reports/api/reports-api'
import { useAppLocale } from '@/shared/i18n'
import { formatDate } from '@/shared/lib/date'
import { formatMoney } from '@/shared/lib/money'
import { cn } from '@/shared/lib/utils'
import { Badge } from '@/shared/ui/badge'
import { MoneyText } from '@/shared/ui/money-text'
import { ProgressBar, type ProgressTone } from '@/shared/ui/progress-bar'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'

/** BR-096: limit holati rangi — 80% gacha xotirjam, 100% gacha ogohlantirish. */
const LIMIT_TONE: Record<string, ProgressTone> = {
  ok: 'income',
  near: 'warning',
  over: 'expense',
}

/** 1️⃣ Daromad matritsasi: tur × karta/naqd va JAMI qatori. */
export function IncomeMatrix({
  rows,
  total,
  outside,
  baseCurrency,
}: {
  rows: MonthReport['by_type']
  total: number
  /** Ro'yxatdagi turlarga kirmagan daromad (BR-092 ogohlantirishi). */
  outside: number
  baseCurrency: string
}) {
  const { t } = useTranslation()
  const locale = useAppLocale()
  const money = (value: number) => formatMoney(value, { currency: baseCurrency, locale })
  if (rows.length === 0 && total === 0) {
    return <p className="text-sm text-muted-foreground">{t('report.income.empty')}</p>
  }
  const card = rows.reduce((sum, row) => sum + row.card, 0)
  const cash = rows.reduce((sum, row) => sum + row.cash, 0)

  return (
    <div className="space-y-2">
      <Table aria-label={t('report.income.title')}>
        <TableHeader>
          <TableRow>
            <TableHead>{t('report.income.type')}</TableHead>
            <TableHead className="text-right">{t('report.income.card')}</TableHead>
            <TableHead className="text-right">{t('report.income.cash')}</TableHead>
            <TableHead className="text-right">{t('report.income.total')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.category_id}>
              <TableCell>{row.name}</TableCell>
              <TableCell className="text-right">{money(row.card)}</TableCell>
              <TableCell className="text-right">{money(row.cash)}</TableCell>
              <TableCell className="text-right font-medium">{money(row.card + row.cash)}</TableCell>
            </TableRow>
          ))}
          <TableRow className="font-medium">
            <TableCell>{t('report.income.total')}</TableCell>
            <TableCell className="text-right">{money(card)}</TableCell>
            <TableCell className="text-right">{money(cash)}</TableCell>
            <TableCell className="text-right">{money(total)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
      {outside > 0 && (
        <p role="status" className="rounded-md bg-warning/10 p-2 text-sm">
          {t('report.income.other', { amount: money(outside) })}
        </p>
      )}
    </div>
  )
}

/** 5️⃣ Kategoriya: reja, fakt, limit va foiz (rangi holatga qarab). */
export function CategoryLimits({
  rows,
  baseCurrency,
}: {
  rows: MonthReport['by_category']
  baseCurrency: string
}) {
  const { t } = useTranslation()
  const locale = useAppLocale()
  const money = (value: number) => formatMoney(value, { currency: baseCurrency, locale })
  const visible = rows.filter(
    (row) => row.actual_total > 0 || row.planned > 0 || row.limit !== null,
  )
  if (visible.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('report.categories.empty')}</p>
  }

  return (
    <Table aria-label={t('report.categories.title')}>
      <TableHeader>
        <TableRow>
          <TableHead>{t('report.categories.category')}</TableHead>
          <TableHead className="text-right">{t('report.categories.planned')}</TableHead>
          <TableHead className="text-right">{t('report.categories.actual')}</TableHead>
          <TableHead className="text-right">{t('report.categories.limit')}</TableHead>
          <TableHead className="w-40">{t('report.categories.ratio')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {visible.map((row) => (
          <TableRow key={row.category_id}>
            <TableCell className={cn(row.parent_id !== null && 'pl-8 text-muted-foreground')}>
              {row.name}
            </TableCell>
            <TableCell className="text-right">{money(row.planned)}</TableCell>
            <TableCell className="text-right">{money(row.actual_total)}</TableCell>
            <TableCell className="text-right">
              {row.limit === null ? '—' : money(row.limit)}
            </TableCell>
            <TableCell>
              {row.limit_ratio !== null && row.limit_status !== null && (
                <ProgressBar
                  value={row.limit_ratio}
                  tone={LIMIT_TONE[row.limit_status] ?? 'primary'}
                  label={`${String(Math.round(row.limit_ratio * 100))}%`}
                />
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

/** ⏳ To'lanmagan rejalar: qolgan summa va holat (BR-076). */
export function UnpaidPlans({
  rows,
  baseCurrency,
}: {
  rows: MonthReport['unpaid']
  baseCurrency: string
}) {
  const { t } = useTranslation()
  const locale = useAppLocale()
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('report.unpaid.empty')}</p>
  }

  return (
    <Table aria-label={t('report.unpaid.title')}>
      <TableHeader>
        <TableRow>
          <TableHead>{t('report.unpaid.name')}</TableHead>
          <TableHead>{t('report.unpaid.due')}</TableHead>
          <TableHead className="text-right">{t('report.unpaid.remaining')}</TableHead>
          <TableHead>{t('report.unpaid.status')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>{row.name}</TableCell>
            <TableCell className="whitespace-nowrap tabular-nums">
              {formatDate(row.due_date, locale)}
            </TableCell>
            <TableCell className="text-right">
              {row.planned_amount === null ? (
                '?'
              ) : (
                <MoneyText
                  amount={Math.max(row.planned_amount - row.paid_amount, 0)}
                  currency={baseCurrency}
                />
              )}
            </TableCell>
            <TableCell>
              <Badge variant={row.status === 'overdue' ? 'destructive' : 'outline'}>
                {t(`plans.status.${row.status}`, { defaultValue: row.status })}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

/** E30-T02: a'zolar kesimi — kim qancha sarfladi (o'tkazmasiz). */
export function MemberBreakdown({
  rows,
  baseCurrency,
}: {
  rows: MembersReport['members']
  baseCurrency: string
}) {
  const { t } = useTranslation()
  const locale = useAppLocale()
  const total = rows.reduce((sum, row) => sum + row.expense, 0)

  return (
    <Table aria-label={t('report.members.title')}>
      <TableHeader>
        <TableRow>
          <TableHead>{t('report.members.name')}</TableHead>
          <TableHead className="text-right">{t('report.members.expense')}</TableHead>
          <TableHead className="text-right">{t('report.members.share')}</TableHead>
          <TableHead className="text-right">{t('report.members.income')}</TableHead>
          <TableHead className="text-right">{t('report.members.count')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.user_id}>
            <TableCell className="font-medium">{row.name}</TableCell>
            <TableCell className="text-right tabular-nums">
              {formatMoney(row.expense, { currency: baseCurrency, locale })}
            </TableCell>
            <TableCell className="text-right text-muted-foreground tabular-nums">
              {total > 0 ? `${Math.round((row.expense / total) * 100)}%` : '—'}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatMoney(row.income, { currency: baseCurrency, locale })}
            </TableCell>
            <TableCell className="text-right tabular-nums">{row.count}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
