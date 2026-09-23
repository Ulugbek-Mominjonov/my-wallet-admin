import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { CircleCheck, RefreshCw, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  healthCheckQuery,
  healthKey,
  linkTransactionToDebt,
  type HealthIssue,
} from '@/features/tools/api/health-api'
import { issueMessage, type IssueLabels } from '@/features/tools/model/health'
import { useAppLocale } from '@/shared/i18n'
import { formatDate } from '@/shared/lib/date'
import { formatMoney } from '@/shared/lib/money'
import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { PageHeader } from '@/shared/ui/page-header'
import { QueryError } from '@/shared/ui/query-error'
import { SectionCard } from '@/shared/ui/section-card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { TableSkeleton } from '@/shared/ui/table-skeleton'

/**
 * E25-T01: tekshiruv (BR-130, BR-131) — muammolar, ogohlantirishlar va
 * ma'lumot; har biri yonida tegishli amal yoki sahifaga havola.
 */
export function HealthPage({
  householdId,
  baseCurrency,
}: {
  householdId: string
  baseCurrency: string
}) {
  const { t } = useTranslation()
  const locale = useAppLocale()
  const queryClient = useQueryClient()
  const health = useQuery(healthCheckQuery(householdId))
  const [linking, setLinking] = useState<HealthIssue | null>(null)
  const labels: IssueLabels = {
    t,
    money: (value) => formatMoney(value, { currency: baseCurrency, locale }),
    date: (value) => formatDate(value, locale),
  }

  const link = useMutation({
    mutationFn: ({ transactionId, debtId }: { transactionId: string; debtId: string }) =>
      linkTransactionToDebt(transactionId, debtId),
    onSuccess: async () => {
      setLinking(null)
      toast.success(t('health.link.done'))
      await queryClient.invalidateQueries({ queryKey: healthKey(householdId) })
    },
  })

  const header = (
    <PageHeader
      title={t('health.title')}
      description={t('health.description')}
      actions={
        <Button
          variant="outline"
          disabled={health.isFetching}
          onClick={() => {
            void health.refetch()
          }}
        >
          <RefreshCw aria-hidden />
          {t('health.recheck')}
        </Button>
      }
    />
  )

  if (health.isPending) {
    return (
      <div className="space-y-6">
        {header}
        <TableSkeleton />
      </div>
    )
  }
  if (health.error) {
    return (
      <div className="space-y-6">
        {header}
        <QueryError
          error={health.error}
          onRetry={() => {
            void health.refetch()
          }}
        />
      </div>
    )
  }

  const { problems, warnings, info } = health.data
  const clean = problems.length === 0 && warnings.length === 0

  return (
    <div className="space-y-6">
      {header}

      {clean ? (
        <p className="flex items-center gap-2 rounded-lg border p-4 text-sm">
          <CircleCheck aria-hidden className="size-5 text-income" />
          {t('health.clean')}
        </p>
      ) : (
        <>
          {problems.length > 0 && (
            <SectionCard title={t('health.problems')}>
              <IssueList
                householdId={householdId}
                issues={problems}
                labels={labels}
                tone="destructive"
                onLinkDebt={setLinking}
              />
            </SectionCard>
          )}
          {warnings.length > 0 && (
            <SectionCard title={t('health.warnings')}>
              <IssueList
                householdId={householdId}
                issues={warnings}
                labels={labels}
                tone="warning"
                onLinkDebt={setLinking}
              />
            </SectionCard>
          )}
        </>
      )}

      <SectionCard title={t('health.info')}>
        <dl className="grid gap-4 sm:grid-cols-3">
          <Info label={t('health.stats.transactions')}>{info.transactions}</Info>
          <Info label={t('health.stats.plans')}>{info.planned_items}</Info>
          <Info label={t('health.stats.firstMonth')}>{info.first_month ?? '—'}</Info>
          <Info label={t('health.stats.openedMonths')}>{info.opened_months.length}</Info>
          <Info label={t('health.stats.closedMonths')}>{info.closed_months.length}</Info>
          <Info label={t('health.stats.incomeRules')}>
            {info.income_rules.map((rule) => rule.name).join(', ') || '—'}
          </Info>
        </dl>
      </SectionCard>

      {linking && (
        <LinkDebtDialog
          issue={linking}
          labels={labels}
          pending={link.isPending}
          onLink={(transactionId) => {
            const debtId = linking.debt_id
            if (debtId !== undefined) link.mutate({ transactionId, debtId })
          }}
          onClose={() => {
            setLinking(null)
          }}
        />
      )}
    </div>
  )
}

function IssueList({
  householdId,
  issues,
  labels,
  tone,
  onLinkDebt,
}: {
  householdId: string
  issues: readonly HealthIssue[]
  labels: IssueLabels
  tone: 'destructive' | 'warning'
  onLinkDebt: (issue: HealthIssue) => void
}) {
  return (
    <ul className="space-y-3">
      {issues.map((issue, index) => (
        <li
          key={`${issue.code}:${String(index)}`}
          className="flex flex-wrap items-center justify-between gap-3"
        >
          <span className="flex items-start gap-2 text-sm">
            <TriangleAlert
              aria-hidden
              className={
                tone === 'destructive'
                  ? 'mt-0.5 size-4 text-destructive'
                  : 'mt-0.5 size-4 text-warning'
              }
            />
            {issueMessage(issue, labels)}
          </span>
          <IssueAction householdId={householdId} issue={issue} onLinkDebt={onLinkDebt} />
        </li>
      ))}
    </ul>
  )
}

/** Har muammo uchun tegishli amal: sahifaga havola yoki dialog. */
function IssueAction({
  householdId,
  issue,
  onLinkDebt,
}: {
  householdId: string
  issue: HealthIssue
  onLinkDebt: (issue: HealthIssue) => void
}) {
  const { t } = useTranslation()
  const params = { householdId }
  switch (issue.code) {
    case 'month_not_opened':
    case 'debt_plans_overdue':
    case 'long_overdue':
      return (
        <Button
          variant="outline"
          size="sm"
          render={<Link to="/h/$householdId/plans" params={params} />}
        >
          {t('health.actions.openMonth')}
        </Button>
      )
    case 'debt_unlinked':
      return (
        <Button
          variant="outline"
          size="sm"
          disabled={(issue.suggestions?.length ?? 0) === 0}
          onClick={() => {
            onLinkDebt(issue)
          }}
        >
          {t('health.actions.linkDebt')}
        </Button>
      )
    case 'no_active_rules':
      return (
        <Button
          variant="outline"
          size="sm"
          render={<Link to="/h/$householdId/recurring-rules" params={params} />}
        >
          {t('health.actions.rules')}
        </Button>
      )
    case 'negative_cash':
      return (
        <Button
          variant="outline"
          size="sm"
          render={<Link to="/h/$householdId/accounts" params={params} />}
        >
          {t('health.actions.accounts')}
        </Button>
      )
    case 'edited_after_close':
      return (
        <Button
          variant="outline"
          size="sm"
          render={<Link to="/h/$householdId/transactions" params={params} />}
        >
          {t('health.actions.transactions')}
        </Button>
      )
    default:
      return null
  }
}

/** BR-131: tavsiya qilingan xarajatlardan birini qarzga bog'lash. */
function LinkDebtDialog({
  issue,
  labels,
  pending,
  onLink,
  onClose,
}: {
  issue: HealthIssue
  labels: IssueLabels
  pending: boolean
  onLink: (transactionId: string) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [selected, setSelected] = useState<string | null>(null)

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent showCloseButton={false} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('health.link.title', { name: issue.name ?? '' })}</DialogTitle>
          <DialogDescription>{t('health.link.text')}</DialogDescription>
        </DialogHeader>
        <Table aria-label={t('health.link.title', { name: issue.name ?? '' })}>
          <TableHeader>
            <TableRow>
              <TableHead>{t('health.link.date')}</TableHead>
              <TableHead>{t('health.link.payee')}</TableHead>
              <TableHead className="text-right">{t('health.link.amount')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(issue.suggestions ?? []).map((suggestion) => (
              <TableRow
                key={suggestion.transaction_id}
                data-state={selected === suggestion.transaction_id ? 'selected' : undefined}
                onClick={() => {
                  setSelected(suggestion.transaction_id)
                }}
              >
                <TableCell>
                  <Button
                    variant="link"
                    className="h-auto p-0"
                    aria-pressed={selected === suggestion.transaction_id}
                    onClick={() => {
                      setSelected(suggestion.transaction_id)
                    }}
                  >
                    {labels.date(suggestion.occurred_on)}
                  </Button>
                </TableCell>
                <TableCell>{suggestion.payee ?? '—'}</TableCell>
                <TableCell className="text-right">{labels.money(suggestion.amount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            disabled={selected === null || pending}
            onClick={() => {
              if (selected !== null) onLink(selected)
            }}
          >
            {t('health.link.apply')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  )
}
