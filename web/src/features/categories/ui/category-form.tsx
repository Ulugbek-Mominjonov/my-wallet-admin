import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { isSystemCategory, MONTH_SHIFTS, type Category } from '@/entities/category'
import type { CategoryInput } from '@/features/categories/api/categories-api'
import {
  categoryFormDefaults,
  categoryFormSchema,
  NAME_MAX,
} from '@/features/categories/model/category-form'
import { DEFAULT_ICON } from '@/shared/config/icons'
import { toAppError } from '@/shared/api/errors'
import { Button } from '@/shared/ui/button'
import { ColorPicker } from '@/shared/ui/color-picker'
import { IconPicker } from '@/shared/ui/icon-picker'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'

/**
 * E22-T03: kategoriya formasi. Tur — tab'dan (o'zgarmaydi, BR-036); ota —
 * bir daraja (BR-034); daromad turida oy siljishi (BR-031).
 */
export function CategoryForm({
  kind,
  category,
  parentId,
  parents,
  hasChildren,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  kind: Category['kind']
  category?: Category
  /** Yangi subkategoriya — ota oldindan tanlangan. */
  parentId: string | null
  parents: Category[]
  hasChildren: boolean
  pending: boolean
  error: Error | null
  onSubmit: (input: CategoryInput) => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const form = useForm({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: categoryFormDefaults(category, parentId),
  })
  const errors = form.formState.errors
  // Tizim kategoriyasi va bolasi bor kategoriya boshqasining ichiga kirmaydi.
  const parentLocked = hasChildren || (category !== undefined && isSystemCategory(category))
  const parentItems = [
    { value: '', label: t('categories.noParent') },
    ...parents.map((p) => ({ value: p.id, label: p.name })),
  ]
  const shiftItems = MONTH_SHIFTS.map((shift) => ({
    value: String(shift),
    label: t(`categories.shift${String(shift) as '0' | '-1'}`),
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
        <Label htmlFor="category-name">{t('categories.name')}</Label>
        <Input
          id="category-name"
          maxLength={NAME_MAX}
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? 'category-name-error' : undefined}
          {...form.register('name')}
        />
        {errors.name && (
          <p id="category-name-error" className="text-sm text-destructive">
            {t('directories.errors.name')}
          </p>
        )}
      </div>

      <div className="grid gap-1.5">
        <Label id="category-parent-label">{t('categories.parent')}</Label>
        <Controller
          control={form.control}
          name="parentId"
          render={({ field }) => (
            <Select
              value={field.value}
              disabled={parentLocked}
              items={parentItems}
              onValueChange={(value) => {
                field.onChange(value ?? '')
              }}
            >
              <SelectTrigger
                className="w-full"
                aria-labelledby="category-parent-label"
                aria-describedby={parentLocked ? 'category-parent-hint' : undefined}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {parentItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {hasChildren && (
          <p id="category-parent-hint" className="text-xs text-muted-foreground">
            {t('categories.parentLocked')}
          </p>
        )}
      </div>

      {kind === 'income' && (
        <div className="grid gap-1.5">
          <Label id="category-shift-label">{t('categories.monthShift')}</Label>
          <Controller
            control={form.control}
            name="monthShift"
            render={({ field }) => (
              <Select
                value={field.value}
                items={shiftItems}
                onValueChange={(value) => {
                  if (value) field.onChange(value)
                }}
              >
                <SelectTrigger
                  className="w-full"
                  aria-labelledby="category-shift-label"
                  aria-describedby="category-shift-hint"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {shiftItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <p id="category-shift-hint" className="text-xs text-muted-foreground">
            {t('categories.monthShiftHint')}
          </p>
        </div>
      )}

      <div className="grid gap-1.5">
        <Label htmlFor="category-icon">{t('directories.icon')}</Label>
        <Controller
          control={form.control}
          name="icon"
          render={({ field }) => (
            <IconPicker
              id="category-icon"
              value={field.value}
              fallback={DEFAULT_ICON}
              onChange={field.onChange}
            />
          )}
        />
      </div>

      <div className="grid gap-1.5">
        <p id="category-color-label" className="text-sm font-medium">
          {t('directories.color')}
        </p>
        <Controller
          control={form.control}
          name="color"
          render={({ field }) => (
            <ColorPicker
              labelledBy="category-color-label"
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
