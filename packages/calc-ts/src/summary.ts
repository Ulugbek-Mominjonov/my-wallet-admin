import type {
  CategorySplit,
  Expense,
  Income,
  MethodSplit,
  MonthKey,
  MonthSummary,
  OverallTotals,
  PersonalSpend,
} from './types.js';
import { normalizeKey } from './types.js';

/**
 * Agregatni XOM YOZUVLARDAN noldan hisoblaydi (`hammaXulosalar_` ning
 * davomi). Delta hisobidan MUSTAQIL — reconciler shu ikkisini
 * solishtiradi (§5.5).
 */
export const emptySummary = (monthKey: MonthKey): MonthSummary => ({
  monthKey,
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
  closed: false,
});

export interface BuildSummaryInput {
  readonly monthKey: MonthKey;
  readonly personalCategoryKey: string;
  readonly incomes?: readonly Income[];
  readonly expenses?: readonly Expense[];
  readonly personalSpends?: readonly PersonalSpend[];
  readonly closed?: boolean;
}

export const buildMonthSummary = ({
  monthKey,
  personalCategoryKey,
  incomes = [],
  expenses = [],
  personalSpends = [],
  closed = false,
}: BuildSummaryInput): MonthSummary => {
  const summary = { ...emptySummary(monthKey), closed };
  const byType: Record<string, MethodSplit> = {};
  const byCategory: Record<string, CategorySplit> = {};

  for (const income of incomes) {
    if (income.monthKey !== monthKey) continue;
    summary.income += income.amount;
    const isCard = income.method === 'card';
    if (isCard) summary.incomeCard += income.amount;
    else summary.incomeCash += income.amount;

    const current = byType[income.type] ?? { card: 0, cash: 0 };
    byType[income.type] = {
      card: current.card + (isCard ? income.amount : 0),
      cash: current.cash + (isCard ? 0 : income.amount),
    };
  }

  for (const expense of expenses) {
    if (expense.monthKey !== monthKey) continue;
    const actual = expense.actual ?? 0;
    const planned = expense.planned ?? 0;
    summary.planned += planned;

    if (actual > 0) {
      summary.expense += actual;
      if (expense.method === 'card') summary.expenseCard += actual;
      else summary.expenseCash += actual;
      if (normalizeKey(expense.category) === personalCategoryKey) {
        summary.personalAllocated += actual;
      }
    } else {
      summary.unpaidTotal += planned;
      if (expense.planned === null) summary.unknownCount += 1;
    }

    const current = byCategory[expense.category] ?? { planned: 0, actual: 0 };
    byCategory[expense.category] = {
      planned: current.planned + planned,
      actual: current.actual + actual,
    };
  }

  for (const spend of personalSpends) {
    if (spend.monthKey !== monthKey) continue;
    summary.personalSpent += spend.amount;
  }

  // Nol qiymatli kesimlar saqlanmaydi — delta bilan bir xil bo'lishi uchun.
  summary.byType = Object.fromEntries(
    Object.entries(byType).filter(
      ([, value]) => value.card !== 0 || value.cash !== 0,
    ),
  );
  summary.byCategory = Object.fromEntries(
    Object.entries(byCategory).filter(
      ([, value]) => value.planned !== 0 || value.actual !== 0,
    ),
  );

  return summary;
};

/** §2.3 — hosila qiymatlar; ular SAQLANMAYDI. */
export const balanceOf = (summary: MonthSummary): number =>
  summary.income - summary.expense;

export const forecastOf = (summary: MonthSummary): number =>
  balanceOf(summary) - summary.unpaidTotal;

export const cardOf = (summary: MonthSummary): number =>
  summary.incomeCard - summary.expenseCard;

export const cashOf = (summary: MonthSummary): number =>
  summary.incomeCash - summary.expenseCash;

/** Orttirgan = qoldiq + ajratma − shaxsiy sarf. */
export const savedOf = (summary: MonthSummary): number =>
  balanceOf(summary) + summary.personalAllocated - summary.personalSpent;

export const savedRatioOf = (summary: MonthSummary): number =>
  summary.income > 0 ? savedOf(summary) / summary.income : 0;

export const totalsOf = (
  months: readonly MonthSummary[],
): OverallTotals =>
  months.reduce<OverallTotals>(
    (total, month) => ({
      income: total.income + month.income,
      expense: total.expense + month.expense,
      personalAllocated: total.personalAllocated + month.personalAllocated,
      personalSpent: total.personalSpent + month.personalSpent,
    }),
    { income: 0, expense: 0, personalAllocated: 0, personalSpent: 0 },
  );

/** 🏦 jamg'arma = Σ(oylik qoldiq) — alohida saqlanmaydi. */
export const savingsOf = (totals: OverallTotals): number =>
  totals.income - totals.expense;

/** 👤 shaxsiy fond qoldig'i — 🏦 bilan HECH QACHON qo'shilmaydi. */
export const personalBalanceOf = (totals: OverallTotals): number =>
  totals.personalAllocated - totals.personalSpent;

/** Fixture bilan solishtirish uchun barqaror ko'rinish. */
export const summaryToWire = (summary: MonthSummary): unknown => ({
  monthKey: summary.monthKey,
  income: summary.income,
  incomeCard: summary.incomeCard,
  incomeCash: summary.incomeCash,
  expense: summary.expense,
  expenseCard: summary.expenseCard,
  expenseCash: summary.expenseCash,
  planned: summary.planned,
  unpaidTotal: summary.unpaidTotal,
  unknownCount: summary.unknownCount,
  personalAllocated: summary.personalAllocated,
  personalSpent: summary.personalSpent,
  byType: Object.fromEntries(
    Object.keys(summary.byType)
      .sort()
      .map((key) => [
        key,
        { card: summary.byType[key]!.card, cash: summary.byType[key]!.cash },
      ]),
  ),
  byCategory: Object.fromEntries(
    Object.keys(summary.byCategory)
      .sort()
      .map((key) => [
        key,
        {
          planned: summary.byCategory[key]!.planned,
          actual: summary.byCategory[key]!.actual,
        },
      ]),
  ),
  balance: balanceOf(summary),
  forecast: forecastOf(summary),
  card: cardOf(summary),
  cash: cashOf(summary),
  saved: savedOf(summary),
});
