import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Gauge, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { categoryTree, type Category } from '@/entities/category'
import { useCan } from '@/entities/household'
import {
  createLimit,
  deleteLimit,
  limitsKey,
  limitsQuery,
  updateLimit,
  type CategoryLimit,
  type LimitInput,
  type LimitStatus,
} from '@/features/limits/api/limits-api'
import { LimitForm } from '@/features/limits/ui/limit-form'
import { useOptimisticRemove } from '@/shared/api/use-directory-mutations'
import { cn } from '@/shared/lib/utils'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { DataTable } from '@/shared/ui/data-table/data-table'
import { createDataTableColumns } from '@/shared/ui/data-table/features'
import { DirectoryPage } from '@/shared/ui/directory-page'
import { DirectoryRowActions } from '@/shared/ui/directory-row-actions'
import { EmptyState } from '@/shared/ui/empty-state'
import { MoneyText } from '@/shared/ui/money-text'

const helper = createDataTableColumns<CategoryLimit>()

const STATUS_BAR: Record<LimitStatus, string> = {
  ok: 'bg-income',
  near: 'bg-warning',
  over: 'bg-expense',
}

/**
 * E22-T05: limitlar (BR-130..133) — oylik chegara, joriy oy fakti va holati
 * (ota-kategoriya subkategoriyalar bilan), 80%/100% bildirishnomalari.
 */
export function LimitsPage({
  householdId,
  month,
  categories,
  baseCurrency,
}: {
  householdId: string
  /** Joriy oy boshi (`YYYY-MM-01`) — holat shu oy bo'yicha. */
  month: string
  categories: readonly Category[]
  baseCurrency: string
}) {
  const { t } = useTranslation()
  const canManage = useCan('manage')
  const queryClient = useQueryClient()
  const list = limitsQuery(householdId, month)
  const query = useQuery(list)
  const [editing, setEditing] = useState<CategoryLimit | 'new' | null>(null)
  const [deleting, setDeleting] = useState<CategoryLimit | null>(null)
  const categoryName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories])

  const save = useMutation({
    mutationFn: (input: LimitInput) =>
      editing === null || editing === 'new'
        ? createLimit(householdId, input)
        : updateLimit(editing.id, input),
    onSuccess: async () => {
      setEditing(null)
      toast.success(t('directories.saved'))
      await queryClient.invalidateQueries({ queryKey: limitsKey(householdId) })
    },
    meta: { silent: true },
  })
  const remove = useOptimisticRemove<CategoryLimit>({
    listKey: list.queryKey,
    allKey: limitsKey(householdId),
    remove: deleteLimit,
  })

  // Yangi limit — hali limiti yo'q xarajat kategoriyalari (bittadan, BR-130).
  const limited = new Set((query.data ?? []).map((l) => l.categoryId))
  const categoryOptions = categoryTree(
    categories.filter(
      (c) =>
        c.kind === 'expense' &&
        c.archivedAt === null &&
        (!limited.has(c.id) || (editing !== 'new' && editing?.categoryId === c.id)),
    ),
  ).map((c) => ({ value: c.id, label: c.parentName ? `${c.parentName} › ${c.name}` : c.name }))

  const columns = useMemo(() => {
    const base = helper.columns([
      helper.accessor((l) => categoryName.get(l.categoryId) ?? '', {
        id: 'category',
        header: t('limits.category'),
        enableHiding: false,
        cell: ({ row, getValue }) =>
          canManage ? (
            <button
              type="button"
              className="rounded-md text-left font-medium hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              onClick={() => {
                setEditing(row.original)
              }}
            >
              {getValue()}
            </button>
          ) : (
            <span className="font-medium">{getValue()}</span>
          ),
      }),
      helper.accessor('amount', {
        header: t('limits.amount'),
        meta: { label: t('limits.amount'), align: 'end' },
        enableGlobalFilter: false,
        cell: ({ row }) => <MoneyText amount={row.original.amount} currency={baseCurrency} />,
      }),
      helper.accessor('actual', {
        header: t('limits.thisMonth'),
        meta: { label: t('limits.thisMonth'), align: 'end' },
        enableGlobalFilter: false,
        cell: ({ row }) => <MoneyText amount={row.original.actual} currency={baseCurrency} />,
      }),
      helper.accessor('ratio', {
        header: t('limits.progress'),
        meta: { label: t('limits.progress') },
        enableGlobalFilter: false,
        cell: ({ row }) => <LimitBar limit={row.original} />,
      }),
      helper.display({
        id: 'alerts',
        header: t('limits.alerts'),
        meta: { label: t('limits.alerts') },
        cell: ({ row }) => (
          <span className="flex gap-1">
            {row.original.alert80 && <Badge variant="outline">80%</Badge>}
            {row.original.alert100 && <Badge variant="outline">100%</Badge>}
          </span>
        ),
      }),
    ])
    if (!canManage) return base
    return [
      ...base,
      helper.display({
        id: 'actions',
        header: () => <span className="sr-only">{t('directories.actions')}</span>,
        enableHiding: false,
        cell: ({ row }) => (
          <DirectoryRowActions
            name={categoryName.get(row.original.categoryId) ?? ''}
            archived={false}
            onEdit={() => {
              setEditing(row.original)
            }}
            onDelete={() => {
              setDeleting(row.original)
            }}
          />
        ),
      }),
    ]
  }, [t, canManage, categoryName, baseCurrency])

  const addButton = canManage && (
    <Button
      onClick={() => {
        save.reset()
        setEditing('new')
      }}
    >
      <Plus aria-hidden />
      {t('limits.add')}
    </Button>
  )

  return (
    <DirectoryPage
      title={t('limits.title')}
      description={t('limits.description')}
      actions={addButton}
      status={{
        isPending: query.isPending,
        error: query.error,
        onRetry: () => {
          void query.refetch()
        },
      }}
      form={{
        open: editing !== null,
        title: editing === 'new' ? t('limits.newTitle') : t('limits.editTitle'),
        onClose: () => {
          setEditing(null)
        },
        content: editing !== null && (
          <LimitForm
            key={editing === 'new' ? 'new' : editing.id}
            limit={editing === 'new' ? undefined : editing}
            categories={categoryOptions}
            currency={baseCurrency}
            pending={save.isPending}
            error={save.error}
            onSubmit={(input) => {
              save.mutate(input)
            }}
            onCancel={() => {
              setEditing(null)
            }}
          />
        ),
      }}
      remove={{
        name: deleting ? (categoryName.get(deleting.categoryId) ?? '') : null,
        pending: remove.isPending,
        onClose: () => {
          setDeleting(null)
        },
        onConfirm: () => {
          if (deleting) {
            remove.mutate(deleting.id, {
              onSettled: () => {
                setDeleting(null)
              },
            })
          }
        },
      }}
    >
      <DataTable
        data={query.data ?? []}
        columns={columns}
        rowLabel={(l) => categoryName.get(l.categoryId) ?? ''}
        initialSorting={[{ id: 'ratio', desc: true }]}
        empty={
          <EmptyState
            icon={Gauge}
            title={t('limits.emptyTitle')}
            description={t('limits.emptyText')}
            action={addButton}
          />
        }
      />
    </DirectoryPage>
  )
}

/** Fakt ÷ limit — rang holatga qarab (ok / near / over), 100% dan oshsa to'liq. */
function LimitBar({ limit }: { limit: CategoryLimit }) {
  const { t } = useTranslation()
  const percent = Math.round(limit.ratio * 100)
  return (
    <div className="flex min-w-40 items-center gap-2">
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(percent, 100)}
        aria-valuetext={`${String(percent)}% — ${t(`limits.status.${limit.status}`)}`}
        className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn('h-full rounded-full', STATUS_BAR[limit.status])}
          style={{ width: `${String(Math.min(percent, 100))}%` }}
        />
      </div>
      <span
        className={cn(
          'w-24 text-xs tabular-nums',
          limit.status === 'over' ? 'text-expense' : 'text-muted-foreground',
        )}
      >
        {t('limits.ratio', { percent })} · {t(`limits.status.${limit.status}`)}
      </span>
    </div>
  )
}
