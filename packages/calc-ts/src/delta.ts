import type {
  CategorySplit,
  Expense,
  Income,
  MethodSplit,
  MonthKey,
  MonthSummary,
  PersonalSpend,
} from './types.js';
import { normalizeKey } from './types.js';

/**
 * ★ §5.2 — agregatni delta bilan yangilash (Dart portining aynan o'zi).
 *
 * Asosiy g'oya bir xil: har yozuvning agregatga "hissasi" hisoblanadi,
 * delta esa `hissa(after) − hissa(before)`. Shu sababli qo'shish /
 * tahrirlash / o'chirish uchun alohida mantiq YO'Q.
 *
 * Natija `toIncrements()` bilan Firestore ko'rinishiga aylanadi: barg
 * qiymatlar butun son, ichma-ich map (nuqtali field path ISHLATILMAYDI —
 * kategoriya nomida nuqta bo'lsa yo'l buzilardi).
 */

export interface MonthDelta {
  income: number;
  incomeCard: number;
  incomeCash: number;
  expense: number;
  expenseCard: number;
  expenseCash: number;
  planned: number;
  unpaidTotal: number;
  unknownCount: number;
  personalAllocated: number;
  personalSpent: number;
  byType: Record<string, MethodSplit>;
  byCategory: Record<string, CategorySplit>;
}

export interface TotalsDelta {
  income: number;
  expense: number;
  personalAllocated: number;
  personalSpent: number;
}

export interface DebtDelta {
  fromExpenses: number;
  fromIncomes: number;
  pending: number;
}

export interface AggregateDelta {
  months: Record<MonthKey, MonthDelta>;
  totals: TotalsDelta;
  debts: Record<string, DebtDelta>;
}

export const emptyMonthDelta = (): MonthDelta => ({
  income: 0,
  incomeCard: 0,
  incomeCash: 0,
  expense: 0,
  expenseCard: 0,
  expenseCash: 0,
  planned: 0,
  unpaidTotal: 0,
  unknownCount: 0,
  personalAllocated: 0,
  personalSpent: 0,
  byType: {},
  byCategory: {},
});

export const emptyTotalsDelta = (): TotalsDelta => ({
  income: 0,
  expense: 0,
  personalAllocated: 0,
  personalSpent: 0,
});

export const emptyDelta = (): AggregateDelta => ({
  months: {},
  totals: emptyTotalsDelta(),
  debts: {},
});

const isMonthDeltaEmpty = (delta: MonthDelta): boolean =>
  delta.income === 0 &&
  delta.incomeCard === 0 &&
  delta.incomeCash === 0 &&
  delta.expense === 0 &&
  delta.expenseCard === 0 &&
  delta.expenseCash === 0 &&
  delta.planned === 0 &&
  delta.unpaidTotal === 0 &&
  delta.unknownCount === 0 &&
  delta.personalAllocated === 0 &&
  delta.personalSpent === 0 &&
  Object.keys(delta.byType).length === 0 &&
  Object.keys(delta.byCategory).length === 0;

const isDebtDeltaEmpty = (delta: DebtDelta): boolean =>
  delta.fromExpenses === 0 && delta.fromIncomes === 0 && delta.pending === 0;

export const isTotalsDeltaEmpty = (delta: TotalsDelta): boolean =>
  delta.income === 0 &&
  delta.expense === 0 &&
  delta.personalAllocated === 0 &&
  delta.personalSpent === 0;

export const isDeltaEmpty = (delta: AggregateDelta): boolean =>
  Object.keys(delta.months).length === 0 &&
  isTotalsDeltaEmpty(delta.totals) &&
  Object.keys(delta.debts).length === 0;

/** Nechta agregat hujjat yoziladi (batch chegarasini hisoblash uchun). */
export const deltaDocumentCount = (delta: AggregateDelta): number =>
  Object.keys(delta.months).length +
  (isTotalsDeltaEmpty(delta.totals) ? 0 : 1) +
  Object.keys(delta.debts).length;

const addSplitMaps = <T extends MethodSplit | CategorySplit>(
  a: Record<string, T>,
  b: Record<string, T>,
  add: (x: T, y: T) => T,
  isZero: (value: T) => boolean,
): Record<string, T> => {
  const result: Record<string, T> = {};
  for (const [key, value] of Object.entries(a)) {
    if (!isZero(value)) result[key] = value;
  }
  for (const [key, value] of Object.entries(b)) {
    const existing = result[key];
    const sum = existing ? add(existing, value) : value;
    if (isZero(sum)) delete result[key];
    else result[key] = sum;
  }
  return result;
};

const addMethod = (a: MethodSplit, b: MethodSplit): MethodSplit => ({
  card: a.card + b.card,
  cash: a.cash + b.cash,
});

const addCategory = (a: CategorySplit, b: CategorySplit): CategorySplit => ({
  planned: a.planned + b.planned,
  actual: a.actual + b.actual,
});

const zeroMethod = (value: MethodSplit): boolean =>
  value.card === 0 && value.cash === 0;

const zeroCategory = (value: CategorySplit): boolean =>
  value.planned === 0 && value.actual === 0;

export const addMonthDelta = (a: MonthDelta, b: MonthDelta): MonthDelta => ({
  income: a.income + b.income,
  incomeCard: a.incomeCard + b.incomeCard,
  incomeCash: a.incomeCash + b.incomeCash,
  expense: a.expense + b.expense,
  expenseCard: a.expenseCard + b.expenseCard,
  expenseCash: a.expenseCash + b.expenseCash,
  planned: a.planned + b.planned,
  unpaidTotal: a.unpaidTotal + b.unpaidTotal,
  unknownCount: a.unknownCount + b.unknownCount,
  personalAllocated: a.personalAllocated + b.personalAllocated,
  personalSpent: a.personalSpent + b.personalSpent,
  byType: addSplitMaps(a.byType, b.byType, addMethod, zeroMethod),
  byCategory: addSplitMaps(
    a.byCategory,
    b.byCategory,
    addCategory,
    zeroCategory,
  ),
});

const negateMonthDelta = (delta: MonthDelta): MonthDelta => ({
  income: -delta.income,
  incomeCard: -delta.incomeCard,
  incomeCash: -delta.incomeCash,
  expense: -delta.expense,
  expenseCard: -delta.expenseCard,
  expenseCash: -delta.expenseCash,
  planned: -delta.planned,
  unpaidTotal: -delta.unpaidTotal,
  unknownCount: -delta.unknownCount,
  personalAllocated: -delta.personalAllocated,
  personalSpent: -delta.personalSpent,
  byType: Object.fromEntries(
    Object.entries(delta.byType).map(([key, value]) => [
      key,
      { card: -value.card, cash: -value.cash },
    ]),
  ),
  byCategory: Object.fromEntries(
    Object.entries(delta.byCategory).map(([key, value]) => [
      key,
      { planned: -value.planned, actual: -value.actual },
    ]),
  ),
});

export const addDelta = (
  a: AggregateDelta,
  b: AggregateDelta,
): AggregateDelta => {
  const months: Record<MonthKey, MonthDelta> = { ...a.months };
  for (const [key, value] of Object.entries(b.months)) {
    const sum = addMonthDelta(months[key] ?? emptyMonthDelta(), value);
    if (isMonthDeltaEmpty(sum)) delete months[key];
    else months[key] = sum;
  }

  const debts: Record<string, DebtDelta> = { ...a.debts };
  for (const [key, value] of Object.entries(b.debts)) {
    const existing = debts[key] ?? { fromExpenses: 0, fromIncomes: 0, pending: 0 };
    const sum: DebtDelta = {
      fromExpenses: existing.fromExpenses + value.fromExpenses,
      fromIncomes: existing.fromIncomes + value.fromIncomes,
      pending: existing.pending + value.pending,
    };
    if (isDebtDeltaEmpty(sum)) delete debts[key];
    else debts[key] = sum;
  }

  return {
    months,
    totals: {
      income: a.totals.income + b.totals.income,
      expense: a.totals.expense + b.totals.expense,
      personalAllocated:
        a.totals.personalAllocated + b.totals.personalAllocated,
      personalSpent: a.totals.personalSpent + b.totals.personalSpent,
    },
    debts,
  };
};

export const negateDelta = (delta: AggregateDelta): AggregateDelta => ({
  months: Object.fromEntries(
    Object.entries(delta.months).map(([key, value]) => [
      key,
      negateMonthDelta(value),
    ]),
  ),
  totals: {
    income: -delta.totals.income,
    expense: -delta.totals.expense,
    personalAllocated: -delta.totals.personalAllocated,
    personalSpent: -delta.totals.personalSpent,
  },
  debts: Object.fromEntries(
    Object.entries(delta.debts).map(([key, value]) => [
      key,
      {
        fromExpenses: -value.fromExpenses,
        fromIncomes: -value.fromIncomes,
        pending: -value.pending,
      },
    ]),
  ),
});

export const mergeDeltas = (deltas: readonly AggregateDelta[]): AggregateDelta =>
  deltas.reduce<AggregateDelta>((total, delta) => addDelta(total, delta), emptyDelta());

// ───────────────────────── Hissalar ─────────────────────────

const incomeContribution = (income: Income | null): AggregateDelta => {
  if (!income) return emptyDelta();
  const isCard = income.method === 'card';
  const split: MethodSplit = {
    card: isCard ? income.amount : 0,
    cash: isCard ? 0 : income.amount,
  };
  return {
    months: {
      [income.monthKey]: {
        ...emptyMonthDelta(),
        income: income.amount,
        incomeCard: split.card,
        incomeCash: split.cash,
        byType: { [income.type]: split },
      },
    },
    totals: { ...emptyTotalsDelta(), income: income.amount },
    debts: income.debtId
      ? {
          [income.debtId]: {
            fromExpenses: 0,
            fromIncomes: income.amount,
            pending: 0,
          },
        }
      : {},
  };
};

const expenseContribution = (
  expense: Expense | null,
  personalCategoryKey: string,
): AggregateDelta => {
  if (!expense) return emptyDelta();
  const actual = expense.actual ?? 0;
  const planned = expense.planned ?? 0;
  const isPaid = actual > 0;
  const isCard = expense.method === 'card';
  const isPersonal = normalizeKey(expense.category) === personalCategoryKey;

  return {
    months: {
      [expense.monthKey]: {
        ...emptyMonthDelta(),
        expense: actual,
        expenseCard: isCard ? actual : 0,
        expenseCash: isCard ? 0 : actual,
        planned,
        unpaidTotal: isPaid ? 0 : planned,
        unknownCount: !isPaid && expense.planned === null ? 1 : 0,
        personalAllocated: isPersonal ? actual : 0,
        byCategory: { [expense.category]: { planned, actual } },
      },
    },
    totals: {
      ...emptyTotalsDelta(),
      expense: actual,
      personalAllocated: isPersonal ? actual : 0,
    },
    debts: expense.debtId
      ? {
          [expense.debtId]: {
            fromExpenses: isPaid ? actual : 0,
            fromIncomes: 0,
            pending: isPaid ? 0 : planned,
          },
        }
      : {},
  };
};

const personalSpendContribution = (
  spend: PersonalSpend | null,
): AggregateDelta => {
  if (!spend) return emptyDelta();
  return {
    months: {
      [spend.monthKey]: { ...emptyMonthDelta(), personalSpent: spend.amount },
    },
    totals: { ...emptyTotalsDelta(), personalSpent: spend.amount },
    debts: {},
  };
};

export const deltaForIncome = (
  before: Income | null,
  after: Income | null,
): AggregateDelta =>
  addDelta(incomeContribution(after), negateDelta(incomeContribution(before)));

export const deltaForExpense = (
  before: Expense | null,
  after: Expense | null,
  personalCategoryKey: string,
): AggregateDelta =>
  addDelta(
    expenseContribution(after, personalCategoryKey),
    negateDelta(expenseContribution(before, personalCategoryKey)),
  );

export const deltaForPersonalSpend = (
  before: PersonalSpend | null,
  after: PersonalSpend | null,
): AggregateDelta =>
  addDelta(
    personalSpendContribution(after),
    negateDelta(personalSpendContribution(before)),
  );

// ───────────────────── Firestore ko'rinishi ─────────────────────

type IncrementLeaf = number | Record<string, number>;

/** Faqat nolmas maydonlar — ortiqcha yozuv yo'q. */
export const monthDeltaToIncrements = (
  delta: MonthDelta,
): Record<string, IncrementLeaf> => {
  const result: Record<string, IncrementLeaf> = {};
  const put = (key: string, value: number): void => {
    if (value !== 0) result[key] = value;
  };
  put('income', delta.income);
  put('incomeCard', delta.incomeCard);
  put('incomeCash', delta.incomeCash);
  put('expense', delta.expense);
  put('expenseCard', delta.expenseCard);
  put('expenseCash', delta.expenseCash);
  put('planned', delta.planned);
  put('unpaidTotal', delta.unpaidTotal);
  put('unknownCount', delta.unknownCount);
  put('personalAllocated', delta.personalAllocated);
  put('personalSpent', delta.personalSpent);

  const types: Record<string, Record<string, number>> = {};
  for (const [key, value] of Object.entries(delta.byType)) {
    if (zeroMethod(value)) continue;
    const entry: Record<string, number> = {};
    if (value.card !== 0) entry.card = value.card;
    if (value.cash !== 0) entry.cash = value.cash;
    types[key] = entry;
  }
  if (Object.keys(types).length > 0) {
    result.byType = types as unknown as Record<string, number>;
  }

  const categories: Record<string, Record<string, number>> = {};
  for (const [key, value] of Object.entries(delta.byCategory)) {
    if (zeroCategory(value)) continue;
    const entry: Record<string, number> = {};
    if (value.planned !== 0) entry.planned = value.planned;
    if (value.actual !== 0) entry.actual = value.actual;
    categories[key] = entry;
  }
  if (Object.keys(categories).length > 0) {
    result.byCategory = categories as unknown as Record<string, number>;
  }

  return result;
};

export const totalsDeltaToIncrements = (
  delta: TotalsDelta,
): Record<string, number> => {
  const result: Record<string, number> = {};
  if (delta.income !== 0) result.income = delta.income;
  if (delta.expense !== 0) result.expense = delta.expense;
  if (delta.personalAllocated !== 0) {
    result.personalAllocated = delta.personalAllocated;
  }
  if (delta.personalSpent !== 0) result.personalSpent = delta.personalSpent;
  return result;
};

export const debtDeltaToIncrements = (
  delta: DebtDelta,
): Record<string, number> => {
  const result: Record<string, number> = {};
  if (delta.fromExpenses !== 0) result.paidFromExpenses = delta.fromExpenses;
  if (delta.fromIncomes !== 0) result.paidFromIncomes = delta.fromIncomes;
  if (delta.pending !== 0) result.pendingFromApp = delta.pending;
  return result;
};

/** Fixture bilan solishtirish uchun barqaror (saralangan) ko'rinish. */
export const deltaToWire = (delta: AggregateDelta): unknown => ({
  months: Object.fromEntries(
    Object.keys(delta.months)
      .sort()
      .map((key) => [key, monthDeltaToIncrements(delta.months[key]!)]),
  ),
  totals: totalsDeltaToIncrements(delta.totals),
  debts: Object.fromEntries(
    Object.keys(delta.debts)
      .sort()
      .map((key) => [key, debtDeltaToIncrements(delta.debts[key]!)]),
  ),
});

/** Deltani mavjud agregatga qo'llaydi (offline/optimistik yangilash). */
export const applyMonthDelta = (
  summary: MonthSummary,
  delta: MonthDelta,
): MonthSummary => ({
  ...summary,
  income: summary.income + delta.income,
  incomeCard: summary.incomeCard + delta.incomeCard,
  incomeCash: summary.incomeCash + delta.incomeCash,
  expense: summary.expense + delta.expense,
  expenseCard: summary.expenseCard + delta.expenseCard,
  expenseCash: summary.expenseCash + delta.expenseCash,
  planned: summary.planned + delta.planned,
  unpaidTotal: summary.unpaidTotal + delta.unpaidTotal,
  unknownCount: summary.unknownCount + delta.unknownCount,
  personalAllocated: summary.personalAllocated + delta.personalAllocated,
  personalSpent: summary.personalSpent + delta.personalSpent,
  byType: addSplitMaps(summary.byType, delta.byType, addMethod, zeroMethod),
  byCategory: addSplitMaps(
    summary.byCategory,
    delta.byCategory,
    addCategory,
    zeroCategory,
  ),
});
