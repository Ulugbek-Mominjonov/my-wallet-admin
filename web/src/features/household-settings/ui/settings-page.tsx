import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import type { Role } from '@/entities/household'
import { monthIncomeQuery, settingsQuery } from '@/features/household-settings/api/settings-api'
import { DangerZone } from '@/features/household-settings/ui/danger-zone'
import { FundSection } from '@/features/household-settings/ui/fund-section'
import { GeneralSection } from '@/features/household-settings/ui/general-section'
import { MembersSection } from '@/features/household-settings/ui/members-section'
import { MonthPolicySection } from '@/features/household-settings/ui/month-policy-section'
import type { SelectOption } from '@/shared/ui/form-select'
import { PageHeader } from '@/shared/ui/page-header'
import { QueryError } from '@/shared/ui/query-error'
import { Skeleton } from '@/shared/ui/skeleton'

/**
 * E22-T07: byudjet sozlamalari — hamma a'zolar ko'radi (a'zolar ro'yxati,
 * chiqish), o'zgartirish owner/admin, xavfli zona — faqat owner.
 */
export function SettingsPage({
  householdId,
  userId,
  role,
  month,
  accounts,
  allocationUnit,
}: {
  householdId: string
  userId: string
  role: Role
  /** Joriy oy boshi — fond ajratmasi preview'i uchun. */
  month: string
  /** 👤 fond manbai bo'la oladigan hisoblar. */
  accounts: readonly SelectOption[]
  allocationUnit: number
}) {
  const { t } = useTranslation()
  const canManage = role === 'owner' || role === 'admin'
  const settings = useQuery(settingsQuery(householdId))
  const income = useQuery(monthIncomeQuery(householdId, month))

  return (
    <>
      <PageHeader title={t('settings.title')} description={t('settings.description')} />
      {settings.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : settings.isError ? (
        <QueryError
          error={settings.error}
          onRetry={() => {
            void settings.refetch()
          }}
        />
      ) : (
        <>
          <GeneralSection settings={settings.data} canManage={canManage} />
          <FundSection
            settings={settings.data}
            accounts={accounts}
            income={income.data}
            unit={allocationUnit}
            canManage={canManage}
          />
          <MonthPolicySection settings={settings.data} canManage={canManage} />
          <MembersSection householdId={householdId} userId={userId} role={role} />
          {role === 'owner' && <DangerZone householdId={householdId} name={settings.data.name} />}
        </>
      )}
    </>
  )
}
