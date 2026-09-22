import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import type { Account } from '@/entities/account'
import { plannedRemaining, type PlannedItem } from '@/entities/planned-item'
import type { PayInput } from '@/features/plans/api/plans-api'
import { payFormDefaults, payFormSchema } from '@/features/plans/model/pay-form'
import { toAppError } from '@/shared/api/errors'
import { useAppLocale } from '@/shared/i18n'
import { formatMoney, parseMoney } from '@/shared/lib/money'
import { AmountField } from '@/shared/ui/amount-field'
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

/**
 * E23-T04 (BR-073, BR-077): "To'landi" / "Keldi". Summa standart — qolgani;
 * noma'lum bo'lsa majburiy; qolgandan kam bo'lsa — qisman yoki yopish.
 */
export function PayDialog({
  plan,
  accounts,
  baseCurrency,
  today,
  pending,
  error,
  onPay,
  onClose,
}: {
  plan: PlannedItem
  /** Tanlash mumkin bo'lgan hisoblar (faol, 👤 fond emas). */
  accounts: readonly Account[]
  baseCurrency: string
  today: string
  pending: boolean
  error: Error | null
  onPay: (input: PayInput) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const locale = useAppLocale()
  const accountsById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts])
  const form = useForm({
    resolver: zodResolver(payFormSchema((id) => accountsById.get(id))),
    defaultValues: payFormDefaults(plan, {
      today,
      baseCurrency,
      accountOf: (id) => accountsById.get(id),
    }),
  })
  const errors = form.formState.errors
  const [amountText, accountId] = useWatch({ control: form.control, name: ['amount', 'accountId'] })
  const currency = accountsById.get(accountId)?.currency ?? baseCurrency
  const remaining = plannedRemaining(plan)
  const amount = parseMoney(amountText, currency)
  // Qolgan summa asosiy valyutada — taqqoslash faqat shu valyutadagi hisobda.
  const partial =
    remaining !== null &&
    currency === baseCurrency &&
    amount !== null &&
    amount > 0 &&
    amount < remaining
  const income = plan.kind === 'income'

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent showCloseButton={false}>
        <form
          className="grid gap-4"
          noValidate
          onSubmit={(event) => {
            void form.handleSubmit((input) => {
              onPay({ ...input, settle: partial && input.settle })
            })(event)
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {t(income ? 'plans.receiveTitle' : 'plans.payTitle', { name: plan.name })}
            </DialogTitle>
            <DialogDescription>
              {remaining === null
                ? t('plans.payForm.unknownHint')
                : t('plans.payForm.remaining', {
                    amount: formatMoney(remaining, { currency: baseCurrency, locale }),
                  })}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label id="pay-account-label">{t('plans.payForm.account')}</Label>
            <Controller
              control={form.control}
              name="accountId"
              render={({ field }) => (
                <FormSelect
                  labelId="pay-account-label"
                  value={field.value}
                  options={accounts.map((a) => ({
                    value: a.id,
                    label: a.currency === baseCurrency ? a.name : `${a.name} (${a.currency})`,
                  }))}
                  onChange={field.onChange}
                  invalid={Boolean(errors.accountId)}
                  describedBy={errors.accountId ? 'pay-account-error' : undefined}
                />
              )}
            />
            {errors.accountId && (
              <p id="pay-account-error" className="text-sm text-destructive">
                {t('plans.errors.account')}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <AmountField
              id="pay-amount"
              label={t('plans.payForm.amount', { currency })}
              hint={currency === baseCurrency ? undefined : t('plans.payForm.otherCurrency')}
              error={errors.amount ? t('plans.errors.amount') : undefined}
              registration={form.register('amount')}
            />
            <div className="grid gap-1.5">
              <Label htmlFor="pay-date">{t('plans.payForm.date')}</Label>
              <Input
                id="pay-date"
                type="date"
                aria-invalid={errors.date ? true : undefined}
                {...form.register('date')}
              />
            </div>
          </div>
          {partial && (
            <fieldset className="grid gap-2 rounded-lg border p-3">
              <legend className="px-1 text-sm font-medium">
                {t('plans.payForm.partialTitle')}
              </legend>
              <Controller
                control={form.control}
                name="settle"
                render={({ field }) => (
                  <>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="pay-mode"
                        checked={!field.value}
                        onChange={() => {
                          field.onChange(false)
                        }}
                      />
                      {t('plans.payForm.partial')}
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="pay-mode"
                        checked={field.value}
                        onChange={() => {
                          field.onChange(true)
                        }}
                      />
                      {t('plans.payForm.settle')}
                    </label>
                  </>
                )}
              />
            </fieldset>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {toAppError(error).message}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={pending}>
              {income ? t('plans.received') : t('plans.pay')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
