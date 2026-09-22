import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { monthPreviewQuery } from '@/features/recurring-rules/api/recurring-rules-api'
import { useAppLocale } from '@/shared/i18n'
import { formatMonth } from '@/shared/lib/month'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { MoneyText } from '@/shared/ui/money-text'
import { QueryError } from '@/shared/ui/query-error'
import { Skeleton } from '@/shared/ui/skeleton'

/**
 * E22-T04: "Keyingi oyda nima yaratiladi" — `open_month_preview` (yozmaydi):
 * doimiy rejalar va 👤 fond ajratmasi, allaqachon borlari belgilanadi.
 */
export function MonthPreviewDialog({
  householdId,
  month,
  currency,
  open,
  onClose,
}: {
  householdId: string
  /** Oy boshi (`YYYY-MM-01`). */
  month: string
  currency: string
  open: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()
  const locale = useAppLocale()
  const preview = useQuery({ ...monthPreviewQuery(householdId, month), enabled: open })
  const title = formatMonth(month.slice(0, 7), locale)

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose()
      }}
    >
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('rules.previewTitle', { month: title })}</DialogTitle>
          {preview.data && (
            <DialogDescription>
              {preview.data.closed
                ? t('rules.previewClosed')
                : preview.data.new > 0
                  ? t('rules.previewNew', { count: preview.data.new })
                  : t('rules.previewEmpty')}
            </DialogDescription>
          )}
        </DialogHeader>
        {preview.isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : preview.isError ? (
          <QueryError
            error={preview.error}
            onRetry={() => {
              void preview.refetch()
            }}
          />
        ) : (
          <ul className="max-h-80 divide-y overflow-y-auto text-sm">
            {preview.data.items.map((item) => (
              <li
                key={`${item.recurring_rule_id ?? item.system_code ?? ''}-${item.name}`}
                className="flex items-center gap-3 py-2"
              >
                <span className="w-12 shrink-0 text-muted-foreground tabular-nums">
                  {item.due_date.slice(8, 10)}.{item.due_date.slice(5, 7)}
                </span>
                <span className="flex-1 truncate">{item.name}</span>
                {item.exists && <Badge variant="outline">{t('rules.previewExisting')}</Badge>}
                {item.planned_amount === null ? (
                  <span className="text-muted-foreground">{t('rules.varies')}</span>
                ) : (
                  <MoneyText
                    amount={item.planned_amount}
                    currency={currency}
                    tone={item.kind === 'income' ? 'income' : 'neutral'}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
