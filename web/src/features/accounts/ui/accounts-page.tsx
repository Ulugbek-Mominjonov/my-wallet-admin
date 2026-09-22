import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Wallet } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ACCOUNT_TYPE_ICON, isSystemAccount, type Account } from '@/entities/account'
import { useCan } from '@/entities/household'
import {
  accountsKey,
  accountsQuery,
  createAccount,
  deleteAccount,
  reorderAccounts,
  setAccountArchived,
  updateAccount,
  type AccountInput,
} from '@/features/accounts/api/accounts-api'
import { AccountForm, type CurrencyOption } from '@/features/accounts/ui/account-form'
import { useDirectoryMutations } from '@/shared/api/use-directory-mutations'
import { todayIso } from '@/shared/lib/date'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { ConfirmDialog } from '@/shared/ui/confirm-dialog'
import { DataTable } from '@/shared/ui/data-table/data-table'
import { createDataTableColumns } from '@/shared/ui/data-table/features'
import { DirectoryRowActions } from '@/shared/ui/directory-row-actions'
import { EmptyState } from '@/shared/ui/empty-state'
import { EntityIcon } from '@/shared/ui/entity-icon'
import { MoneyText } from '@/shared/ui/money-text'
import { PageHeader } from '@/shared/ui/page-header'
import { QueryError } from '@/shared/ui/query-error'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/shared/ui/sheet'
import { Switch } from '@/shared/ui/switch'
import { TableSkeleton } from '@/shared/ui/table-skeleton'

const helper = createDataTableColumns<Account>()

interface AccountActions {
  onEdit: (account: Account) => void
  onArchive: (account: Account) => void
  onDelete: (account: Account) => void
}

/**
 * E22-T02: hisoblar — joriy qoldiq bilan jadval, forma, arxiv, o'chirish va
 * sudrab tartiblash. Boshqarish — owner/admin (`manage`), qolganlar o'qiydi.
 */
export function AccountsPage({
  householdId,
  currencies,
  baseCurrency,
  timezone,
}: {
  householdId: string
  currencies: CurrencyOption[]
  baseCurrency: string
  timezone: string
}) {
  const { t } = useTranslation()
  const canManage = useCan('manage')
  const queryClient = useQueryClient()
  const [archived, setArchived] = useState(false)
  const list = accountsQuery(householdId, { archived })
  const query = useQuery(list)
  const [editing, setEditing] = useState<Account | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Account | null>(null)
  const allAccounts = accountsKey(householdId)

  const save = useMutation({
    mutationFn: async (input: AccountInput) => {
      if (editing === null || editing === 'new') {
        const last = Math.max(-1, ...(query.data ?? []).map((a) => a.sortOrder))
        await createAccount(householdId, input, last + 1)
      } else {
        await updateAccount(editing.id, input)
      }
    },
    onSuccess: async () => {
      setEditing(null)
      toast.success(t('directories.saved'))
      await queryClient.invalidateQueries({ queryKey: allAccounts })
    },
    // Xato forma ichida ko'rsatiladi (foydalanuvchi to'g'rilaydi).
    meta: { silent: true },
  })

  const { archive, remove, reorder } = useDirectoryMutations<Account>({
    listKey: list.queryKey,
    allKey: allAccounts,
    showingArchived: archived,
    archive: setAccountArchived,
    remove: deleteAccount,
    reorder: (ids) => reorderAccounts(householdId, ids),
  })

  // Barqaror havolalar — ustunlar har renderda qayta qurilmaydi (jadval modeli).
  const { mutate: archiveAccount } = archive
  const onArchive = useCallback(
    (account: Account) => {
      archiveAccount({ id: account.id, value: account.archivedAt === null })
    },
    [archiveAccount],
  )
  const columns = useAccountColumns(canManage, {
    onEdit: setEditing,
    onArchive,
    onDelete: setDeleting,
  })

  const addButton = canManage && (
    <Button
      onClick={() => {
        save.reset()
        setEditing('new')
      }}
    >
      <Plus aria-hidden />
      {t('accounts.add')}
    </Button>
  )

  return (
    <>
      <PageHeader
        title={t('accounts.title')}
        description={t('accounts.description')}
        actions={addButton}
      />
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
          data={query.data}
          columns={columns}
          rowLabel={(account) => account.name}
          onReorder={
            canManage && !archived
              ? (ids) => {
                  reorder.mutate(ids)
                }
              : undefined
          }
          initialVisibility={{ openingBalance: false }}
          toolbar={
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={archived} onCheckedChange={setArchived} />
              {t('directories.showArchived')}
            </label>
          }
          empty={
            <EmptyState
              icon={Wallet}
              title={t('accounts.emptyTitle')}
              description={t('accounts.emptyText')}
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
              {editing === 'new' ? t('accounts.newTitle') : t('accounts.editTitle')}
            </SheetTitle>
          </SheetHeader>
          {editing !== null && (
            <AccountForm
              key={editing === 'new' ? 'new' : editing.id}
              account={editing === 'new' ? undefined : editing}
              currencies={currencies}
              defaults={{ currency: baseCurrency, today: todayIso(timezone) }}
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

function useAccountColumns(canManage: boolean, actions: AccountActions) {
  const { t } = useTranslation()
  const { onEdit, onArchive, onDelete } = actions

  return useMemo(() => {
    const columns = helper.columns([
      helper.accessor('name', {
        header: t('accounts.name'),
        enableHiding: false,
        cell: ({ row }) => (
          <AccountName account={row.original} onEdit={canManage ? onEdit : undefined} />
        ),
      }),
      helper.accessor((account) => t(`accounts.types.${account.type}`), {
        id: 'type',
        header: t('accounts.type'),
        meta: { label: t('accounts.type') },
      }),
      helper.accessor('currency', {
        header: t('accounts.currency'),
        meta: { label: t('accounts.currency') },
      }),
      helper.accessor('balance', {
        header: t('accounts.balance'),
        meta: { label: t('accounts.balance'), align: 'end' },
        enableGlobalFilter: false,
        cell: ({ row }) => (
          <MoneyText amount={row.original.balance} currency={row.original.currency} tone="auto" />
        ),
      }),
      helper.accessor('openingBalance', {
        header: t('accounts.openingBalance'),
        meta: { label: t('accounts.openingBalance'), align: 'end' },
        enableGlobalFilter: false,
        cell: ({ row }) => (
          <MoneyText amount={row.original.openingBalance} currency={row.original.currency} />
        ),
      }),
    ])
    if (!canManage) return columns
    return [
      ...columns,
      helper.display({
        id: 'actions',
        header: () => <span className="sr-only">{t('directories.actions')}</span>,
        enableHiding: false,
        cell: ({ row }) => (
          <AccountRowActions
            account={row.original}
            onEdit={onEdit}
            onArchive={onArchive}
            onDelete={onDelete}
          />
        ),
      }),
    ]
  }, [t, canManage, onEdit, onArchive, onDelete])
}

function AccountName({
  account,
  onEdit,
}: {
  account: Account
  onEdit: ((account: Account) => void) | undefined
}) {
  const { t } = useTranslation()
  const label = (
    <>
      <span
        className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted"
        style={
          account.color
            ? { backgroundColor: `${account.color}26`, color: account.color }
            : undefined
        }
      >
        <EntityIcon name={account.icon ?? ACCOUNT_TYPE_ICON[account.type]} className="size-4" />
      </span>
      <span className="truncate font-medium">{account.name}</span>
    </>
  )
  return (
    <div className="flex items-center gap-2">
      {onEdit ? (
        <button
          type="button"
          className="flex min-w-0 items-center gap-2 rounded-md text-left hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          onClick={() => {
            onEdit(account)
          }}
        >
          {label}
        </button>
      ) : (
        <span className="flex min-w-0 items-center gap-2">{label}</span>
      )}
      {isSystemAccount(account) && <Badge variant="secondary">{t('directories.system')}</Badge>}
      {account.archivedAt && <Badge variant="outline">{t('directories.archived')}</Badge>}
    </div>
  )
}

function AccountRowActions({
  account,
  onEdit,
  onArchive,
  onDelete,
}: { account: Account } & AccountActions) {
  const system = isSystemAccount(account)
  return (
    <DirectoryRowActions
      name={account.name}
      archived={account.archivedAt !== null}
      onEdit={() => {
        onEdit(account)
      }}
      onArchive={
        system
          ? undefined
          : () => {
              onArchive(account)
            }
      }
      onDelete={
        system
          ? undefined
          : () => {
              onDelete(account)
            }
      }
    />
  )
}
