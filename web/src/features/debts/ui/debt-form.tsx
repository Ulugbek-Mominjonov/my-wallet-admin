import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { DEBT_DIRECTIONS, type Debt, type DebtInput } from '@/features/debts/api/debts-api'
import {
  debtFormDefaults,
  debtFormSchema,
  NAME_MAX,
  NOTE_MAX,
} from '@/features/debts/model/debt-form'
import { toAppError } from '@/shared/api/errors'
import { AmountField } from '@/shared/ui/amount-field'
import { Button } from '@/shared/ui/button'
import { FormSelect, type SelectOption } from '@/shared/ui/form-select'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Textarea } from '@/shared/ui/textarea'

/**
 * E22-T06: qarz formasi (BR-110). Yo'nalish va valyuta yaratilgandan keyin
 * o'zgarmaydi (bog'langan amallar shunga tayanadi, BR-111, BR-194).
 */
export function DebtForm({
  debt,
  currencies,
  currency,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  debt?: Debt
  currencies: readonly SelectOption[]
  currency: string
  pending: boolean
  error: Error | null
  onSubmit: (input: DebtInput) => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const form = useForm({
    resolver: zodResolver(debtFormSchema),
    defaultValues: debtFormDefaults(debt, currency),
  })
  const errors = form.formState.errors
  const directionOptions = DEBT_DIRECTIONS.map((value) => ({
    value,
    label: t(`debts.directions.${value}`),
  }))

  return (
    <form
      className="grid gap-4 px-4"
      noValidate
      onSubmit={(event) => {
        void form.handleSubmit(onSubmit)(event)
      }}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="debt-name">{t('debts.name')}</Label>
        <Input
          id="debt-name"
          maxLength={NAME_MAX}
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? 'debt-name-error' : undefined}
          {...form.register('name')}
        />
        {errors.name && (
          <p id="debt-name-error" className="text-sm text-destructive">
            {t('directories.errors.name')}
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label id="debt-direction-label">{t('debts.direction')}</Label>
          <Controller
            control={form.control}
            name="direction"
            render={({ field }) => (
              <FormSelect
                labelId="debt-direction-label"
                value={field.value}
                options={directionOptions}
                onChange={field.onChange}
                disabled={debt !== undefined}
              />
            )}
          />
        </div>
        <div className="grid gap-1.5">
          <Label id="debt-currency-label">{t('debts.currency')}</Label>
          <Controller
            control={form.control}
            name="currency"
            render={({ field }) => (
              <FormSelect
                labelId="debt-currency-label"
                value={field.value}
                options={currencies}
                onChange={field.onChange}
                disabled={debt !== undefined}
              />
            )}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <AmountField
          id="debt-total"
          label={t('debts.total')}
          error={errors.total ? t('debts.errors.total') : undefined}
          registration={form.register('total')}
        />
        <AmountField
          id="debt-paid"
          label={t('debts.paidBefore')}
          hint={t('debts.paidBeforeHint')}
          error={errors.paidBefore ? t('debts.errors.paidBefore') : undefined}
          registration={form.register('paidBefore')}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <AmountField
          id="debt-monthly"
          label={t('debts.monthlyPayment')}
          error={errors.monthlyPayment ? t('debts.errors.amount') : undefined}
          registration={form.register('monthlyPayment')}
        />
        <div className="grid gap-1.5">
          <Label htmlFor="debt-due">{t('debts.dueDate')}</Label>
          <Input
            id="debt-due"
            type="date"
            aria-invalid={errors.dueDate ? true : undefined}
            aria-describedby={errors.dueDate ? 'debt-due-error' : undefined}
            {...form.register('dueDate')}
          />
          {errors.dueDate && (
            <p id="debt-due-error" className="text-sm text-destructive">
              {t('directories.errors.date')}
            </p>
          )}
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="debt-note">{t('debts.note')}</Label>
        <Textarea id="debt-note" maxLength={NOTE_MAX} rows={3} {...form.register('note')} />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {toAppError(error).message}
        </p>
      )}
      <div className="flex justify-end gap-2 pb-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={pending}>
          {t('common.save')}
        </Button>
      </div>
    </form>
  )
}
