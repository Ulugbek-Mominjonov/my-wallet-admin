import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { optimisticList } from '@/shared/api/optimistic'

interface DirectoryItem {
  id: string
  archivedAt?: string | null
  /** Bo'lsa — tartib optimistik shu maydonda ham (daraxt kabi ko'rinishlar saralaydi). */
  sortOrder?: number
}

interface ListKeys {
  /** Ekrandagi ro'yxat kaliti (optimistik o'zgarish shu keshda). */
  listKey: QueryKey
  /** Barcha filtr variantlari prefiksi — oxirida qayta olinadi. */
  allKey: QueryKey
}

/** Arxivlash/qaytarish — optimistik (arxiv ko'rinmasa qator darhol yo'qoladi). */
export function useOptimisticArchive<TItem extends DirectoryItem>({
  listKey,
  allKey,
  showingArchived,
  archive,
}: ListKeys & {
  showingArchived: boolean
  archive: (id: string, archived: boolean) => Promise<void>
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  return useMutation({
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
}

/** O'chirish — optimistik; server rad etsa (ishlatilmoqda) qator qaytadi. */
export function useOptimisticRemove<TItem extends DirectoryItem>({
  listKey,
  allKey,
  remove,
}: ListKeys & { remove: (id: string) => Promise<void> }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  return useMutation({
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
}

/** Tartib (drag & drop) — optimistik, bitta so'rovda (`set_sort_order`). */
export function useOptimisticReorder<TItem extends DirectoryItem>({
  listKey,
  allKey,
  reorder,
}: ListKeys & { reorder: (ids: string[]) => Promise<void> }) {
  const queryClient = useQueryClient()
  return useMutation({
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
}

/**
 * Spravochniklar uchun umumiy o'zgarishlar (E22-T01): arxivlash, o'chirish va
 * tartib — optimistik, xatoda qaytadi (xato matni — global toast).
 */
export function useDirectoryMutations<TItem extends DirectoryItem>({
  listKey,
  allKey,
  showingArchived,
  archive,
  remove,
  reorder,
}: ListKeys & {
  showingArchived: boolean
  archive: (id: string, archived: boolean) => Promise<void>
  remove: (id: string) => Promise<void>
  reorder: (ids: string[]) => Promise<void>
}) {
  return {
    archive: useOptimisticArchive<TItem>({ listKey, allKey, showingArchived, archive }),
    remove: useOptimisticRemove<TItem>({ listKey, allKey, remove }),
    reorder: useOptimisticReorder<TItem>({ listKey, allKey, reorder }),
  }
}
