import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { optimisticList } from '@/shared/api/optimistic'

interface Archivable {
  id: string
  archivedAt: string | null
  /** Bo'lsa — tartib optimistik shu maydonda ham (daraxt kabi ko'rinishlar saralaydi). */
  sortOrder?: number
}

/**
 * Spravochniklar uchun umumiy o'zgarishlar (E22-T01): arxivlash, o'chirish va
 * tartib — optimistik, xatoda qaytadi (xato matni — global toast).
 */
export function useDirectoryMutations<TItem extends Archivable>({
  listKey,
  allKey,
  showingArchived,
  archive,
  remove,
  reorder,
}: {
  /** Ekrandagi ro'yxat kaliti (optimistik o'zgarish shu keshda). */
  listKey: QueryKey
  /** Barcha filtr variantlari prefiksi — oxirida qayta olinadi. */
  allKey: QueryKey
  showingArchived: boolean
  archive: (id: string, archived: boolean) => Promise<void>
  remove: (id: string) => Promise<void>
  reorder: (ids: string[]) => Promise<void>
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const archiveMutation = useMutation({
    mutationFn: ({ id, value }: { id: string; value: boolean }) => archive(id, value),
    ...optimisticList<TItem, { id: string; value: boolean }>(
      queryClient,
      listKey,
      (items, { id, value }) =>
        showingArchived
          ? items.map((item) =>
              item.id === id
                ? { ...item, archivedAt: value ? new Date().toISOString() : null }
                : item,
            )
          : items.filter((item) => item.id !== id),
      allKey,
    ),
    onSuccess: (_, { value }) => {
      toast.success(value ? t('directories.archivedToast') : t('directories.restoredToast'))
    },
  })

  const removeMutation = useMutation({
    mutationFn: (id: string) => remove(id),
    ...optimisticList<TItem, string>(
      queryClient,
      listKey,
      (items, id) => items.filter((item) => item.id !== id),
      allKey,
    ),
    onSuccess: () => {
      toast.success(t('directories.deleted'))
    },
  })

  const reorderMutation = useMutation({
    mutationFn: (ids: string[]) => reorder(ids),
    ...optimisticList<TItem, string[]>(
      queryClient,
      listKey,
      (items, ids) => {
        const position = new Map(ids.map((id, index) => [id, index]))
        const at = (item: TItem) => position.get(item.id) ?? Number.MAX_SAFE_INTEGER
        return items
          .map((item) => {
            const index = position.get(item.id)
            return index === undefined || item.sortOrder === undefined
              ? item
              : { ...item, sortOrder: index }
          })
          .sort((a, b) => at(a) - at(b))
      },
      allKey,
    ),
  })

  return { archive: archiveMutation, remove: removeMutation, reorder: reorderMutation }
}
