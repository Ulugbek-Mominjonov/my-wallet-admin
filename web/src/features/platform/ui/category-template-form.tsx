import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import type { CategoryTemplate, CategoryTemplateInput } from '@/features/platform/api/platform-api'
import { templateFormDefaults, templateFormSchema } from '@/features/platform/model/forms'
import { Field } from '@/features/platform/ui/form-fields'
import { toAppError } from '@/shared/api/errors'
import { Button } from '@/shared/ui/button'
import { ColorPicker } from '@/shared/ui/color-picker'
import { FormSelect } from '@/shared/ui/form-select'
import { IconPicker } from '@/shared/ui/icon-picker'
import { Input } from '@/shared/ui/input'

/** BR-031/032: yangi byudjet oladigan kategoriya shabloni (uch tilda). */
export function CategoryTemplateForm({
  template,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  template?: CategoryTemplate
  pending: boolean
  error: Error | null
  onSubmit: (input: CategoryTemplateInput) => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const form = useForm({
    resolver: zodResolver(templateFormSchema),
    defaultValues: templateFormDefaults(template),
  })
  const errors = form.formState.errors
  const kind = useWatch({ control: form.control, name: 'kind' })

  return (
    <form
      className="grid gap-4 px-4"
      noValidate
      onSubmit={(event) => {
        void form.handleSubmit((values) => {
          onSubmit({
            kind: values.kind,
            name_i18n: values.name_i18n,
            icon: values.icon,
            color: values.color,
            month_shift: Number(values.month_shift),
            sort_order: Number(values.sort_order),
          })
        })(event)
      }}
    >
      <Field id="template-kind" label={t('platform.fields.kind')} labelledBy>
        <Controller
          control={form.control}
          name="kind"
          render={({ field }) => (
            <FormSelect
              labelId="template-kind-label"
              value={field.value}
              disabled={template !== undefined}
              options={[
                { value: 'expense', label: t('platform.kinds.expense') },
                { value: 'income', label: t('platform.kinds.income') },
              ]}
              onChange={field.onChange}
            />
          )}
        />
      </Field>

      {(['uz', 'ru', 'en'] as const).map((locale) => (
        <Field
          key={locale}
          id={`template-name-${locale}`}
          label={t(`platform.fields.name_${locale}`)}
          error={errors.name_i18n?.[locale] && t('platform.errors.name')}
        >
          <Input
            id={`template-name-${locale}`}
            maxLength={60}
            aria-invalid={errors.name_i18n?.[locale] ? true : undefined}
            {...form.register(`name_i18n.${locale}`)}
          />
        </Field>
      ))}

      <Field id="template-icon" label={t('directories.icon')}>
        <Controller
          control={form.control}
          name="icon"
          render={({ field }) => (
            <IconPicker
              id="template-icon"
              value={field.value}
              fallback="dots"
              onChange={field.onChange}
            />
          )}
        />
      </Field>

      <Field id="template-color" label={t('directories.color')} labelledBy>
        <Controller
          control={form.control}
          name="color"
          render={({ field }) => (
            <ColorPicker
              labelledBy="template-color-label"
              value={field.value}
              onChange={(color) => {
                field.onChange(color ?? '#64748B')
              }}
            />
          )}
        />
      </Field>

      {kind === 'income' && (
        <Field id="template-shift" label={t('categories.monthShift')} labelledBy>
          <Controller
            control={form.control}
            name="month_shift"
            render={({ field }) => (
              <FormSelect
                labelId="template-shift-label"
                value={field.value}
                options={[
                  { value: '0', label: t('categories.shift0') },
                  { value: '-1', label: t('categories.shift-1') },
                ]}
                onChange={field.onChange}
              />
            )}
          />
        </Field>
      )}

      <Field
        id="template-order"
        label={t('platform.fields.order')}
        error={errors.sort_order && t('platform.errors.order')}
      >
        <Input
          id="template-order"
          inputMode="numeric"
          aria-invalid={errors.sort_order ? true : undefined}
          {...form.register('sort_order')}
        />
      </Field>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {toAppError(error).message}
        </p>
      )}
      <div className="flex justify-end gap-2">
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
