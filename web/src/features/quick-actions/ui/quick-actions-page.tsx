import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Zap } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { categoryTree, type Category } from '@/entities/category'
import { useCan } from '@/entities/household'
import {
  createQuickAction,
  deleteQuickAction,
  quickActionsKey,
  quickActionsQuery,
  reorderQuickActions,
  updateQuickAction,
  type QuickAction,
  type QuickActionInput,
} from '@/features/quick-actions/api/quick-actions-api'
import { QuickActionForm } from '@/features/quick-actions/ui/quick-action-form'
import { useOptimisticRemove, useOptimisticReorder } from '@/shared/api/use-directory-mutations'
import { DEFAULT_ICON } from '@/shared/config/icons'
import { useAppLocale } from '@/shared/i18n'
import { formatMoney } from '@/shared/lib/money'
import { Button } from '@/shared/ui/button'
import { DataTable } from '@/shared/ui/data-table/data-table'
import { createDataTableColumns } from '@/shared/ui/data-table/features'
import { DirectoryPage } from '@/shared/ui/directory-page'
import { DirectoryRowActions } from '@/shared/ui/directory-row-actions'
import { EmptyState } from '@/shared/ui/empty-state'
import { EntityIcon } from '@/shared/ui/entity-icon'
import { MoneyText } from '@/shared/ui/money-text'

const helper = createDataTableColumns<QuickAction>()

export interface AccountOption {
  id: string
  name: string
  archivedAt: string | null
}

/** E22-T05: tez tugmalar (BR-120) — tartib mobil oynadagi ketma-ketlik. */
export function QuickActionsPage({
  householdId,
  categories,
  accounts,
  baseCurrency,
}: {
  householdId: string
  categories: readonly Category[]
  accounts: readonly AccountOption[]
  baseCurrency: string
}) {
  const { t } = useTranslation()
  const locale = useAppLocale()
  const canManage = useCan('manage')
  const queryClient = useQueryClient()
  const list = quickActionsQuery(householdId)
  const query = useQuery(list)
  const [editing, setEditing] = useState<QuickAction | 'new' | null>(null)
  const [deleting, setDeleting] = useState<QuickAction | null>(null)
  const allKey = quickActionsKey(householdId)

  const save = useMutation({
    mutationFn: async (input: QuickActionInput) => {
      if (editing === null || editing === 'new') {
        const last = Math.max(-1, ...(query.data ?? []).map((a) => a.sortOrder))
        await createQuickAction(householdId, input, last + 1)
      } else {
        await updateQuickAction(editing.id, input)
      }
    },
    onSuccess: async () => {
      setEditing(null)
      toast.success(t('directories.saved'))
      await queryClient.invalidateQueries({ queryKey: allKey })
    },
    meta: { silent: true },
  })
  const remove = useOptimisticRemove<QuickAction>({
    listKey: list.queryKey,
    allKey,
    remove: deleteQuickAction,
  })
  const reorder = useOptimisticReorder<QuickAction>({
    listKey: list.queryKey,
    allKey,
    reorder: (ids) => reorderQuickActions(householdId, ids),
  })

  // Forma tanlovlari: faqat xarajat kategoriyalari va faol hisoblar.
  const categoryOptions = useMemo(
    () =>
      categoryTree(categories.filter((c) => c.kind === 'expense' && c.archivedAt === null)).map(
        (c) => ({ value: c.id, label: c.parentName ? `${c.parentName} › ${c.name}` : c.name }),
      ),
    [categories],
  )
  const accountOptions = useMemo(
    () =>
      accounts.filter((a) => a.archivedAt === null).map((a) => ({ value: a.id, label: a.name })),
    [accounts],
  )

  const columns = useMemo(() => {
    const category = new Map(categories.map((c) => [c.id, c]))
    const accountName = new Map(accounts.map((a) => [a.id, a.name]))
    const base = helper.columns([
      helper.display({
        id: 'preview',
        header: t('quickActions.preview'),
        meta: { label: t('quickActions.preview') },
        // Mobil "Qo'shish" oynasidagi chip ko'rinishi.
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm whitespace-nowrap">
            <EntityIcon
              name={category.get(row.original.categoryId)?.icon ?? DEFAULT_ICON}
              className="size-4"
            />
            {row.original.name} ·{' '}
            {formatMoney(row.original.amount, { currency: baseCurrency, locale })}
          </span>
        ),
      }),
      helper.accessor('name', {
        header: t('quickActions.name'),
        enableHiding: false,
        cell: ({ row }) =>
          canManage ? (
            <button
              type="button"
              className="rounded-md text-left font-medium hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              onClick={() => {
                setEditing(row.original)
              }}
            >
              {row.original.name}
            </button>
          ) : (
            <span className="font-medium">{row.original.name}</span>
          ),
      }),
      helper.accessor('amount', {
        header: t('quickActions.amount'),
        meta: { label: t('quickActions.amount'), align: 'end' },
        enableGlobalFilter: false,
        cell: ({ row }) => <MoneyText amount={row.original.amount} currency={baseCurrency} />,
      }),
      helper.accessor((a) => category.get(a.categoryId)?.name ?? '', {
        id: 'category',
        header: t('quickActions.category'),
        meta: { label: t('quickActions.category') },
      }),
      helper.accessor((a) => accountName.get(a.accountId) ?? '', {
        id: 'account',
        header: t('quickActions.account'),
        meta: { label: t('quickActions.account') },
      }),
      helper.accessor((a) => a.payee ?? '', {
        id: 'payee',
        header: t('quickActions.payee'),
        meta: { label: t('quickActions.payee') },
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
            name={row.original.name}
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
  }, [t, locale, canManage, categories, accounts, baseCurrency])

  const addButton = canManage && (
    <Button
      onClick={() => {
        save.reset()
        setEditing('new')
      }}
    >
      <Plus aria-hidden />
      {t('quickActions.add')}
    </Button>
  )

  return (
    <DirectoryPage
      title={t('quickActions.title')}
      description={t('quickActions.description')}
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
        title: editing === 'new' ? t('quickActions.newTitle') : t('quickActions.editTitle'),
        onClose: () => {
          setEditing(null)
        },
        content: editing !== null && (
          <QuickActionForm
            key={editing === 'new' ? 'new' : editing.id}
            action={editing === 'new' ? undefined : editing}
            categories={categoryOptions}
            accounts={accountOptions}
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
        name: deleting?.name ?? null,
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
        rowLabel={(action) => action.name}
        onReorder={
          canManage
            ? (ids) => {
                reorder.mutate(ids)
              }
            : undefined
        }
        initialVisibility={{ payee: false }}
        empty={
          <EmptyState
            icon={Zap}
            title={t('quickActions.emptyTitle')}
            description={t('quickActions.emptyText')}
            action={addButton}
          />
        }
      />
    </DirectoryPage>
  )
}
