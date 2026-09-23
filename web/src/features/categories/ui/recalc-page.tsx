import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarSync, CircleCheck } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { recalcIncomeMonthsApply, recalcRowsQuery } from '@/features/categories/api/categories-api'
import { qk } from '@/shared/api/query-keys'
import { useAppLocale } from '@/shared/i18n'
import { formatDate } from '@/shared/lib/date'
import { formatMoney } from '@/shared/lib/money'
import { formatMonth } from '@/shared/lib/month'
import { Button } from '@/shared/ui/button'
import { ConfirmDialog } from '@/shared/ui/confirm-dialog'
import { EmptyState } from '@/shared/ui/empty-state'
import { PageHeader } from '@/shared/ui/page-header'
import { QueryError } from '@/shared/ui/query-error'
import { SectionCard } from '@/shared/ui/section-card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { TableSkeleton } from '@/shared/ui/table-skeleton'

/**
 * E25-T04 (BR-043): daromad oyi qoidasi o'zgargandan keyin — qaysi yozuv
 * qaysi oyga ko'chishi (sana, turi, eski → yangi oy), tasdiqdan keyin
 * hammasi bitta tranzaksiyada qayta joylanadi.
 */
export function RecalcPage({
  householdId,
  baseCurrency,
}: {
  householdId: string
  baseCurrency: string
}) {
  const { t } = useTranslation()
  const locale = useAppLocale()
  const queryClient = useQueryClient()
  const preview = useQuery(recalcRowsQuery(householdId))
  const [confirming, setConfirming] = useState(false)

  const apply = useMutation({
    mutationFn: (count: number) => recalcIncomeMonthsApply(householdId, count),
    onSuccess: async (_, count) => {
      setConfirming(false)
      toast.success(t('categories.recalcDone', { count }))
      await queryClient.invalidateQueries({ queryKey: qk.household(householdId) })
    },
  })

  const total = preview.data?.total ?? 0
  const rows = preview.data?.rows ?? []
  const month = (value: string) => formatMonth(value.slice(0, 7), locale)

  const header = (
    <PageHeader
      title={t('categories.recalcTitle')}
      description={t('categories.recalcDescription')}
      actions={
        total > 0 && (
          <Button
            onClick={() => {
              setConfirming(true)
            }}
          >
            <CalendarSync aria-hidden />
            {t('categories.recalcApply')}
          </Button>
        )
      }
    />
  )

  if (preview.isPending) {
    return (
      <div className="space-y-6">
        {header}
        <TableSkeleton />
      </div>
    )
  }
  if (preview.error) {
    return (
      <div className="space-y-6">
        {header}
        <QueryError
          error={preview.error}
          onRetry={() => {
            void preview.refetch()
          }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {header}

      {total === 0 ? (
        <EmptyState
          icon={CircleCheck}
          title={t('categories.recalcNone')}
          description={t('categories.recalcNoneHint')}
        />
      ) : (
        <SectionCard
          title={t('categories.recalcCount', { count: total })}
          description={t('transactions.shown', { shown: rows.length, total })}
        >
          <Table aria-label={t('categories.recalcTitle')}>
            <TableHeader>
              <TableRow>
                <TableHead>{t('transactions.columns.date')}</TableHead>
                <TableHead>{t('transactions.columns.category')}</TableHead>
                <TableHead>{t('transactions.columns.description')}</TableHead>
                <TableHead className="text-right">{t('transactions.columns.amount')}</TableHead>
                <TableHead>{t('categories.recalcColumn')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{formatDate(row.occurred_on, locale)}</TableCell>
                  <TableCell>{row.category}</TableCell>
                  <TableCell>{row.payee ?? '—'}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(row.amount_base, { currency: baseCurrency, locale })}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {month(row.from_month)} → {month(row.to_month)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SectionCard>
      )}

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t('categories.recalcTitle')}
        description={t('categories.recalcConfirm', { count: total })}
        confirmLabel={t('categories.recalcApply')}
        cancelLabel={t('common.cancel')}
        pending={apply.isPending}
        onConfirm={() => {
          apply.mutate(total)
        }}
      />
    </div>
  )
}
