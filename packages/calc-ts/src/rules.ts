import { dateOnly, monthKeyOfDateString, parseDate, shiftMonth } from './monthKey.js';
import type {
  Debt,
  Expense,
  Goal,
  IncomeRule,
  MonthKey,
  MonthSummary,
  OverallTotals,
  PaymentStatus,
} from './types.js';
import { normalizeKey } from './types.js';
import { balanceOf, savedOf } from './summary.js';

/** §2.1 — daromadning tegishli oyi. */
export const incomeMonthKey = (
  paidAt: string,
  type: string,
  rules: readonly IncomeRule[],
): MonthKey => {
  const key = normalizeKey(type);
  const rule = rules.find((item) => normalizeKey(item.type) === key);
  return shiftMonth(monthKeyOfDateString(paidAt), rule?.shift ?? 0);
};

/** §2.2 — xarajatning tegishli oyi. */
export const expenseMonthKey = (
  dueDate: string,
  manualMonth?: MonthKey | null,
): MonthKey => manualMonth ?? monthKeyOfDateString(dueDate);

/** §2.6 — to'lov holati. */
export const paymentStatus = (
  planned: number | null,
  actual: number | null,
  dueDate: string,
  today: Date,
): PaymentStatus => {
  if ((actual ?? 0) > 0) return 'paid';
  if (planned !== null && planned <= 0) return 'none';
  return dateOnly(parseDate(dueDate)) < dateOnly(today) ? 'overdue' : 'pending';
};

/** Avto to'lov sharti. */
export const shouldAutoPay = (expense: Expense, today: Date): boolean =>
  expense.autoPay === true &&
  (expense.actual ?? 0) <= 0 &&
  (expense.planned ?? 0) > 0 &&
  dateOnly(parseDate(expense.dueDate)) <= dateOnly(today);

/** §2.10 — "O'zim uchun" rejasi (yaxlitlash BIR MARTA). */
export const personalFundPlan = (
  monthIncome: number,
  mode: 'percent' | 'fixed',
  value: number,
): number => {
  if (mode === 'fixed') return value;
  if (monthIncome <= 0 || value <= 0) return 0;
  return Math.round((monthIncome * value) / 100 / 1000) * 1000;
};

export interface DebtView {
  readonly debt: Debt;
  readonly applied: number;
  readonly paid: number;
  readonly remaining: number;
  readonly monthsLeft: number;
  readonly finishMonth: MonthKey | null;
}

/** §2.7 — qarz hisobi. */
export const debtView = (debt: Debt, today: Date): DebtView => {
  const applied =
    debt.direction === 'owedToMe' ? debt.paidFromIncomes : debt.paidFromExpenses;
  const remaining = Math.max(0, debt.total - debt.paidBefore - applied);
  const monthsLeft =
    debt.monthly > 0 && remaining > 0 ? Math.ceil(remaining / debt.monthly) : 0;
  return {
    debt,
    applied,
    paid: debt.paidBefore + applied,
    remaining,
    monthsLeft,
    finishMonth:
      monthsLeft > 0
        ? shiftMonth(
            `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`,
            monthsLeft,
          )
        : null,
  };
};

export interface GoalView {
  readonly goal: Goal;
  readonly remaining: number;
  readonly progress: number;
  readonly perMonth: number;
  readonly monthsLeft: number;
}

/** §2.8 — maqsad hisobi. */
export const goalView = (goal: Goal, averageSaved: number): GoalView => {
  const remaining = Math.max(0, goal.target - goal.saved);
  const progress = goal.target > 0 ? Math.min(1, goal.saved / goal.target) : 0;
  const perMonth = goal.monthly ?? averageSaved;
  return {
    goal,
    remaining,
    progress,
    perMonth,
    monthsLeft:
      remaining > 0 && perMonth > 0 ? Math.ceil(remaining / perMonth) : 0,
  };
};

export interface Forecast {
  readonly isCurrentMonth: boolean;
  readonly daysPassed: number;
  readonly daysInMonth: number;
  readonly dailyBurn: number;
  readonly monthEndSpend: number;
  readonly expectedIncome: number;
  readonly monthEndBalance: number;
  readonly averageExpense: number;
}

/** §2.9 — oy oxirigacha prognoz. */
export const forecast = (
  month: MonthSummary,
  totals: OverallTotals,
  monthCount: number,
  today: Date,
  daysInMonthValue: number,
): Forecast => {
  const currentKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const isCurrent = month.monthKey === currentKey;
  const daysPassed = isCurrent
    ? Math.min(Math.max(today.getDate(), 1), daysInMonthValue)
    : daysInMonthValue;
  const dailyRate = daysPassed > 0 ? month.expense / daysPassed : 0;
  const monthEndSpend = isCurrent
    ? Math.round(dailyRate * daysInMonthValue)
    : month.expense;
  const otherMonths = Math.max(0, monthCount - (isCurrent ? 1 : 0));
  const averageIncome =
    otherMonths > 0
      ? Math.round((totals.income - (isCurrent ? month.income : 0)) / otherMonths)
      : 0;
  const expectedIncome = isCurrent
    ? Math.max(month.income, averageIncome)
    : month.income;
  return {
    isCurrentMonth: isCurrent,
    daysPassed,
    daysInMonth: daysInMonthValue,
    dailyBurn: Math.round(dailyRate),
    monthEndSpend,
    expectedIncome,
    monthEndBalance: expectedIncome - monthEndSpend,
    averageExpense: monthCount > 0 ? Math.round(totals.expense / monthCount) : 0,
  };
};

/** §2.5 — jamg'armaning xronologik to'planishi. */
export interface SavingsPoint {
  readonly monthKey: MonthKey;
  readonly balance: number;
  readonly saved: number;
  readonly cumulative: number;
}

export const savingsSeries = (
  months: readonly MonthSummary[],
): { points: SavingsPoint[]; total: number; averageSaved: number } => {
  const sorted = [...months].sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  let cumulative = 0;
  let totalSaved = 0;
  const points = sorted.map((month) => {
    cumulative += balanceOf(month);
    totalSaved += savedOf(month);
    return {
      monthKey: month.monthKey,
      balance: balanceOf(month),
      saved: savedOf(month),
      cumulative,
    };
  });
  return {
    points,
    total: cumulative,
    averageSaved: points.length > 0 ? Math.round(totalSaved / points.length) : 0,
  };
};

/** Kunlik eslatma guruhlari. */
export interface ReminderBuckets {
  readonly overdue: Expense[];
  readonly dueToday: Expense[];
  readonly upcoming: Expense[];
}

export const reminderBuckets = (
  expenses: readonly Expense[],
  today: Date,
  daysAhead: number,
): ReminderBuckets => {
  const start = dateOnly(today);
  const limit = new Date(start.getTime() + daysAhead * 86400000);
  const overdue: Expense[] = [];
  const dueToday: Expense[] = [];
  const upcoming: Expense[] = [];

  for (const expense of expenses) {
    if ((expense.actual ?? 0) > 0) continue;
    if (expense.planned !== null && expense.planned <= 0) continue;
    const due = dateOnly(parseDate(expense.dueDate));
    if (due < start) overdue.push(expense);
    else if (due.getTime() === start.getTime()) dueToday.push(expense);
    else if (due <= limit) upcoming.push(expense);
  }

  const byDate = (a: Expense, b: Expense): number =>
    a.dueDate.localeCompare(b.dueDate);
  return {
    overdue: overdue.sort(byDate),
    dueToday: dueToday.sort(byDate),
    upcoming: upcoming.sort(byDate),
  };
};
