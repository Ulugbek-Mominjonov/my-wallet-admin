import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { ConfirmDialog } from '@/shared/ui/confirm-dialog'
import { PageHeader } from '@/shared/ui/page-header'
import { QueryError } from '@/shared/ui/query-error'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/shared/ui/sheet'
import { TableSkeleton } from '@/shared/ui/table-skeleton'

interface DirectoryPageProps {
  title: string
  description: string
  actions?: ReactNode
  /** Ro'yxat so'rovi holati: yuklanmoqda — skeleton, xato — qayta urinish. */
  status: { isPending: boolean; error: Error | null; onRetry: () => void }
  /** Tayyor bo'lganda — jadval (va yuqoridagi boshqaruvlar). */
  children: ReactNode
  /** Yon panel forma (yaratish/tahrirlash). */
  form: { open: boolean; title: string; onClose: () => void; content: ReactNode }
  /** O'chirish tasdig'i: `name` bo'lsa ochiq. */
  remove: { name: string | null; pending: boolean; onConfirm: () => void; onClose: () => void }
  /** Qo'shimcha dialoglar (birlashtirish, preview...). */
  dialogs?: ReactNode
}

/**
 * E22-T01: spravochnik sahifasi shabloni — sarlavha, holatlar (yuklanish,
 * xato, jadval), Sheet'dagi forma va o'chirish tasdig'i bir xil ko'rinishda.
 */
export function DirectoryPage({
  title,
  description,
  actions,
  status,
  children,
  form,
  remove,
  dialogs,
}: DirectoryPageProps) {
  const { t } = useTranslation()
  return (
    <>
      <PageHeader title={title} description={description} actions={actions} />
      {status.isPending ? (
        <TableSkeleton />
      ) : status.error ? (
        <QueryError error={status.error} onRetry={status.onRetry} />
      ) : (
        children
      )}

      <Sheet
        open={form.open}
        onOpenChange={(open) => {
          if (!open) form.onClose()
        }}
      >
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{form.title}</SheetTitle>
          </SheetHeader>
          {form.open && form.content}
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={remove.name !== null}
        onOpenChange={(open) => {
          if (!open) remove.onClose()
        }}
        title={t('directories.deleteTitle', { name: remove.name ?? '' })}
        description={t('directories.deleteText')}
        confirmLabel={t('directories.delete')}
        cancelLabel={t('common.cancel')}
        destructive
        pending={remove.pending}
        onConfirm={remove.onConfirm}
      />
      {dialogs}
    </>
  )
}
