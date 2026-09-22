import { FolderTree, Tag as TagIcon, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { BulkAction } from '@/features/transactions/api/transactions-api'
import { Button } from '@/shared/ui/button'
import { ConfirmDialog } from '@/shared/ui/confirm-dialog'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import type { FilterOption } from '@/shared/ui/filter-multi-select'
import { FormCombobox } from '@/shared/ui/form-combobox'
import { Label } from '@/shared/ui/label'

type ValueAction = Exclude<BulkAction, 'delete'>

/**
 * E23-T03 (BR-183): tanlangan amallar ustida — kategoriya, teg, o'chirish.
 * Qiymat dialogda tanlanadi va "Qo'llash" bilan yuboriladi (tasodifiy
 * ommaviy o'zgarish bo'lmasin); o'chirish — tasdiq bilan.
 */
export function BulkActions({
  count,
  categories,
  tags,
  pending,
  onApply,
  onClear,
}: {
  count: number
  categories: readonly FilterOption[]
  tags: readonly FilterOption[]
  pending: boolean
  onApply: (action: BulkAction, value?: string) => void
  onClear: () => void
}) {
  const { t } = useTranslation()
  const [dialog, setDialog] = useState<ValueAction | 'delete' | null>(null)
  const apply = (action: BulkAction, value?: string) => {
    setDialog(null)
    onApply(action, value)
  }

  return (
    <div
      role="region"
      aria-label={t('transactions.bulk.selected', { count })}
      className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/50 p-2"
    >
      <span className="px-2 text-sm font-medium">{t('transactions.bulk.selected', { count })}</span>
      <Button
        variant="outline"
        disabled={pending}
        onClick={() => {
          setDialog('set_category')
        }}
      >
        <FolderTree aria-hidden />
        {t('transactions.bulk.setCategory')}
      </Button>
      <Button
        variant="outline"
        disabled={pending || tags.length === 0}
        onClick={() => {
          setDialog('add_tag')
        }}
      >
        <TagIcon aria-hidden />
        {t('transactions.bulk.addTag')}
      </Button>
      <Button
        variant="outline"
        disabled={pending}
        onClick={() => {
          setDialog('delete')
        }}
      >
        <Trash2 aria-hidden />
        {t('transactions.bulk.delete')}
      </Button>
      <Button variant="ghost" className="ml-auto" onClick={onClear}>
        <X aria-hidden />
        {t('transactions.bulk.clear')}
      </Button>

      {(dialog === 'set_category' || dialog === 'add_tag') && (
        <ValueDialog
          action={dialog}
          options={dialog === 'set_category' ? categories : tags}
          onApply={(value) => {
            apply(dialog, value)
          }}
          onClose={() => {
            setDialog(null)
          }}
        />
      )}
      <ConfirmDialog
        open={dialog === 'delete'}
        onOpenChange={(open) => {
          if (!open) setDialog(null)
        }}
        title={t('transactions.bulk.deleteTitle')}
        description={t('transactions.bulk.deleteText', { count })}
        confirmLabel={t('transactions.bulk.delete')}
        cancelLabel={t('common.cancel')}
        destructive
        pending={pending}
        onConfirm={() => {
          apply('delete')
        }}
      />
    </div>
  )
}

function ValueDialog({
  action,
  options,
  onApply,
  onClose,
}: {
  action: ValueAction
  options: readonly FilterOption[]
  onApply: (value: string) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [value, setValue] = useState('')
  const isCategory = action === 'set_category'

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>
            {isCategory ? t('transactions.bulk.categoryTitle') : t('transactions.bulk.tagTitle')}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label id="bulk-value-label">
            {isCategory ? t('transactions.form.category') : t('transactions.form.tags')}
          </Label>
          <FormCombobox
            labelId="bulk-value-label"
            value={value}
            options={options}
            onChange={setValue}
            placeholder={
              isCategory ? t('transactions.form.chooseCategory') : t('transactions.bulk.chooseTag')
            }
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            disabled={value === ''}
            onClick={() => {
              onApply(value)
            }}
          >
            {t('transactions.bulk.apply')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
