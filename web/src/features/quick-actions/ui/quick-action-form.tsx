import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import type { QuickAction, QuickActionInput } from '@/features/quick-actions/api/quick-actions-api'
import {
  NAME_MAX,
  quickActionFormDefaults,
  quickActionFormSchema,
} from '@/features/quick-actions/model/quick-action-form'
import { toAppError } from '@/shared/api/errors'
import { Button } from '@/shared/ui/button'
import { FormSelect, type SelectOption } from '@/shared/ui/form-select'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'

/** E22-T05: tez tugma formasi — xarajat kategoriyasi va hisob majburiy (BR-120). */
export function QuickActionForm({
  action,
  categories,
  accounts,
  currency,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  action?: QuickAction
  categories: readonly SelectOption[]
  accounts: readonly SelectOption[]
  currency: string
  pending: boolean
  error: Error | null
  onSubmit: (input: QuickActionInput) => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const form = useForm({
    resolver: zodResolver(quickActionFormSchema(currency)),
    defaultValues: quickActionFormDefaults(action, currency),
  })
  const errors = form.formState.errors

  return (
    <form
      className="grid gap-4 px-4"
      noValidate
      onSubmit={(event) => {
        void form.handleSubmit(onSubmit)(event)
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="qa-name">{t('quickActions.name')}</Label>
          <Input
            id="qa-name"
            maxLength={NAME_MAX}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? 'qa-name-error' : undefined}
            {...form.register('name')}
          />
          {errors.name && (
            <p id="qa-name-error" className="text-sm text-destructive">
              {t('directories.errors.name')}
            </p>
          )}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="qa-amount">{t('quickActions.amount')}</Label>
          <Input
            id="qa-amount"
            inputMode="decimal"
            autoComplete="off"
            aria-invalid={errors.amount ? true : undefined}
            aria-describedby={errors.amount ? 'qa-amount-error' : undefined}
            {...form.register('amount')}
          />
          {errors.amount && (
            <p id="qa-amount-error" className="text-sm text-destructive">
              {t('directories.errors.amountPositive')}
            </p>
          )}
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label id="qa-category-label">{t('quickActions.category')}</Label>
        <Controller
          control={form.control}
          name="categoryId"
          render={({ field }) => (
            <FormSelect
              labelId="qa-category-label"
              value={field.value}
              options={categories}
              onChange={field.onChange}
              invalid={errors.categoryId !== undefined}
              describedBy={errors.categoryId ? 'qa-category-error' : undefined}
            />
          )}
        />
        {errors.categoryId && (
          <p id="qa-category-error" className="text-sm text-destructive">
            {t('quickActions.errors.category')}
          </p>
        )}
      </div>
      <div className="grid gap-1.5">
        <Label id="qa-account-label">{t('quickActions.account')}</Label>
        <Controller
          control={form.control}
          name="accountId"
          render={({ field }) => (
            <FormSelect
              labelId="qa-account-label"
              value={field.value}
              options={accounts}
              onChange={field.onChange}
              invalid={errors.accountId !== undefined}
              describedBy={errors.accountId ? 'qa-account-error' : undefined}
            />
          )}
        />
        {errors.accountId && (
          <p id="qa-account-error" className="text-sm text-destructive">
            {t('quickActions.errors.account')}
          </p>
        )}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="qa-payee">{t('quickActions.payee')}</Label>
        <Input
          id="qa-payee"
          maxLength={NAME_MAX}
          placeholder={t('quickActions.payeeHint')}
          {...form.register('payee')}
        />
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
