import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  recalcIncomeMonthsApply,
  recalcIncomeMonthsPreview,
} from '@/features/categories/api/categories-api'
import { toAppError } from '@/shared/api/errors'
import { qk } from '@/shared/api/query-keys'
import { useAppLocale } from '@/shared/i18n'
import { formatMoney } from '@/shared/lib/money'
import { formatMonth } from '@/shared/lib/month'
import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { Skeleton } from '@/shared/ui/skeleton'

/**
 * BR-043: oy siljishi o'zgargach — avval preview ("N ta yozuv ko'chadi:
 * 2026-09 → 2026-10"), tasdiqdan keyin bitta tranzaksiyada qayta joylash.
 */
export function RecalcDialog({
  householdId,
  baseCurrency,
  open,
  onClose,
}: {
  householdId: string
  baseCurrency: string
  open: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()
  const locale = useAppLocale()
  const queryClient = useQueryClient()
  const preview = useQuery({
    queryKey: [...qk.household(householdId), 'recalc-income-months'],
    queryFn: () => recalcIncomeMonthsPreview(householdId),
    enabled: open,
    staleTime: 0,
    gcTime: 0,
  })
  const apply = useMutation({
    mutationFn: (count: number) => recalcIncomeMonthsApply(householdId, count),
    onSuccess: async (_, count) => {
      toast.success(t('categories.recalcDone', { count }))
      onClose()
      await queryClient.invalidateQueries({ queryKey: qk.household(householdId) })
    },
    meta: { silent: true },
  })
  const month = (date: string) => formatMonth(date.slice(0, 7), locale)
  const count = preview.data?.count ?? 0

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose()
      }}
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t('categories.recalcTitle')}</DialogTitle>
          {preview.data && count > 0 && (
            <DialogDescription>{t('categories.recalcText', { count })}</DialogDescription>
          )}
        </DialogHeader>
        {preview.isPending ? (
          <Skeleton className="h-16 w-full" />
        ) : preview.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {toAppError(preview.error).message}
          </p>
        ) : count === 0 ? (
          <p className="text-sm">{t('categories.recalcNone')}</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {preview.data.moves.map((move) => (
              <li key={`${move.from_month}-${move.to_month}`} className="tabular-nums">
                {t('categories.recalcMove', {
                  from: month(move.from_month),
                  to: month(move.to_month),
                  count: move.count,
                  amount: formatMoney(move.amount_base, { currency: baseCurrency, locale }),
                })}
              </li>
            ))}
          </ul>
        )}
        {apply.error && (
          <p role="alert" className="text-sm text-destructive">
            {toAppError(apply.error).message}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {count > 0 ? t('categories.recalcLater') : t('common.close')}
          </Button>
          {count > 0 && (
            <Button
              disabled={apply.isPending}
              onClick={() => {
                apply.mutate(count)
              }}
            >
              {t('categories.recalcApply')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
