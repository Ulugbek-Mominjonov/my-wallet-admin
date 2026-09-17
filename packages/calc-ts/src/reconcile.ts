import type { MonthSummary } from './types.js';

export interface FieldDrift {
  readonly field: string;
  readonly stored: number;
  readonly computed: number;
}

export interface MonthDrift {
  readonly monthKey: string;
  readonly fields: FieldDrift[];
}

/**
 * §5.5 — saqlangan agregatni noldan hisoblangani bilan solishtiradi.
 * Dart tomonidagi `ReconcileCalc.compare` bilan bir xil maydon nomlari.
 */
export const compareSummaries = (
  stored: MonthSummary,
  computed: MonthSummary,
): MonthDrift => {
  const fields: FieldDrift[] = [];
  const check = (field: string, a: number, b: number): void => {
    if (a !== b) fields.push({ field, stored: a, computed: b });
  };

  check('income', stored.income, computed.income);
  check('incomeCard', stored.incomeCard, computed.incomeCard);
  check('incomeCash', stored.incomeCash, computed.incomeCash);
  check('expense', stored.expense, computed.expense);
  check('expenseCard', stored.expenseCard, computed.expenseCard);
  check('expenseCash', stored.expenseCash, computed.expenseCash);
  check('planned', stored.planned, computed.planned);
  check('unpaidTotal', stored.unpaidTotal, computed.unpaidTotal);
  check('unknownCount', stored.unknownCount, computed.unknownCount);
  check(
    'personalAllocated',
    stored.personalAllocated,
    computed.personalAllocated,
  );
  check('personalSpent', stored.personalSpent, computed.personalSpent);

  const typeKeys = new Set([
    ...Object.keys(stored.byType),
    ...Object.keys(computed.byType),
  ]);
  for (const key of typeKeys) {
    const a = stored.byType[key] ?? { card: 0, cash: 0 };
    const b = computed.byType[key] ?? { card: 0, cash: 0 };
    check(`byType.${key}.card`, a.card, b.card);
    check(`byType.${key}.cash`, a.cash, b.cash);
  }

  const categoryKeys = new Set([
    ...Object.keys(stored.byCategory),
    ...Object.keys(computed.byCategory),
  ]);
  for (const key of categoryKeys) {
    const a = stored.byCategory[key] ?? { planned: 0, actual: 0 };
    const b = computed.byCategory[key] ?? { planned: 0, actual: 0 };
    check(`byCategory.${key}.planned`, a.planned, b.planned);
    check(`byCategory.${key}.actual`, a.actual, b.actual);
  }

  return { monthKey: computed.monthKey, fields };
};
