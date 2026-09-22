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
