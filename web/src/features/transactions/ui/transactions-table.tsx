import { ArrowLeftRight, Paperclip } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { ACCOUNT_TYPE_ICON, type Account } from '@/entities/account'
import type { Transaction } from '@/entities/transaction'
import {
  MISSING,
  transactionName,
  type TransactionLookup,
} from '@/features/transactions/model/labels'
import { DEFAULT_ICON } from '@/shared/config/icons'
import { useAppLocale } from '@/shared/i18n'
import { formatDate } from '@/shared/lib/date'
import { formatMonth } from '@/shared/lib/month'
import { cn } from '@/shared/lib/utils'
import { Badge } from '@/shared/ui/badge'
import { Checkbox } from '@/shared/ui/checkbox'
import { DirectoryRowActions } from '@/shared/ui/directory-row-actions'
import { EntityIcon, EntityIconTile, IconTile } from '@/shared/ui/entity-icon'
import { MoneyText } from '@/shared/ui/money-text'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'

/** `YYYY-MM-DD` / `YYYY-MM-01` → `YYYY-MM`. */
const monthOf = (isoDate: string) => isoDate.slice(0, 7)

/** E23-T01: amallar jadvali (server tartibi — sana va id bo'yicha kamayish). */
interface RowActions {
  onEdit: (row: Transaction) => void
  onDelete: (row: Transaction) => void
}

interface Selection {
  selected: ReadonlySet<string>
  onChange: (next: ReadonlySet<string>) => void
}

export function TransactionsTable({
  rows,
  lookup,
  baseCurrency,
  busy,
  actions,
  selection,
}: {
  rows: readonly Transaction[]
  lookup: TransactionLookup
  baseCurrency: string
  /** Yangi filtr natijasi kutilmoqda — eski qatorlar xiralashtiriladi. */
  busy: boolean
  /** Yozish huquqi bo'lsa — qator amallari (tahrirlash, o'chirish). */
  actions?: RowActions
  /** Ommaviy amallar uchun tanlov (E23-T03). */
  selection?: Selection
}) {
  const { t } = useTranslation()
  const selectedHere = selection ? rows.filter((row) => selection.selected.has(row.id)).length : 0
  return (
    <div className={cn('rounded-lg border transition-opacity', busy && 'opacity-60')}>
      <Table aria-label={t('transactions.title')} aria-busy={busy}>
        <TableHeader>
          <TableRow>
            {selection && (
              <TableHead className="w-10">
                <Checkbox
                  aria-label={t('transactions.bulk.selectAll')}
                  checked={rows.length > 0 && selectedHere === rows.length}
                  indeterminate={selectedHere > 0 && selectedHere < rows.length}
                  onCheckedChange={(checked) => {
                    const next = new Set(selection.selected)
                    for (const row of rows) {
                      if (checked) next.add(row.id)
                      else next.delete(row.id)
                    }
                    selection.onChange(next)
                  }}
                />
              </TableHead>
            )}
            <TableHead>{t('transactions.columns.date')}</TableHead>
            <TableHead>{t('transactions.columns.category')}</TableHead>
            <TableHead>{t('transactions.columns.description')}</TableHead>
            <TableHead>{t('transactions.columns.account')}</TableHead>
            <TableHead>{t('transactions.columns.member')}</TableHead>
            <TableHead className="text-right">{t('transactions.columns.amount')}</TableHead>
            {actions && (
              <TableHead className="w-10">
                <span className="sr-only">{t('table.actions')}</span>
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TransactionRow
              key={row.id}
              row={row}
              lookup={lookup}
              baseCurrency={baseCurrency}
              actions={actions}
              selection={selection}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function TransactionRow({
  row,
  lookup,
  baseCurrency,
  actions,
  selection,
}: {
  row: Transaction
  lookup: TransactionLookup
  baseCurrency: string
  actions?: RowActions
  selection?: Selection
}) {
  const { t } = useTranslation()
  const locale = useAppLocale()
  const account = lookup.accounts.get(row.accountId)
  const toAccount = row.toAccountId === null ? undefined : lookup.accounts.get(row.toAccountId)
  const category = row.categoryId === null ? undefined : lookup.categories.get(row.categoryId)
  const currency = account?.currency ?? baseCurrency
  // Ismsiz profil yoki byudjetdan chiqqan a'zo — chiziqcha.
  const memberName = row.createdBy === null ? '' : (lookup.members.get(row.createdBy) ?? '')
  // BR-040..045: tegishli oy sana oyidan farq qilsa — ko'rsatiladi.
  const shifted = monthOf(row.budgetMonth) !== monthOf(row.occurredOn)

  const selected = selection?.selected.has(row.id) ?? false
  return (
    <TableRow data-state={selected ? 'selected' : undefined}>
      {selection && (
        <TableCell>
          <Checkbox
            aria-label={t('transactions.bulk.select', {
              name: transactionName(row, category, t('transactions.transfer')),
            })}
            checked={selected}
            onCheckedChange={(checked) => {
              const next = new Set(selection.selected)
              if (checked) next.add(row.id)
              else next.delete(row.id)
              selection.onChange(next)
            }}
          />
        </TableCell>
      )}
      <TableCell className="whitespace-nowrap tabular-nums">
        {formatDate(row.occurredOn, locale)}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          {row.kind === 'transfer' ? (
            <>
              <IconTile color={null}>
                <ArrowLeftRight aria-hidden />
              </IconTile>
              <span>{t('transactions.transfer')}</span>
            </>
          ) : (
            <>
              <EntityIconTile
                name={category?.icon ?? DEFAULT_ICON}
                color={category?.color ?? null}
              />
              <span className={cn(!category && 'text-muted-foreground')}>
                {category?.name ?? t('transactions.noCategory')}
              </span>
            </>
          )}
        </div>
      </TableCell>
      <TableCell className="max-w-72">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-medium">{row.payee ?? MISSING}</span>
          {row.hasReceipt && (
            <Paperclip
              role="img"
              aria-label={t('transactions.receipt')}
              className="size-3.5 text-muted-foreground"
            />
          )}
          {shifted && (
            <Badge variant="outline">
              {t('transactions.budgetMonth', {
                month: formatMonth(monthOf(row.budgetMonth), locale),
              })}
            </Badge>
          )}
          {row.tagIds.map((id) => {
            const tag = lookup.tags.get(id)
            return (
              tag && (
                <Badge key={id} variant="secondary">
                  {tag.name}
                </Badge>
              )
            )
          })}
        </div>
        {row.note && <p className="truncate text-xs text-muted-foreground">{row.note}</p>}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <AccountName account={account} />
        {row.kind === 'transfer' && (
          <>
            <ArrowLeftRight aria-hidden className="mx-1 inline size-3.5 text-muted-foreground" />
            <span className="sr-only">→</span>
            <AccountName account={toAccount} />
          </>
        )}
      </TableCell>
      <TableCell className="whitespace-nowrap text-muted-foreground">
        {memberName === '' ? MISSING : memberName}
      </TableCell>
      <TableCell className="text-right">
        <MoneyText
          amount={row.kind === 'expense' ? -row.amount : row.amount}
          currency={currency}
          tone={row.kind === 'transfer' ? 'neutral' : row.kind}
          signed={row.kind !== 'transfer'}
          className="font-medium"
        />
        {currency !== baseCurrency && (
          <div className="text-xs text-muted-foreground">
            <MoneyText amount={row.amountBase} currency={baseCurrency} />
          </div>
        )}
      </TableCell>
      {actions && (
        <TableCell>
          <DirectoryRowActions
            name={transactionName(row, category, t('transactions.transfer'))}
            archived={false}
            onEdit={() => {
              actions.onEdit(row)
            }}
            onDelete={() => {
              actions.onDelete(row)
            }}
          />
        </TableCell>
      )}
    </TableRow>
  )
}

function AccountName({ account }: { account: Account | undefined }) {
  if (!account) return <span className="text-muted-foreground">{MISSING}</span>
  return (
    <span className="inline-flex items-center gap-1">
      <EntityIcon
        name={account.icon ?? ACCOUNT_TYPE_ICON[account.type]}
        className="size-3.5 text-muted-foreground"
      />
      {account.name}
    </span>
  )
}
