import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import {
  ACCOUNT_TYPE_ICON,
  CREATABLE_ACCOUNT_TYPES,
  isSystemAccount,
  type Account,
} from '@/entities/account'
import type { AccountInput } from '@/features/accounts/api/accounts-api'
import {
  accountFormDefaults,
  accountFormSchema,
  NAME_MAX,
} from '@/features/accounts/model/account-form'
import { toAppError } from '@/shared/api/errors'
import { Button } from '@/shared/ui/button'
import { ColorPicker } from '@/shared/ui/color-picker'
import { IconPicker } from '@/shared/ui/icon-picker'
import { Input } from '@/shared/ui/input'
import { FormSelect } from '@/shared/ui/form-select'
import { Label } from '@/shared/ui/label'

export interface CurrencyOption {
  code: string
  label: string
}

/**
 * E22-T02: hisob formasi (yaratish va tahrirlash). 👤 fond hisobining turi
 * o'zgarmaydi (BR-020); valyuta — amali bor hisobda server rad etadi (BR-026).
 */
export function AccountForm({
  account,
  currencies,
  defaults,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  account?: Account
  currencies: CurrencyOption[]
  defaults: { currency: string; today: string }
  pending: boolean
  error: Error | null
  onSubmit: (input: AccountInput) => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const form = useForm({
    resolver: zodResolver(accountFormSchema),
    defaultValues: accountFormDefaults(account, defaults),
  })
  const errors = form.formState.errors
  const type = useWatch({ control: form.control, name: 'type' })
  const system = account !== undefined && isSystemAccount(account)
  const types = system ? (['personal_fund'] as const) : CREATABLE_ACCOUNT_TYPES
  const typeLabel = (type: string) => t(`accounts.types.${type as Account['type']}`)

  return (
    <form
      className="grid gap-4 px-4"
      noValidate
      onSubmit={(event) => {
        void form.handleSubmit(onSubmit)(event)
      }}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="account-name">{t('accounts.name')}</Label>
        <Input
          id="account-name"
          maxLength={NAME_MAX}
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? 'account-name-error' : undefined}
          {...form.register('name')}
        />
        {errors.name && (
          <p id="account-name-error" className="text-sm text-destructive">
            {t('directories.errors.name')}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label id="account-type-label">{t('accounts.type')}</Label>
          <Controller
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormSelect
                labelId="account-type-label"
                value={field.value}
                options={types.map((type) => ({ value: type, label: typeLabel(type) }))}
                onChange={field.onChange}
                disabled={system}
              />
            )}
          />
        </div>
        <div className="grid gap-1.5">
          <Label id="account-currency-label">{t('accounts.currency')}</Label>
          <Controller
            control={form.control}
            name="currency"
            render={({ field }) => (
              <FormSelect
                labelId="account-currency-label"
                value={field.value}
                options={currencies.map((c) => ({ value: c.code, label: c.label }))}
                onChange={field.onChange}
              />
            )}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="account-opening">{t('accounts.openingBalance')}</Label>
          <Input
            id="account-opening"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0"
            aria-invalid={errors.openingBalance ? true : undefined}
            aria-describedby="account-opening-hint"
            {...form.register('openingBalance')}
          />
          <p
            id="account-opening-hint"
            className={
              errors.openingBalance ? 'text-sm text-destructive' : 'text-xs text-muted-foreground'
            }
          >
            {errors.openingBalance
              ? t('directories.errors.amount')
              : t('accounts.openingBalanceHint')}
          </p>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="account-date">{t('accounts.openingDate')}</Label>
          <Input
            id="account-date"
            type="date"
            aria-invalid={errors.openingDate ? true : undefined}
            aria-describedby={errors.openingDate ? 'account-date-error' : undefined}
            {...form.register('openingDate')}
          />
          {errors.openingDate && (
            <p id="account-date-error" className="text-sm text-destructive">
              {t('directories.errors.date')}
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="account-card">{t('accounts.cardLast4')}</Label>
        <Input
          id="account-card"
          inputMode="numeric"
          autoComplete="off"
          maxLength={4}
          placeholder="1234"
          aria-invalid={errors.cardLast4 ? true : undefined}
          aria-describedby="account-card-hint"
          {...form.register('cardLast4')}
        />
        <p
          id="account-card-hint"
          className={
            errors.cardLast4 ? 'text-sm text-destructive' : 'text-xs text-muted-foreground'
          }
        >
          {errors.cardLast4 ? t('accounts.cardLast4Error') : t('accounts.cardLast4Hint')}
        </p>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="account-icon">{t('directories.icon')}</Label>
        <Controller
          control={form.control}
          name="icon"
          render={({ field }) => (
            <IconPicker
              id="account-icon"
              value={field.value}
              fallback={ACCOUNT_TYPE_ICON[type]}
              onChange={field.onChange}
            />
          )}
        />
      </div>

      <div className="grid gap-1.5">
        <p id="account-color-label" className="text-sm font-medium">
          {t('directories.color')}
        </p>
        <Controller
          control={form.control}
          name="color"
          render={({ field }) => (
            <ColorPicker
              labelledBy="account-color-label"
              value={field.value}
              onChange={field.onChange}
            />
          )}
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
