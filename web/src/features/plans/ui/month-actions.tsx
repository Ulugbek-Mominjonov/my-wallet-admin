import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarPlus, Lock, LockOpen } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { useCan } from '@/entities/household'
import {
  monthCloseCheckQuery,
  monthsKey,
  monthStateQuery,
  openMonth,
  openMonthPreviewQuery,
  setMonthClosed,
} from '@/features/plans/api/month-api'
import { plansKey } from '@/features/plans/api/plans-api'
import { toAppError } from '@/shared/api/errors'
import { useAppLocale } from '@/shared/i18n'
import { formatDate } from '@/shared/lib/date'
import { formatMoney } from '@/shared/lib/money'
import { formatMonth, type MonthKey } from '@/shared/lib/month'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { ConfirmDialog } from '@/shared/ui/confirm-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { Skeleton } from '@/shared/ui/skeleton'

type Dialogs = 'open' | 'close' | 'reopen' | null

/**
 * E23-T05: oyni ochish (preview → tasdiq, BR-081/084) va yopish/qayta ochish
 * (BR-150, tekshiruv — BR-153). Yopish faqat tugagan oy va owner/admin uchun.
 */
export function MonthActions({
  householdId,
  month,
  currentMonth,
  baseCurrency,
}: {
  householdId: string
  month: MonthKey
  currentMonth: MonthKey
  baseCurrency: string
}) {
  const { t } = useTranslation()
  const locale = useAppLocale()
  const canWrite = useCan('write')
  const canManage = useCan('manage')
  const queryClient = useQueryClient()
  const state = useQuery(monthStateQuery(householdId, month))
  const [dialog, setDialog] = useState<Dialogs>(null)
  const label = formatMonth(month, locale)

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: monthsKey(householdId) }),
      queryClient.invalidateQueries({ queryKey: plansKey(householdId) }),
    ])
  const open = useMutation({
    mutationFn: () => openMonth(householdId, month),
    onSuccess: async (result) => {
      setDialog(null)
      toast.success(t('plans.month.opened', result))
      await refresh()
    },
    meta: { silent: true },
  })
  const close = useMutation({
    mutationFn: (closed: boolean) => setMonthClosed(householdId, month, closed),
    onSuccess: async (_, closed) => {
      setDialog(null)
      toast.success(
        t(closed ? 'plans.month.closedToast' : 'plans.month.reopenedToast', { month: label }),
      )
      await refresh()
    },
    meta: { silent: true },
  })

  const closed = state.data?.closed ?? false
  // BR-150: joriy va kelgusi oylar yopilmaydi.
  const finished = month < currentMonth

  return (
    <div className="flex flex-wrap items-center gap-2">
      {closed && (
        <Badge variant="secondary">
          <Lock aria-hidden />
          {t('plans.month.closedBadge')}
        </Badge>
      )}
      {canWrite && !closed && (
        <Button
          variant="outline"
          onClick={() => {
            open.reset()
            setDialog('open')
          }}
        >
          <CalendarPlus aria-hidden />
          {t('plans.month.open')}
        </Button>
      )}
      {canManage && finished && !closed && (
        <Button
          variant="outline"
          onClick={() => {
            close.reset()
            setDialog('close')
          }}
        >
          <Lock aria-hidden />
          {t('plans.month.close')}
        </Button>
      )}
      {canManage && closed && (
        <Button
          variant="outline"
          onClick={() => {
            close.reset()
            setDialog('reopen')
          }}
        >
          <LockOpen aria-hidden />
          {t('plans.month.reopen')}
        </Button>
      )}

      {dialog === 'open' && (
        <OpenMonthDialog
          householdId={householdId}
          month={month}
          baseCurrency={baseCurrency}
          pending={open.isPending}
          error={open.error}
          onConfirm={() => {
            open.mutate()
          }}
          onClose={() => {
            setDialog(null)
          }}
        />
      )}
      {dialog === 'close' && (
        <CloseMonthDialog
          householdId={householdId}
          month={month}
          baseCurrency={baseCurrency}
          pending={close.isPending}
          error={close.error}
          onConfirm={() => {
            close.mutate(true)
          }}
          onClose={() => {
            setDialog(null)
          }}
        />
      )}
      <ConfirmDialog
        open={dialog === 'reopen'}
        onOpenChange={(value) => {
          if (!value) setDialog(null)
        }}
        title={t('plans.month.reopenTitle', { month: label })}
        description={t('plans.month.reopenText')}
        confirmLabel={t('plans.month.reopen')}
        cancelLabel={t('common.cancel')}
        pending={close.isPending}
        onConfirm={() => {
          close.mutate(false)
        }}
      />
    </div>
  )
}

function OpenMonthDialog({
  householdId,
  month,
  baseCurrency,
  pending,
  error,
  onConfirm,
  onClose,
}: {
  householdId: string
  month: MonthKey
  baseCurrency: string
  pending: boolean
  error: Error | null
  onConfirm: () => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const locale = useAppLocale()
  const preview = useQuery(openMonthPreviewQuery(householdId, month))

  return (
    <Dialog
      open
      onOpenChange={(value) => {
        if (!value) onClose()
      }}
    >
      <DialogContent showCloseButton={false} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t('plans.month.openTitle', { month: formatMonth(month, locale) })}
          </DialogTitle>
          <DialogDescription>{t('plans.month.openText')}</DialogDescription>
        </DialogHeader>
        {preview.isPending ? (
          <Skeleton className="h-24" />
        ) : preview.error ? (
          <p role="alert" className="text-sm text-destructive">
            {toAppError(preview.error).message}
          </p>
        ) : (
          <div className="grid gap-2">
            <p className="text-sm">
              <span className="font-medium">
                {t('plans.month.newCount', { count: preview.data.new })}
              </span>
              {' · '}
              <span className="text-muted-foreground">
                {t('plans.month.existingCount', { count: preview.data.existing })}
              </span>
            </p>
            <ul className="max-h-72 divide-y overflow-y-auto rounded-lg border text-sm">
              {preview.data.items.map((item) => (
                <li
                  key={`${item.kind}:${item.name}:${item.due_date}`}
                  className="flex items-center justify-between gap-2 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p
                      className={
                        item.exists ? 'truncate text-muted-foreground' : 'truncate font-medium'
                      }
                    >
                      {item.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t(`plans.kinds.${item.kind}`)} · {formatDate(item.due_date, locale)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="tabular-nums">
                      {item.planned_amount === null
                        ? '?'
                        : formatMoney(item.planned_amount, { currency: baseCurrency, locale })}
                    </span>
                    {item.exists && <Badge variant="outline">{t('plans.month.exists')}</Badge>}
                  </div>
                </li>
              ))}
            </ul>
            {preview.data.new === 0 && (
              <p className="text-sm text-muted-foreground">{t('plans.month.nothingNew')}</p>
            )}
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {toAppError(error).message}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button disabled={pending || !preview.data || preview.data.new === 0} onClick={onConfirm}>
            {t('plans.month.confirmOpen')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CloseMonthDialog({
  householdId,
  month,
  baseCurrency,
  pending,
  error,
  onConfirm,
  onClose,
}: {
  householdId: string
  month: MonthKey
  baseCurrency: string
  pending: boolean
  error: Error | null
  onConfirm: () => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const locale = useAppLocale()
  const check = useQuery(monthCloseCheckQuery(householdId, month))
  const open = check.data ? check.data.unpaid_count + check.data.unknown_count > 0 : false

  return (
    <Dialog
      open
      onOpenChange={(value) => {
        if (!value) onClose()
      }}
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>
            {t('plans.month.closeTitle', { month: formatMonth(month, locale) })}
          </DialogTitle>
          <DialogDescription>{t('plans.month.closeText')}</DialogDescription>
        </DialogHeader>
        {check.isPending ? (
          <Skeleton className="h-12" />
        ) : check.error ? (
          <p role="alert" className="text-sm text-destructive">
            {toAppError(check.error).message}
          </p>
        ) : open ? (
          <div role="status" className="grid gap-1 rounded-md bg-warning/10 p-3 text-sm">
            {check.data.unpaid_count > 0 && (
              <p>
                {t('plans.month.closeUnpaid', {
                  count: check.data.unpaid_count,
                  amount: formatMoney(check.data.unpaid_amount, { currency: baseCurrency, locale }),
                })}
              </p>
            )}
            {check.data.unknown_count > 0 && (
              <p>{t('plans.month.closeUnknown', { count: check.data.unknown_count })}</p>
            )}
          </div>
        ) : (
          <p role="status" className="text-sm text-muted-foreground">
            {t('plans.month.closeClean')}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {toAppError(error).message}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant={open ? 'destructive' : 'default'}
            disabled={pending || !check.data}
            onClick={onConfirm}
          >
            {open ? t('plans.month.closeAnyway') : t('plans.month.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
