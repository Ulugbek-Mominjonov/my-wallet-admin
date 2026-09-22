import { MoreHorizontal, RotateCcw, SkipForward } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { Category } from '@/entities/category'
import {
  isOpenStatus,
  plannedStatus,
  type PlannedItem,
  type PlannedStatus,
} from '@/entities/planned-item'
import { DEFAULT_ICON } from '@/shared/config/icons'
import { useAppLocale } from '@/shared/i18n'
import { formatDate } from '@/shared/lib/date'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'
import { EntityIconTile } from '@/shared/ui/entity-icon'
import { MoneyText } from '@/shared/ui/money-text'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'

const STATUS_VARIANT: Record<PlannedStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  overdue: 'destructive',
  partial: 'secondary',
  pending: 'outline',
  paid: 'default',
  skipped: 'outline',
}

/** 👤 fond ajratmasi rejasi (BR-060) — tizim rejasi. */
const FUND_ALLOCATION = 'personal_allocation'

/** Yozish huquqi bo'lsa — tanlov va amallar. */
export interface PlanSectionActions {
  selected: ReadonlySet<string>
  onSelect: (next: ReadonlySet<string>) => void
  onPay: (plan: PlannedItem) => void
  onSkip: (plan: PlannedItem, skipped: boolean) => void
}

/** E23-T04: bitta bo'lim (kechikkan, bugun, ...) — reja qatorlari jadvali. */
export function PlanSection({
  id,
  title,
  items,
  today,
  categories,
  baseCurrency,
  actions,
}: {
  id: string
  title: string
  items: readonly PlannedItem[]
  today: string
  categories: ReadonlyMap<string, Category>
  baseCurrency: string
  actions?: PlanSectionActions
}) {
  const { t } = useTranslation()
  const locale = useAppLocale()
  const selectable = actions ? items.filter((p) => isOpenStatus(plannedStatus(p, today))) : []
  const selectedHere = actions ? selectable.filter((p) => actions.selected.has(p.id)).length : 0

  return (
    <section aria-labelledby={`plans-${id}`} className="space-y-2">
      <h2 id={`plans-${id}`} className="text-sm font-semibold text-muted-foreground">
        {title} · {items.length}
      </h2>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              {actions && (
                <TableHead className="w-10">
                  {selectable.length > 0 && (
                    <Checkbox
                      aria-label={t('plans.bulk.selectAll', { section: title })}
                      checked={selectedHere === selectable.length}
                      indeterminate={selectedHere > 0 && selectedHere < selectable.length}
                      onCheckedChange={(checked) => {
                        const next = new Set(actions.selected)
                        for (const plan of selectable) {
                          if (checked) next.add(plan.id)
                          else next.delete(plan.id)
                        }
                        actions.onSelect(next)
                      }}
                    />
                  )}
                </TableHead>
              )}
              <TableHead>{t('plans.columns.name')}</TableHead>
              <TableHead>{t('plans.columns.due')}</TableHead>
              <TableHead className="text-right">{t('plans.columns.amount')}</TableHead>
              <TableHead className="text-right">{t('plans.columns.paid')}</TableHead>
              <TableHead>{t('plans.columns.status')}</TableHead>
              {actions && (
                <TableHead className="w-32">
                  <span className="sr-only">{t('table.actions')}</span>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((plan) => {
              const status = plannedStatus(plan, today)
              const open = isOpenStatus(status)
              const category =
                plan.categoryId === null ? undefined : categories.get(plan.categoryId)
              const checked = actions?.selected.has(plan.id) ?? false
              return (
                <TableRow key={plan.id} data-state={checked ? 'selected' : undefined}>
                  {actions && (
                    <TableCell>
                      {open && (
                        <Checkbox
                          aria-label={t('plans.bulk.select', { name: plan.name })}
                          checked={checked}
                          onCheckedChange={(value) => {
                            const next = new Set(actions.selected)
                            if (value) next.add(plan.id)
                            else next.delete(plan.id)
                            actions.onSelect(next)
                          }}
                        />
                      )}
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <EntityIconTile
                        name={category?.icon ?? DEFAULT_ICON}
                        color={category?.color ?? null}
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-medium">{plan.name}</span>
                          {plan.autoPay && <Badge variant="outline">{t('plans.autoPay')}</Badge>}
                        </div>
                        {category && plan.systemCode !== FUND_ALLOCATION && (
                          <p className="truncate text-xs text-muted-foreground">{category.name}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {formatDate(plan.dueDate, locale)}
                  </TableCell>
                  <TableCell className="text-right">
                    {plan.plannedAmount === null ? (
                      <span className="font-medium">?</span>
                    ) : (
                      <MoneyText amount={plan.plannedAmount} currency={baseCurrency} />
                    )}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {plan.paidAmount > 0 && (
                      <MoneyText amount={plan.paidAmount} currency={baseCurrency} />
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[status]}>{t(`plans.status.${status}`)}</Badge>
                  </TableCell>
                  {actions && (
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {open && (
                          <Button
                            size="sm"
                            onClick={() => {
                              actions.onPay(plan)
                            }}
                          >
                            {plan.kind === 'income' ? t('plans.received') : t('plans.pay')}
                          </Button>
                        )}
                        {(open || status === 'skipped') && (
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={t('directories.moreActions', { name: plan.name })}
                                />
                              }
                            >
                              <MoreHorizontal aria-hidden />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="min-w-44">
                              <DropdownMenuItem
                                onClick={() => {
                                  actions.onSkip(plan, status !== 'skipped')
                                }}
                              >
                                {status === 'skipped' ? (
                                  <RotateCcw aria-hidden />
                                ) : (
                                  <SkipForward aria-hidden />
                                )}
                                {status === 'skipped' ? t('plans.unskip') : t('plans.skip')}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}
