import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { Category } from '@/entities/category'
import { toAppError } from '@/shared/api/errors'
import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { Label } from '@/shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'

/**
 * BR-036: birlashtirish — manba ichidagi hamma narsa maqsadga ko'chadi.
 * Maqsad: shu tur, o'zi va o'z bolalari emas (server ham tekshiradi).
 */
export function MergeDialog({
  source,
  categories,
  pending,
  error,
  onMerge,
  onClose,
}: {
  source: Category | null
  categories: readonly Category[]
  pending: boolean
  error: Error | null
  onMerge: (targetId: string) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [target, setTarget] = useState<string | null>(null)
  const targets = source
    ? categories.filter(
        (c) => c.kind === source.kind && c.id !== source.id && c.parentId !== source.id,
      )
    : []
  const items = targets.map((c) => ({ value: c.id, label: c.name }))

  return (
    <Dialog
      open={source !== null}
      onOpenChange={(open) => {
        if (!open) {
          setTarget(null)
          onClose()
        }
      }}
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t('categories.mergeTitle', { name: source?.name ?? '' })}</DialogTitle>
          <DialogDescription>
            {t('categories.mergeText', { name: source?.name ?? '' })}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label id="merge-target-label">{t('categories.mergeTarget')}</Label>
          <Select value={target} items={items} onValueChange={setTarget}>
            <SelectTrigger className="w-full" aria-labelledby="merge-target-label">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {items.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {toAppError(error).message}
          </p>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setTarget(null)
              onClose()
            }}
          >
            {t('common.cancel')}
          </Button>
          <Button
            variant="destructive"
            disabled={target === null || pending}
            onClick={() => {
              if (target) onMerge(target)
            }}
          >
            {t('categories.merge')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
