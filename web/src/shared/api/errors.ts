import { isAuthError, isAuthRetryableFetchError } from '@supabase/supabase-js'
import type { ParseKeys } from 'i18next'

import { i18n } from '@/shared/i18n'

/** Foydalanuvchiga ko'rsatiladigan xato: aniq kod va tushunarli matn. */
export class AppError extends Error {
  readonly code: string

  constructor(code: string, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'AppError'
    this.code = code
  }
}

interface PostgrestLikeError {
  code?: string
  message: string
  status?: number
}

const isPostgrestLike = (value: unknown): value is PostgrestLikeError =>
  typeof value === 'object' && value !== null && 'message' in value

/** GoTrue (Auth) kodlari → foydalanuvchi matni (E21). */
const AUTH_ERRORS: Record<string, { code: string; key: ParseKeys }> = {
  otp_expired: { code: 'code_invalid', key: 'auth.errors.codeInvalid' },
  over_email_send_rate_limit: { code: 'rate_limited', key: 'auth.errors.rateLimited' },
  over_request_rate_limit: { code: 'rate_limited', key: 'auth.errors.rateLimited' },
  email_address_invalid: { code: 'email_invalid', key: 'auth.errors.emailInvalid' },
  validation_failed: { code: 'email_invalid', key: 'auth.errors.emailInvalid' },
  mfa_verification_failed: { code: 'mfa_failed', key: 'auth.errors.mfaFailed' },
  mfa_challenge_expired: { code: 'mfa_failed', key: 'auth.errors.mfaFailed' },
  insufficient_aal: { code: 'mfa_required', key: 'auth.errors.mfaRequired' },
  session_not_found: { code: 'unauthorized', key: 'errors.unauthorized' },
  session_expired: { code: 'unauthorized', key: 'errors.unauthorized' },
  refresh_token_not_found: { code: 'unauthorized', key: 'errors.unauthorized' },
  refresh_token_already_used: { code: 'unauthorized', key: 'errors.unauthorized' },
}

/**
 * Biznes xatolar (`P0001`, `message` = kod — contracts/api.md) → matn.
 * Sahifalar kerakli kodlarni shu yerga qo'shadi; noma'lumi — umumiy matn.
 */
const BUSINESS_ERRORS: Record<string, ParseKeys> = {
  forbidden: 'errors.forbidden',
  unauthorized: 'errors.unauthorized',
  invalid_name: 'household.errors.name',
  invite_not_found: 'household.errors.notFound',
  invite_used: 'household.errors.used',
  invite_expired: 'household.errors.expired',
  already_member: 'household.errors.member',
  account_in_use: 'directories.errors.accountInUse',
  system_account: 'directories.errors.systemAccount',
  account_currency_locked: 'directories.errors.currencyLocked',
  system_category: 'directories.errors.systemCategory',
  category_in_use: 'directories.errors.categoryInUse',
  invalid_parent: 'directories.errors.invalidParent',
  category_kind_mismatch: 'directories.errors.kindMismatch',
  month_shift_mismatch: 'directories.errors.monthShiftMismatch',
  preview_outdated: 'directories.errors.previewOutdated',
  debt_in_use: 'directories.errors.debtInUse',
  currency_mismatch: 'directories.errors.currencyMismatch',
  last_owner: 'directories.errors.lastOwner',
  use_transfer_ownership: 'directories.errors.useTransfer',
  use_leave_household: 'directories.errors.useLeave',
  confirm_mismatch: 'directories.errors.confirmMismatch',
  not_member: 'directories.errors.notMember',
  invalid_role: 'directories.errors.invalidRole',
  account_deleted: 'transactions.errors.accountDeleted',
  category_deleted: 'transactions.errors.categoryDeleted',
  invalid_account: 'transactions.errors.invalidAccount',
  planned_deleted: 'transactions.errors.plannedDeleted',
  planned_skipped: 'transactions.errors.plannedSkipped',
  planned_kind_mismatch: 'transactions.errors.plannedKindMismatch',
  debt_deleted: 'transactions.errors.debtDeleted',
  debt_kind_mismatch: 'transactions.errors.debtKindMismatch',
  to_amount_required: 'transactions.errors.toAmountRequired',
  fx_rate_missing: 'transactions.errors.fxRateMissing',
  month_closed: 'transactions.errors.monthClosed',
  tag_deleted: 'transactions.errors.tagDeleted',
  transaction_not_found: 'transactions.errors.notFound',
  // Ommaviy amal natijasi: qator topilmadi (boshqa byudjet yoki o'chirilgan).
  not_found: 'transactions.errors.notFound',
  planned_not_found: 'plans.errors.notFound',
  planned_already_paid: 'plans.errors.alreadyPaid',
  amount_required: 'plans.errors.amountRequired',
  invalid_amount: 'plans.errors.invalidAmount',
  account_required: 'plans.errors.accountRequired',
  account_not_found: 'plans.errors.accountNotFound',
  month_not_finished: 'plans.errors.monthNotFinished',
}

/** Biznes kod (xato yoki ommaviy amal natijasidagi `reason`) → foydalanuvchi matni. */
export const businessErrorMessage = (code: string): string =>
  i18n.t(BUSINESS_ERRORS[code] ?? 'errors.unknown')

/**
 * Ommaviy amalda o'tkazib yuborilganlar — sabab bo'yicha soni bilan:
 * "Oy yopilgan… (2); Amal topilmadi… (1)". Sahifa o'z sabab kodlarini beradi.
 */
export function skippedSummary(
  skipped: readonly { reason: string }[],
  messageOf: (reason: string) => string = businessErrorMessage,
): string {
  const counts = new Map<string, number>()
  for (const { reason } of skipped) counts.set(reason, (counts.get(reason) ?? 0) + 1)
  return [...counts].map(([reason, n]) => `${messageOf(reason)} (${String(n)})`).join('; ')
}

/** Supabase/tarmoq xatosini AppError'ga aylantiradi. */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error
  if (error instanceof TypeError || isAuthRetryableFetchError(error)) {
    return new AppError('network', i18n.t('errors.network'), { cause: error })
  }
  if (isAuthError(error)) {
    const known = AUTH_ERRORS[error.code ?? '']
    return known
      ? new AppError(known.code, i18n.t(known.key), { cause: error })
      : new AppError('auth', i18n.t('errors.unknown'), { cause: error })
  }
  if (isPostgrestLike(error)) {
    if (error.code === 'P0001') {
      return new AppError(error.message, businessErrorMessage(error.message), { cause: error })
    }
    // Nom band (masalan `accounts_name_key` — byudjet ichida registrsiz, BR-003).
    if (error.code === '23505') {
      return new AppError('name_taken', i18n.t('errors.nameTaken'), { cause: error })
    }
    if (error.status === 401 || error.code === 'PGRST301') {
      return new AppError('unauthorized', i18n.t('errors.unauthorized'), { cause: error })
    }
    if (error.status === 403 || error.code === '42501') {
      return new AppError('forbidden', i18n.t('errors.forbidden'), { cause: error })
    }
    return new AppError(error.code ?? 'unknown', error.message, { cause: error })
  }
  return new AppError('unknown', i18n.t('errors.unknown'), { cause: error })
}

/** Rol yoki a'zolik yetarli emas — marshrut himoyasi (E21-T03) 403 sahifasini ko'rsatadi. */
export const forbiddenError = (): AppError => new AppError('forbidden', i18n.t('errors.forbidden'))

/** Qayta urinish ma'noga ega emas: huquq/sessiya/validatsiya xatolari. */
export const isRetryable = (error: unknown): boolean =>
  !['unauthorized', 'forbidden'].includes(toAppError(error).code)
