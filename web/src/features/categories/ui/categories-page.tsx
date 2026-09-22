import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Combine, CornerDownRight, FolderTree, ListPlus, Plus } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  categoryTree,
  isSystemCategory,
  type Category,
  type CategoryKind,
  type CategoryNode,
} from '@/entities/category'
import { useCan } from '@/entities/household'
import {
  categoriesKey,
  categoriesQuery,
  createCategory,
  deleteCategory,
  mergeCategories,
  reorderCategories,
  setCategoryArchived,
  updateCategory,
  type CategoryInput,
} from '@/features/categories/api/categories-api'
import { parentOptions } from '@/features/categories/model/category-form'
import { CategoryForm } from '@/features/categories/ui/category-form'
import { MergeDialog } from '@/features/categories/ui/merge-dialog'
import { RecalcDialog } from '@/features/categories/ui/recalc-dialog'
import { qk } from '@/shared/api/query-keys'
import { useDirectoryMutations } from '@/shared/api/use-directory-mutations'
import { DEFAULT_ICON } from '@/shared/config/icons'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { ConfirmDialog } from '@/shared/ui/confirm-dialog'
import { DataTable } from '@/shared/ui/data-table/data-table'
import { createDataTableColumns } from '@/shared/ui/data-table/features'
import { DirectoryRowActions } from '@/shared/ui/directory-row-actions'
import { DropdownMenuItem } from '@/shared/ui/dropdown-menu'
import { EmptyState } from '@/shared/ui/empty-state'
import { EntityIcon } from '@/shared/ui/entity-icon'
import { PageHeader } from '@/shared/ui/page-header'
import { QueryError } from '@/shared/ui/query-error'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/shared/ui/sheet'
import { Switch } from '@/shared/ui/switch'
import { TableSkeleton } from '@/shared/ui/table-skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/tabs'

const helper = createDataTableColumns<CategoryNode>()

type Editing = { category?: Category; parentId: string | null } | null

interface CategoryActions {
  onEdit: (category: Category) => void
  onAddChild: (parent: Category) => void
  onMerge: (category: Category) => void
  onArchive: (category: Category) => void
  onDelete: (category: Category) => void
}

/**
 * E22-T03: kategoriyalar — daromad/xarajat tablari, daraxt (bir daraja),
 * ikon va rang, oy siljishi (+ BR-043 qayta joylash), birlashtirish (BR-036),
 * tizim kategoriyasi (BR-033), tartib (BR-037).
 */
export function CategoriesPage({
  householdId,
  baseCurrency,
}: {
  householdId: string
  baseCurrency: string
}) {
  const { t } = useTranslation()
  const canManage = useCan('manage')
  const queryClient = useQueryClient()
  const [kind, setKind] = useState<CategoryKind>('expense')
  const [archived, setArchived] = useState(false)
  const list = categoriesQuery(householdId, { archived })
  const query = useQuery(list)
  const [editing, setEditing] = useState<Editing>(null)
  const [deleting, setDeleting] = useState<Category | null>(null)
  const [merging, setMerging] = useState<Category | null>(null)
  const [recalc, setRecalc] = useState(false)
  const allCategories = categoriesKey(householdId)

  const categories = useMemo(() => query.data ?? [], [query.data])
  const rows = useMemo(
    () => categoryTree(categories.filter((c) => c.kind === kind)),
    [categories, kind],
  )

  const save = useMutation({
    mutationFn: async (input: CategoryInput) => {
      const current = editing?.category
      if (current) {
        await updateCategory(current.id, input)
        return current.kind === 'income' && current.monthShift !== input.monthShift
      }
      const last = Math.max(-1, ...categories.map((c) => c.sortOrder))
      await createCategory(householdId, kind, input, last + 1)
      return false
    },
    onSuccess: async (shiftChanged) => {
      setEditing(null)
      toast.success(t('directories.saved'))
      // BR-043: oy siljishi o'zgardi — eski yozuvlar preview bilan qayta joylanadi.
      if (shiftChanged) setRecalc(true)
      await queryClient.invalidateQueries({ queryKey: allCategories })
    },
    meta: { silent: true },
  })

  const merge = useMutation({
    mutationFn: ({ from, to }: { from: string; to: string }) => mergeCategories(from, to),
    onSuccess: async (result) => {
      setMerging(null)
      toast.success(
        t('categories.merged', {
          transactions: result.transactions,
          plans: result.plans,
          rules: result.recurring_rules,
        }),
      )
      await queryClient.invalidateQueries({ queryKey: qk.household(householdId) })
    },
    meta: { silent: true },
  })

  const { archive, remove, reorder } = useDirectoryMutations<Category>({
    listKey: list.queryKey,
    allKey: allCategories,
    showingArchived: archived,
    archive: setCategoryArchived,
    remove: deleteCategory,
    reorder: (ids) => reorderCategories(householdId, ids),
  })

  const { mutate: archiveCategory } = archive
  const onArchive = useCallback(
    (category: Category) => {
      archiveCategory({ id: category.id, value: category.archivedAt === null })
    },
    [archiveCategory],
  )
  const onEdit = useCallback((category: Category) => {
    setEditing({ category, parentId: category.parentId })
  }, [])
  const onAddChild = useCallback((parent: Category) => {
    setEditing({ parentId: parent.id })
  }, [])
  const columns = useCategoryColumns(canManage, kind, {
    onEdit,
    onAddChild,
    onMerge: setMerging,
    onArchive,
    onDelete: setDeleting,
  })

  const addLabel = kind === 'income' ? t('categories.addIncome') : t('categories.add')
  const addButton = canManage && (
    <Button
      onClick={() => {
        save.reset()
        setEditing({ parentId: null })
      }}
    >
      <Plus aria-hidden />
      {addLabel}
    </Button>
  )
  const current = editing?.category
  const hasChildren = current ? categories.some((c) => c.parentId === current.id) : false

  return (
    <>
      <PageHeader
        title={t('categories.title')}
        description={t('categories.description')}
        actions={addButton}
      />
      <Tabs
        value={kind}
        onValueChange={(value: CategoryKind) => {
          setKind(value)
        }}
      >
        <TabsList>
          <TabsTrigger value="expense">{t('categories.expense')}</TabsTrigger>
          <TabsTrigger value="income">{t('categories.income')}</TabsTrigger>
        </TabsList>
      </Tabs>
      {query.isPending ? (
        <TableSkeleton />
      ) : query.isError ? (
        <QueryError
          error={query.error}
          onRetry={() => {
            void query.refetch()
          }}
        />
      ) : (
        <DataTable
          key={kind}
          data={rows}
          columns={columns}
          rowLabel={(category) => category.name}
          onReorder={
            canManage && !archived
              ? (ids) => {
                  reorder.mutate(ids)
                }
              : undefined
          }
          toolbar={
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={archived} onCheckedChange={setArchived} />
              {t('directories.showArchived')}
            </label>
          }
          empty={
            <EmptyState
              icon={FolderTree}
              title={t('categories.emptyTitle')}
              description={t('categories.emptyText')}
              action={addButton}
            />
          }
        />
      )}

      <Sheet
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
      >
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {current
                ? t('categories.editTitle')
                : kind === 'income'
                  ? t('categories.newIncomeTitle')
                  : t('categories.newTitle')}
            </SheetTitle>
          </SheetHeader>
          {editing !== null && (
            <CategoryForm
              key={current?.id ?? `new-${editing.parentId ?? ''}`}
              kind={current?.kind ?? kind}
              category={current}
              parentId={editing.parentId}
              parents={parentOptions(categories, current?.kind ?? kind, current)}
              hasChildren={hasChildren}
              pending={save.isPending}
              error={save.error}
              onSubmit={(input) => {
                save.mutate(input)
              }}
              onCancel={() => {
                setEditing(null)
              }}
            />
          )}
        </SheetContent>
      </Sheet>

      <MergeDialog
        source={merging}
        categories={categories}
        pending={merge.isPending}
        error={merge.error}
        onMerge={(to) => {
          if (merging) merge.mutate({ from: merging.id, to })
        }}
        onClose={() => {
          merge.reset()
          setMerging(null)
        }}
      />

      <RecalcDialog
        householdId={householdId}
        baseCurrency={baseCurrency}
        open={recalc}
        onClose={() => {
          setRecalc(false)
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title={t('directories.deleteTitle', { name: deleting?.name ?? '' })}
        description={t('directories.deleteText')}
        confirmLabel={t('directories.delete')}
        cancelLabel={t('common.cancel')}
        destructive
        pending={remove.isPending}
        onConfirm={() => {
          if (deleting) {
            // Xatoda ham yopiladi: sabab toast'da, qayta urinish foyda bermaydi.
            remove.mutate(deleting.id, {
              onSettled: () => {
                setDeleting(null)
              },
            })
          }
        }}
      />
    </>
  )
}

function useCategoryColumns(canManage: boolean, kind: CategoryKind, actions: CategoryActions) {
  const { t } = useTranslation()
  const { onEdit, onAddChild, onMerge, onArchive, onDelete } = actions

  return useMemo(() => {
    const columns = helper.columns([
      helper.accessor('name', {
        header: t('categories.name'),
        enableHiding: false,
        enableSorting: false,
        cell: ({ row }) => (
          <CategoryName category={row.original} onEdit={canManage ? onEdit : undefined} />
        ),
      }),
    ])
    const shift =
      kind === 'income'
        ? [
            helper.accessor((category) => t(`categories.shift${shiftKey(category)}`), {
              id: 'monthShift',
              header: t('categories.monthShift'),
              enableSorting: false,
              meta: { label: t('categories.monthShift') },
            }),
          ]
        : []
    const manage = canManage
      ? [
          helper.display({
            id: 'actions',
            header: () => <span className="sr-only">{t('directories.actions')}</span>,
            enableHiding: false,
            cell: ({ row }) => (
              <CategoryRowActions
                category={row.original}
                onEdit={onEdit}
                onAddChild={onAddChild}
                onMerge={onMerge}
                onArchive={onArchive}
                onDelete={onDelete}
              />
            ),
          }),
        ]
      : []
    return [...columns, ...shift, ...manage]
  }, [t, canManage, kind, onEdit, onAddChild, onMerge, onArchive, onDelete])
}

const shiftKey = (category: Category): '0' | '-1' => (category.monthShift === -1 ? '-1' : '0')

/** Ota — to'liq qator; bola — chekinish bilan (qidiruvda ota nomi ham ko'rinadi). */
function CategoryName({
  category,
  onEdit,
}: {
  category: CategoryNode
  onEdit: ((category: Category) => void) | undefined
}) {
  const { t } = useTranslation()
  const label = (
    <>
      <span
        className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted"
        style={
          category.color
            ? { backgroundColor: `${category.color}26`, color: category.color }
            : undefined
        }
      >
        <EntityIcon name={category.icon ?? DEFAULT_ICON} className="size-4" />
      </span>
      <span className="truncate font-medium">{category.name}</span>
    </>
  )
  return (
    <div
      className={category.depth === 1 ? 'flex items-center gap-2 pl-6' : 'flex items-center gap-2'}
    >
      {category.depth === 1 && (
        <CornerDownRight
          className="size-4 shrink-0 text-muted-foreground"
          aria-label={category.parentName ?? undefined}
        />
      )}
      {onEdit ? (
        <button
          type="button"
          className="flex min-w-0 items-center gap-2 rounded-md text-left hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          onClick={() => {
            onEdit(category)
          }}
        >
          {label}
        </button>
      ) : (
        <span className="flex min-w-0 items-center gap-2">{label}</span>
      )}
      {isSystemCategory(category) && <Badge variant="secondary">{t('directories.system')}</Badge>}
      {category.archivedAt && <Badge variant="outline">{t('directories.archived')}</Badge>}
    </div>
  )
}

function CategoryRowActions({
  category,
  onEdit,
  onAddChild,
  onMerge,
  onArchive,
  onDelete,
}: { category: CategoryNode } & CategoryActions) {
  const { t } = useTranslation()
  const system = isSystemCategory(category)
  // BR-034: faqat yuqori darajadagi (tizim bo'lmagan) kategoriyaga bola.
  const canHaveChildren = category.depth === 0 && !system && category.archivedAt === null
  return (
    <DirectoryRowActions
      name={category.name}
      archived={category.archivedAt !== null}
      onEdit={() => {
        onEdit(category)
      }}
      onArchive={
        system
          ? undefined
          : () => {
              onArchive(category)
            }
      }
      onDelete={
        system
          ? undefined
          : () => {
              onDelete(category)
            }
      }
      extra={
        <>
          {canHaveChildren && (
            <DropdownMenuItem
              onClick={() => {
                onAddChild(category)
              }}
            >
              <ListPlus aria-hidden />
              {t('categories.addChild')}
            </DropdownMenuItem>
          )}
          {!system && (
            <DropdownMenuItem
              onClick={() => {
                onMerge(category)
              }}
            >
              <Combine aria-hidden />
              {t('categories.merge')}
            </DropdownMenuItem>
          )}
        </>
      }
    />
  )
}
