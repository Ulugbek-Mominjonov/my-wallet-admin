/**
 * Domen turlari — `packages/domain` (Dart) bilan BIR XIL sim formati.
 *
 * Bu fayl Dart tomonidagi `WireCodec` bilan juftlashadi: `testdata/`
 * ichidagi fixture'lar aynan shu shaklda yoziladi va ikkala platforma
 * ham aynan shu fayldan o'qiydi (§12.3).
 *
 * Pul HAR DOIM butun son (so'm) — `number` ishlatiladi, lekin hech qachon
 * kasr paydo bo'lmaydi: barcha amallar butun sonli.
 */

export type PaymentMethod = 'card' | 'cash';
export type PaymentStatus = 'paid' | 'pending' | 'overdue' | 'none';
export type MonthKeySource = 'auto' | 'manual';
export type DebtDirection = 'iOwe' | 'owedToMe';

/** `YYYY-MM`. */
export type MonthKey = string;

/** `YYYY-MM-DD` — JSON'da vaqt zonasi muammosi bo'lmasligi uchun. */
export type DateString = string;

export interface Income {
  readonly id: string;
  readonly amount: number;
  readonly type: string;
  readonly method: PaymentMethod;
  readonly paidAt: DateString;
  readonly monthKey: MonthKey;
  readonly debtId?: string | null;
}

export interface Expense {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly method: PaymentMethod;
  /** `null` — summasi noma'lum (aniq `0` dan farq qiladi). */
  readonly planned: number | null;
  /** `null` yoki `0` — to'lanmagan. */
  readonly actual: number | null;
  readonly dueDate: DateString;
  readonly monthKey: MonthKey;
  readonly monthKeySource?: MonthKeySource;
  readonly debtId?: string | null;
  readonly autoPay?: boolean;
  readonly status?: PaymentStatus;
}

export interface PersonalSpend {
  readonly id: string;
  readonly amount: number;
  readonly purpose: string;
  readonly method: PaymentMethod;
  readonly spentAt: DateString;
  readonly monthKey: MonthKey;
}

export interface Debt {
  readonly id: string;
  readonly name: string;
  readonly direction: DebtDirection;
  readonly total: number;
  readonly paidBefore: number;
  readonly monthly: number;
  readonly paidFromExpenses: number;
  readonly paidFromIncomes: number;
  readonly pendingFromApp: number;
  readonly archived?: boolean;
}

export interface Goal {
  readonly id: string;
  readonly name: string;
  readonly target: number;
  readonly saved: number;
  readonly monthly?: number | null;
  readonly deadline?: DateString | null;
}

export interface MethodSplit {
  readonly card: number;
  readonly cash: number;
}

export interface CategorySplit {
  readonly planned: number;
  readonly actual: number;
}

/** `months/{YYYY-MM}` hujjati. */
export interface MonthSummary {
  readonly monthKey: MonthKey;
  readonly income: number;
  readonly incomeCard: number;
  readonly incomeCash: number;
  readonly expense: number;
  readonly expenseCard: number;
  readonly expenseCash: number;
  readonly planned: number;
  readonly unpaidTotal: number;
  readonly unknownCount: number;
  readonly personalAllocated: number;
  readonly personalSpent: number;
  readonly byType: Record<string, MethodSplit>;
  readonly byCategory: Record<string, CategorySplit>;
  readonly closed?: boolean;
}

/** `meta/totals` hujjati. */
export interface OverallTotals {
  readonly income: number;
  readonly expense: number;
  readonly personalAllocated: number;
  readonly personalSpent: number;
}

export interface IncomeRule {
  readonly type: string;
  readonly shift: number;
}

export interface ReminderSettings {
  readonly daysAhead: number;
  readonly hour: number;
  readonly reportDay: number;
  readonly telegramEnabled: boolean;
  readonly monthlyEnabled: boolean;
  readonly pushEnabled: boolean;
}

/** "O'zim uchun" kategoriyasining standart kaliti. */
export const DEFAULT_PERSONAL_CATEGORY_KEY = "o'zim uchun";

/** `Code.gs` dagi `kalit_()` — trim + lowercase. */
export const normalizeKey = (value: unknown): string =>
  String(value ?? '').trim().toLowerCase();
