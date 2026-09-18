/**
 * Query-key fabrikasi. Hamma kalit byudjet (household) doirasida — byudjet
 * almashganda yoki yozuvdan keyin faqat tegishli qism invalidatsiya qilinadi.
 *
 * @example [...qk.household(id), 'transactions', filters]
 */
export const qk = {
  bootstrap: () => ['bootstrap'] as const,
  household: (householdId: string) => ['household', householdId] as const,
}
