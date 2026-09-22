import { queryOptions } from '@tanstack/react-query'
import { z } from 'zod'

import type { Role } from '@/entities/household'
import { toAppError } from '@/shared/api/errors'
import { qk } from '@/shared/api/query-keys'
import { supabase } from '@/shared/api/supabase'

export type FundMode = 'percent' | 'fixed'

export interface HouseholdSettings {
  id: string
  name: string
  baseCurrency: string
  timezone: string
  fundMode: FundMode
  fundPercent: number
  fundFixedAmount: number
  fundDay: number
  fundSourceAccountId: string | null
  autoOpenMonth: boolean
  strictMonthLock: boolean
}

export const settingsKey = (householdId: string) =>
  [...qk.household(householdId), 'settings'] as const

/** E22-T07: byudjet sozlamalari — faqat kerakli ustunlar. */
export const settingsQuery = (householdId: string) =>
  queryOptions({
    queryKey: settingsKey(householdId),
    queryFn: async (): Promise<HouseholdSettings> => {
      const { data, error } = await supabase
        .from('households')
        .select(
          'id, name, base_currency, timezone, personal_fund_mode, personal_fund_percent, personal_fund_fixed_amount, personal_fund_day, personal_fund_source_account_id, auto_open_month, strict_month_lock',
        )
        .eq('id', householdId)
        .single()
      if (error) throw toAppError(error)
      return {
        id: data.id,
        name: data.name,
        baseCurrency: data.base_currency,
        timezone: data.timezone,
        fundMode: data.personal_fund_mode,
        fundPercent: data.personal_fund_percent,
        fundFixedAmount: data.personal_fund_fixed_amount,
        fundDay: data.personal_fund_day,
        fundSourceAccountId: data.personal_fund_source_account_id,
        autoOpenMonth: data.auto_open_month,
        strictMonthLock: data.strict_month_lock,
      }
    },
  })

export interface SettingsPatch {
  name?: string
  timezone?: string
  fundMode?: FundMode
  fundPercent?: number
  fundFixedAmount?: number
  fundDay?: number
  fundSourceAccountId?: string | null
  autoOpenMonth?: boolean
  strictMonthLock?: boolean
}

/** Faqat grant qilingan ustunlar (asosiy valyuta — E29 gacha o'zgarmaydi). */
export async function updateSettings(householdId: string, patch: SettingsPatch): Promise<void> {
  const { error } = await supabase
    .from('households')
    .update({
      name: patch.name,
      timezone: patch.timezone,
      personal_fund_mode: patch.fundMode,
      personal_fund_percent: patch.fundPercent,
      personal_fund_fixed_amount: patch.fundFixedAmount,
      personal_fund_day: patch.fundDay,
      personal_fund_source_account_id: patch.fundSourceAccountId,
      auto_open_month: patch.autoOpenMonth,
      strict_month_lock: patch.strictMonthLock,
    })
    .eq('id', householdId)
  if (error) throw toAppError(error)
}

const incomeSchema = z.object({ totals: z.object({ income: z.number() }) })

/** Fond ajratmasi preview'i uchun joriy oy daromadi (`report_month`). */
export const monthIncomeQuery = (householdId: string, month: string) =>
  queryOptions({
    queryKey: [...qk.household(householdId), 'month-income', month],
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase.rpc('report_month', {
        p_household: householdId,
        p_month: month,
      })
      if (error) throw toAppError(error)
      return incomeSchema.parse(data).totals.income
    },
  })

export interface Member {
  userId: string
  name: string
  role: Role
  joinedAt: string
}

export const membersKey = (householdId: string) =>
  [...qk.household(householdId), 'members'] as const

/**
 * A'zolar va ismlari — ikki so'rov (a'zolik va profil o'rtasida FK yo'q, embed
 * bo'lmaydi); profil RLS'i hamkor a'zolarni ko'rsatadi.
 */
export const membersQuery = (householdId: string) =>
  queryOptions({
    queryKey: membersKey(householdId),
    queryFn: async (): Promise<Member[]> => {
      const members = await supabase
        .from('household_members')
        .select('user_id, role, joined_at')
        .eq('household_id', householdId)
        .order('joined_at')
      if (members.error) throw toAppError(members.error)
      const profiles = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in(
          'user_id',
          members.data.map((m) => m.user_id),
        )
      if (profiles.error) throw toAppError(profiles.error)
      const nameOf = new Map(profiles.data.map((p) => [p.user_id, p.display_name]))
      return members.data.map((m) => ({
        userId: m.user_id,
        name: nameOf.get(m.user_id) ?? '',
        role: m.role,
        joinedAt: m.joined_at,
      }))
    },
  })

export interface Invite {
  code: string
  role: Role
  expiresAt: string
}

/** Faol takliflar (qabul qilinmagan, muddati o'tmagan) — owner/admin ko'radi. */
export const invitesQuery = (householdId: string) =>
  queryOptions({
    queryKey: [...membersKey(householdId), 'invites'],
    queryFn: async (): Promise<Invite[]> => {
      const { data, error } = await supabase
        .from('household_invites')
        .select('code, role, expires_at')
        .eq('household_id', householdId)
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('expires_at', { ascending: false })
      if (error) throw toAppError(error)
      return data.map((i) => ({ code: i.code, role: i.role, expiresAt: i.expires_at }))
    },
  })

/** BR-012: 8 belgili kod, 7 kun, bir martalik (rol — owner emas). */
export async function createInvite(householdId: string, role: Role): Promise<Invite> {
  const { data, error } = await supabase.rpc('create_invite', {
    p_household: householdId,
    p_role: role,
  })
  if (error) throw toAppError(error)
  const invite = data.at(0)
  if (!invite) throw toAppError({ message: 'unknown' })
  return { code: invite.code, role, expiresAt: invite.expires_at }
}

export async function setMemberRole(
  householdId: string,
  userId: string,
  role: Role,
): Promise<void> {
  const { error } = await supabase.rpc('set_member_role', {
    p_household: householdId,
    p_user: userId,
    p_role: role,
  })
  if (error) throw toAppError(error)
}

export async function removeMember(householdId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_member', {
    p_household: householdId,
    p_user: userId,
  })
  if (error) throw toAppError(error)
}

/** BR-014: egalik boshqa a'zoga o'tadi (joriy owner — admin bo'ladi). */
export async function transferOwnership(householdId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('transfer_ownership', {
    p_household: householdId,
    p_new_owner: userId,
  })
  if (error) throw toAppError(error)
}

/** Oxirgi owner chiqa olmaydi (`last_owner`) — avval egalikni o'tkazadi. */
export async function leaveHousehold(householdId: string): Promise<void> {
  const { error } = await supabase.rpc('leave_household', { p_household: householdId })
  if (error) throw toAppError(error)
}

/** Xavfli zona (BR-014): faqat owner, tasdiq — byudjet nomi. */
export async function deleteHousehold(householdId: string, confirmName: string): Promise<void> {
  const { error } = await supabase.rpc('delete_household', {
    p_household: householdId,
    p_confirm_name: confirmName,
  })
  if (error) throw toAppError(error)
}
