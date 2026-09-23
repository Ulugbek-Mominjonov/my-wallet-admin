/**
 * Query-key fabrikasi. Hamma kalit byudjet (household) doirasida — byudjet
 * almashganda yoki yozuvdan keyin faqat tegishli qism invalidatsiya qilinadi.
 *
 * @example [...qk.household(id), 'transactions', filters]
 */
export const qk = {
  bootstrap: () => ['bootstrap'] as const,
  /** Sessiyaga bog'liq hamma narsa (2FA tasdiqlangach birga yangilanadi). */
  auth: () => ['auth'] as const,
  mfaFactors: () => ['auth', 'mfa-factors'] as const,
  session: () => ['auth', 'session'] as const,
  household: (householdId: string) => ['household', householdId] as const,
}

/**
 * Pul harakati (amal, to'lov) o'zgartiradigan keshlar (E24-T07). Kalit
 * bo'laklari shu yerda — invalidatsiya ro'yxati va feature'lardagi
 * fabrikalar bir manbadan.
 */
export const MONEY_KEYS = [
  'transactions',
  'plans',
  'months',
  'accounts',
  'reports',
  'limits',
  'debts',
  'goals',
] as const

export type MoneyKey = (typeof MONEY_KEYS)[number]

/** Byudjet ichidagi bo'lim kaliti: `qk.part(id, 'reports')`. */
export const part = (householdId: string, name: MoneyKey) =>
  [...qk.household(householdId), name] as const
