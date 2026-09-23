import type { ParseKeys, TFunction } from 'i18next'

import type { HealthIssue } from '@/features/tools/api/health-api'

/** contracts/api.md dagi tekshiruv kodlari → matn kaliti. */
const MESSAGES: Record<string, ParseKeys> = {
  month_not_opened: 'health.codes.month_not_opened',
  debt_unlinked: 'health.codes.debt_unlinked',
  debt_plans_overdue: 'health.codes.debt_plans_overdue',
  no_active_rules: 'health.codes.no_active_rules',
  negative_cash: 'health.codes.negative_cash',
  long_overdue: 'health.codes.long_overdue',
  edited_after_close: 'health.codes.edited_after_close',
  fx_rate_stale: 'health.codes.fx_rate_stale',
}

export interface IssueLabels {
  t: TFunction
  money: (minor: number) => string
  date: (isoDate: string) => string
}

/**
 * Tekshiruv kodi → o'qiladigan matn (contracts/api.md kodlari). Noma'lum kod
 * kelsa — kodning o'zi ko'rsatiladi (sahifa buzilmaydi).
 */
export function issueMessage(issue: HealthIssue, { t, money, date }: IssueLabels): string {
  const key = MESSAGES[issue.code]
  if (key === undefined) return issue.code
  const options: Record<string, unknown> = {
    count: issue.count ?? 0,
    days: issue.days ?? 0,
    name: issue.name ?? '',
    currency: issue.currency ?? '',
    balance: issue.balance === undefined ? '' : money(issue.balance),
    date: issue.last_rate_date === undefined ? '' : date(issue.last_rate_date),
  }
  return t(key, options)
}
