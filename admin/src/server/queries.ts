import 'server-only';

import {
  buildMonthSummary,
  emptySummary,
  savingsSeries,
  type Expense,
  type Income,
  type MonthSummary,
  type OverallTotals,
  type PersonalSpend,
} from '@byudjet/calc';
import { unstable_cache } from 'next/cache';
import type { DocumentData, QueryDocumentSnapshot } from 'firebase-admin/firestore';

import { refs } from '@/lib/firebase-admin';

/**
 * ★ §12.5 — admin panelda ham o'sha DB qoidalari:
 *
 * * agregat sahifalari XOM HUJJAT O'QIMAYDI — `months/*` va `meta/totals`
 *   yetarli;
 * * ro'yxatlar kursor bilan sahifalanadi (`offset` yo'q);
 * * natijalar teglar bilan keshlanadi, yozuvdan keyin faqat o'sha oy
 *   kesh tegi yangilanadi.
 */

export const monthTag = (uid: string, monthKey: string): string =>
  `${uid}:month:${monthKey}`;

export const listTag = (uid: string, name: string): string =>
  `${uid}:list:${name}`;

const toDateString = (value: unknown): string => {
  if (value && typeof value === 'object' && 'toDate' in value) {
    const date = (value as { toDate: () => Date }).toDate();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate(),
    ).padStart(2, '0')}`;
  }
  return typeof value === 'string' ? value : '1970-01-01';
};

const asExpense = (doc: QueryDocumentSnapshot<DocumentData>): Expense => {
  const data = doc.data();
  return {
    id: doc.id,
    name: String(data.name ?? ''),
    category: String(data.category ?? 'Boshqa'),
    method: data.method === 'card' ? 'card' : 'cash',
    planned: data.planned == null ? null : Number(data.planned),
    actual: data.actual == null ? null : Number(data.actual),
    dueDate: toDateString(data.dueDate),
    monthKey: String(data.monthKey ?? ''),
    monthKeySource: data.monthKeySource === 'manual' ? 'manual' : 'auto',
    debtId: data.debtId ?? null,
    autoPay: data.autoPay === true,
    status: data.status ?? 'pending',
  };
};

const asIncome = (doc: QueryDocumentSnapshot<DocumentData>): Income => {
  const data = doc.data();
  return {
    id: doc.id,
    amount: Number(data.amount ?? 0),
    type: String(data.type ?? 'Boshqa'),
    method: data.method === 'card' ? 'card' : 'cash',
    paidAt: toDateString(data.paidAt),
    monthKey: String(data.monthKey ?? ''),
    debtId: data.debtId ?? null,
  };
};

const asSpend = (doc: QueryDocumentSnapshot<DocumentData>): PersonalSpend => {
  const data = doc.data();
  return {
    id: doc.id,
    amount: Number(data.amount ?? 0),
    purpose: String(data.purpose ?? ''),
    method: data.method === 'card' ? 'card' : 'cash',
    spentAt: toDateString(data.spentAt),
    monthKey: String(data.monthKey ?? ''),
  };
};

const asMonthSummary = (data: DocumentData, monthKey: string): MonthSummary => ({
  ...emptySummary(monthKey),
  ...(data as Partial<MonthSummary>),
  monthKey,
  byType: (data.byType ?? {}) as MonthSummary['byType'],
  byCategory: (data.byCategory ?? {}) as MonthSummary['byCategory'],
});

/** Dashboard — 2 ta hujjat o'qiladi. */
export const getMonthSummary = async (
  uid: string,
  monthKey: string,
): Promise<MonthSummary> =>
  unstable_cache(
    async () => {
      const doc = await refs(uid).month(monthKey).get();
      return asMonthSummary(doc.data() ?? {}, monthKey);
    },
    [uid, 'month', monthKey],
    { tags: [monthTag(uid, monthKey)], revalidate: 300 },
  )();

export const getTotals = async (uid: string): Promise<OverallTotals> =>
  unstable_cache(
    async () => {
      const doc = await refs(uid).totals.get();
      const data = doc.data() ?? {};
      return {
        income: Number(data.income ?? 0),
        expense: Number(data.expense ?? 0),
        personalAllocated: Number(data.personalAllocated ?? 0),
        personalSpent: Number(data.personalSpent ?? 0),
      };
    },
    [uid, 'totals'],
    { tags: [listTag(uid, 'totals')], revalidate: 300 },
  )();

/** Barcha oylar — yillik tahlil va jamg'arma (12–36 hujjat, 1 soat kesh). */
export const getMonths = async (
  uid: string,
  limit = 36,
): Promise<MonthSummary[]> =>
  unstable_cache(
    async () => {
      const snapshot = await refs(uid)
        .months.orderBy('__name__', 'desc')
        .limit(limit)
        .get();
      return snapshot.docs.map((doc) => asMonthSummary(doc.data(), doc.id));
    },
    [uid, 'months', String(limit)],
    { tags: [listTag(uid, 'months')], revalidate: 3600 },
  )();

export const getSavings = async (uid: string) =>
  savingsSeries(await getMonths(uid));

export interface Page<T> {
  readonly items: T[];
  readonly cursor: string | null;
}

/** Kursorli sahifalash — `offset` ATAYLAB ishlatilmaydi (§12.5). */
export const getMonthExpenses = async (
  uid: string,
  monthKey: string,
  { limit = 100, cursor }: { limit?: number; cursor?: string } = {},
): Promise<Page<Expense>> => {
  let query = refs(uid)
    .expenses.where('monthKey', '==', monthKey)
    .orderBy('dueDate')
    .orderBy('__name__')
    .limit(limit);
  if (cursor) {
    const [millis, id] = cursor.split('|');
    query = query.startAfter(new Date(Number(millis)), id);
  }
  const snapshot = await query.get();
  const items = snapshot.docs.map(asExpense);
  const last = snapshot.docs.at(-1);
  return {
    items,
    cursor:
      items.length === limit && last
        ? `${new Date(items.at(-1)!.dueDate).getTime()}|${last.id}`
        : null,
  };
};

export const getMonthIncomes = async (
  uid: string,
  monthKey: string,
): Promise<Income[]> => {
  const snapshot = await refs(uid)
    .incomes.where('monthKey', '==', monthKey)
    .orderBy('paidAt', 'desc')
    .limit(200)
    .get();
  return snapshot.docs.map(asIncome);
};

export const getMonthSpends = async (
  uid: string,
  monthKey: string,
): Promise<PersonalSpend[]> => {
  const snapshot = await refs(uid)
    .personalSpends.where('monthKey', '==', monthKey)
    .orderBy('spentAt', 'desc')
    .limit(200)
    .get();
  return snapshot.docs.map(asSpend);
};

/** To'lanmaganlar — `status` indeksidan. */
export const getUnpaid = async (uid: string, limit = 200): Promise<Expense[]> => {
  const snapshot = await refs(uid)
    .expenses.where('status', 'in', ['pending', 'overdue'])
    .orderBy('dueDate')
    .limit(limit)
    .get();
  return snapshot.docs.map(asExpense);
};

export const getDebts = async (uid: string) => {
  const snapshot = await refs(uid).debts.orderBy('name').limit(100).get();
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      name: String(data.name ?? ''),
      direction: data.direction === 'owedToMe' ? 'owedToMe' : 'iOwe',
      total: Number(data.total ?? 0),
      paidBefore: Number(data.paidBefore ?? 0),
      monthly: Number(data.monthly ?? 0),
      paidFromExpenses: Number(data.paidFromExpenses ?? 0),
      paidFromIncomes: Number(data.paidFromIncomes ?? 0),
      pendingFromApp: Number(data.pendingFromApp ?? 0),
      archived: data.archived === true,
    } as const;
  });
};

export const getGoals = async (uid: string) => {
  const snapshot = await refs(uid).goals.orderBy('order').limit(50).get();
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      name: String(data.name ?? ''),
      target: Number(data.target ?? 0),
      saved: Number(data.saved ?? 0),
      monthly: data.monthly == null ? null : Number(data.monthly),
      deadline: data.deadline ? toDateString(data.deadline) : null,
    } as const;
  });
};

export const getRecurring = async (uid: string) => {
  const snapshot = await refs(uid).recurring.orderBy('order').get();
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      name: String(data.name ?? ''),
      category: String(data.category ?? ''),
      amount: data.amount == null ? null : Number(data.amount),
      method: data.method === 'card' ? 'card' : 'cash',
      day: Number(data.day ?? 1),
      autoPay: data.autoPay === true,
      active: data.active !== false,
    } as const;
  });
};

export const getLimits = async (uid: string) => {
  const snapshot = await refs(uid).limits.get();
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    category: String(doc.data().category ?? ''),
    monthlyLimit: Number(doc.data().monthlyLimit ?? 0),
  }));
};

export const getSettings = async (uid: string) => {
  const store = refs(uid);
  const [app, fund, rules, reminders] = await Promise.all([
    store.settings.doc('app').get(),
    store.settings.doc('personalFund').get(),
    store.settings.doc('incomeRules').get(),
    store.settings.doc('reminders').get(),
  ]);
  return {
    app: app.data() ?? {},
    personalFund: fund.data() ?? {},
    incomeRules: (rules.data()?.rules ?? []) as { type: string; shift: number }[],
    reminders: reminders.data() ?? {},
  };
};

export const getHealth = async (uid: string) => {
  const doc = await refs(uid).health.get();
  return doc.data() ?? null;
};

/** 🩺 Noldan hisoblangan agregat — solishtirish uchun. */
export const recomputeMonth = async (
  uid: string,
  monthKey: string,
  personalCategoryKey: string,
): Promise<MonthSummary> => {
  const [incomes, expenses, spends] = await Promise.all([
    getMonthIncomes(uid, monthKey),
    refs(uid).expenses.where('monthKey', '==', monthKey).get(),
    getMonthSpends(uid, monthKey),
  ]);
  return buildMonthSummary({
    monthKey,
    personalCategoryKey,
    incomes,
    expenses: expenses.docs.map(asExpense),
    personalSpends: spends,
  });
};
