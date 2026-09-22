import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { Account } from '@/entities/account'
import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { FormSelect } from '@/shared/ui/form-select'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'

/** Hisob tanlovidagi "rejaning o'z hisobi" bandi. */
const OWN_ACCOUNT = 'own'

/** BR-074: tanlanganlarni to'lash — sana va (ixtiyoriy) bitta hisob. */
export function BulkPayDialog({
  count,
  accounts,
  baseCurrency,
  today,
  pending,
  onPay,
  onClose,
}: {
  count: number
  accounts: readonly Account[]
  baseCurrency: string
  today: string
  pending: boolean
  onPay: (options: { date: string; accountId: string | null }) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [date, setDate] = useState(today)
  const [account, setAccount] = useState(OWN_ACCOUNT)

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t('plans.bulk.payTitle')}</DialogTitle>
          <DialogDescription>
            {t('plans.bulk.selected', { count })}. {t('plans.bulk.payText')}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label id="bulk-pay-account-label">{t('plans.bulk.account')}</Label>
            <FormSelect
              labelId="bulk-pay-account-label"
              value={account}
              options={[
                { value: OWN_ACCOUNT, label: t('plans.bulk.ownAccount') },
                ...accounts
                  .filter((a) => a.currency === baseCurrency)
                  .map((a) => ({ value: a.id, label: a.name })),
              ]}
              onChange={setAccount}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="bulk-pay-date">{t('plans.bulk.date')}</Label>
            <Input
              id="bulk-pay-date"
              type="date"
              value={date}
              onChange={(event) => {
                setDate(event.target.value)
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            disabled={pending || date === ''}
            onClick={() => {
              onPay({ date, accountId: account === OWN_ACCOUNT ? null : account })
            }}
          >
            {t('plans.bulk.pay')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
