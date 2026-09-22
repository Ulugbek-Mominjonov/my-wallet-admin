import { Archive, ArchiveRestore, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/shared/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'

/**
 * Spravochnik qatori amallari: tahrirlash, (qo'shimcha), arxiv va o'chirish.
 * Tizim yozuvlarida arxiv/o'chirish berilmaydi (`onArchive`/`onDelete` yo'q).
 */
export function DirectoryRowActions({
  name,
  archived,
  onEdit,
  onArchive,
  onDelete,
  extra,
}: {
  name: string
  archived: boolean
  onEdit: () => void
  onArchive?: () => void
  onDelete?: () => void
  /** Qo'shimcha bandlar (masalan "Subkategoriya qo'shish", "Birlashtirish"). */
  extra?: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t('directories.moreActions', { name })}
            />
          }
        >
          <MoreHorizontal aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuItem onClick={onEdit}>
            <Pencil aria-hidden />
            {t('directories.edit')}
          </DropdownMenuItem>
          {extra}
          {onArchive && (
            <DropdownMenuItem onClick={onArchive}>
              {archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
              {archived ? t('directories.unarchive') : t('directories.archive')}
            </DropdownMenuItem>
          )}
          {onDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={onDelete}>
                <Trash2 aria-hidden />
                {t('directories.delete')}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
