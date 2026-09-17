import {
  buildMonthSummary,
  compareSummaries,
  type Expense,
  type Income,
  type MonthSummary,
  type PersonalSpend,
  DEFAULT_PERSONAL_CATEGORY_KEY,
  emptySummary,
  normalizeKey,
} from '@byudjet/calc';
import { FieldValue } from 'firebase-admin/firestore';

import { refs } from './firestore.js';

/**
 * §5.5 — 🩺 agregatni noldan hisoblab, saqlangani bilan solishtiradi
 * va farqni tuzatadi.
 *
 * Narxi: bir oy ≈ 60 hujjat o'qish. Kuniga bir marta, 2 oy uchun —
 * bepul kvota ichida.
 */
export interface ReconcileOutcome {
  readonly checkedMonths: string[];
  readonly drift: Record<string, unknown>;
  readonly driftCount: number;
  readonly fixedCount: number;
}

const toDateString = (value: unknown): string => {
  if (value && typeof value === 'object' && 'toDate' in value) {
    const date = (value as { toDate: () => Date }).toDate();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate(),
    ).padStart(2, '0')}`;
  }
  return typeof value === 'string' ? value : '1970-01-01';
};

const readPersonalCategoryKey = async (uid: string): Promise<string> => {
  const snapshot = await refs(uid).settings.doc('app').get();
  const value = snapshot.data()?.personalCategory;
  return value ? normalizeKey(value) : DEFAULT_PERSONAL_CATEGORY_KEY;
};

export const reconcileMonths = async (
  uid: string,
  monthKeys: readonly string[],
  fix: boolean,
): Promise<ReconcileOutcome> => {
  const store = refs(uid);
  const personalCategoryKey = await readPersonalCategoryKey(uid);
  const drift: Record<string, unknown> = {};
  let driftCount = 0;
  let fixedCount = 0;

  for (const monthKey of monthKeys) {
    const [storedDoc, incomeDocs, expenseDocs, spendDocs] = await Promise.all([
      store.month(monthKey).get(),
      store.incomes.where('monthKey', '==', monthKey).get(),
      store.expenses.where('monthKey', '==', monthKey).get(),
      store.personalSpends.where('monthKey', '==', monthKey).get(),
    ]);

    const stored: MonthSummary = {
      ...emptySummary(monthKey),
      ...(storedDoc.data() as Partial<MonthSummary> | undefined),
      monthKey,
      byType: (storedDoc.data()?.byType ?? {}) as MonthSummary['byType'],
      byCategory: (storedDoc.data()?.byCategory ??
        {}) as MonthSummary['byCategory'],
    };

    const computed = buildMonthSummary({
      monthKey,
      personalCategoryKey,
      incomes: incomeDocs.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          amount: Number(data.amount ?? 0),
          type: String(data.type ?? 'Boshqa'),
          method: data.method === 'card' ? 'card' : 'cash',
          paidAt: toDateString(data.paidAt),
          monthKey,
          debtId: data.debtId ?? null,
        } satisfies Income;
      }),
      expenses: expenseDocs.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          name: String(data.name ?? ''),
          category: String(data.category ?? 'Boshqa'),
          method: data.method === 'card' ? 'card' : 'cash',
          planned: data.planned == null ? null : Number(data.planned),
          actual: data.actual == null ? null : Number(data.actual),
          dueDate: toDateString(data.dueDate),
          monthKey,
          debtId: data.debtId ?? null,
          autoPay: data.autoPay === true,
        } satisfies Expense;
      }),
      personalSpends: spendDocs.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          amount: Number(data.amount ?? 0),
          purpose: String(data.purpose ?? ''),
          method: data.method === 'card' ? 'card' : 'cash',
          spentAt: toDateString(data.spentAt),
          monthKey,
        } satisfies PersonalSpend;
      }),
      closed: stored.closed === true,
    });

    const difference = compareSummaries(stored, computed);
    if (difference.fields.length > 0) {
      driftCount += difference.fields.length;
      drift[monthKey] = difference.fields;
      if (fix) {
        await store.month(monthKey).set(
          {
            ...computed,
            version: (storedDoc.data()?.version ?? 1) + 1,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: false },
        );
        fixedCount += 1;
      }
    }
  }

  await store.health.set(
    {
      lastRun: FieldValue.serverTimestamp(),
      checkedMonths: monthKeys,
      driftCount,
      fixedCount,
      drift,
    },
    { merge: true },
  );

  return {
    checkedMonths: [...monthKeys],
    drift,
    driftCount,
    fixedCount,
  };
};

/** `meta/totals` ni oy hujjatlaridan qayta quradi. */
export const reconcileTotals = async (uid: string): Promise<void> => {
  const store = refs(uid);
  const months = await store.months.get();
  const totals = months.docs.reduce(
    (sum, doc) => {
      const data = doc.data();
      return {
        income: sum.income + Number(data.income ?? 0),
        expense: sum.expense + Number(data.expense ?? 0),
        personalAllocated:
          sum.personalAllocated + Number(data.personalAllocated ?? 0),
        personalSpent: sum.personalSpent + Number(data.personalSpent ?? 0),
      };
    },
    { income: 0, expense: 0, personalAllocated: 0, personalSpent: 0 },
  );
  await store.totals.set(
    { ...totals, updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
};
