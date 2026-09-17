import 'server-only';

import {
  deltaForExpense,
  deltaForIncome,
  deltaForPersonalSpend,
  deltaDocumentCount,
  isDeltaEmpty,
  mergeDeltas,
  monthDeltaToIncrements,
  totalsDeltaToIncrements,
  debtDeltaToIncrements,
  type AggregateDelta,
  type Expense,
  type Income,
  type PersonalSpend,
} from '@byudjet/calc';
import { FieldValue, type WriteBatch } from 'firebase-admin/firestore';

import { adminDb, refs } from '@/lib/firebase-admin';

/**
 * ★ Admin paneldagi yozuv — mobil ilova bilan BIR XIL mantiq.
 *
 * Delta hisobi `@byudjet/calc` da, ya'ni Dart implementatsiyasi bilan
 * fixture testlari orqali bog'langan. Shu sababli telefondan yozilgan
 * yozuv ham, admin paneldan yozilgani ham agregatga BIR XIL ta'sir qiladi
 * — drift bo'lishi mumkin emas (§12.3).
 */

/** Firestore chegarasi 500; zaxira bilan 400. */
export const MAX_BATCH_OPERATIONS = 400;

type LeafMap = Record<string, number | Record<string, number>>;

const toIncrements = (source: LeafMap): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(source).map(([key, value]) =>
      typeof value === 'number'
        ? [key, FieldValue.increment(value)]
        : [
            key,
            Object.fromEntries(
              Object.entries(value).map(([inner, amount]) => [
                inner,
                FieldValue.increment(amount),
              ]),
            ),
          ],
    ),
  );

/**
 * Deltani batchga qo'shadi.
 *
 * Ichma-ich map + `merge: true` — nuqtali "field path" ishlatilmaydi,
 * shuning uchun kategoriya nomida nuqta bo'lsa ham yo'l buzilmaydi.
 */
export const applyDelta = (
  batch: WriteBatch,
  uid: string,
  delta: AggregateDelta,
): void => {
  const store = refs(uid);
  for (const [monthKey, monthDelta] of Object.entries(delta.months)) {
    batch.set(
      store.month(monthKey),
      {
        ...toIncrements(monthDeltaToIncrements(monthDelta) as LeafMap),
        monthKey,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }

  const totals = totalsDeltaToIncrements(delta.totals);
  if (Object.keys(totals).length > 0) {
    batch.set(
      store.totals,
      { ...toIncrements(totals), updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
  }

  for (const [debtId, debtDelta] of Object.entries(delta.debts)) {
    batch.set(
      store.debts.doc(debtId),
      {
        ...toIncrements(debtDeltaToIncrements(debtDelta)),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }
};

export interface AuditEntry {
  readonly action: string;
  readonly target: string;
  readonly before?: unknown;
  readonly after?: unknown;
}

/** Har bir yozuv operatsiyasi audit logga tushadi (§12.6). */
export const writeAudit = (
  batch: WriteBatch,
  uid: string,
  actor: string,
  entry: AuditEntry,
): void => {
  batch.set(refs(uid).auditLog.doc(), {
    ...entry,
    actor,
    source: 'admin',
    createdAt: FieldValue.serverTimestamp(),
  });
};

/** Bitta xarajatni yozadi (qo'shish / tahrirlash / o'chirish). */
export const commitExpenseChange = async (
  uid: string,
  actor: string,
  {
    before,
    after,
    personalCategoryKey,
  }: {
    before: Expense | null;
    after: Expense | null;
    personalCategoryKey: string;
  },
): Promise<void> => {
  const batch = adminDb().batch();
  const store = refs(uid);

  if (after) {
    batch.set(
      store.expenses.doc(after.id),
      {
        name: after.name,
        category: after.category,
        method: after.method,
        planned: after.planned,
        actual: after.actual,
        dueDate: new Date(after.dueDate),
        monthKey: after.monthKey,
        monthKeySource: after.monthKeySource ?? 'auto',
        status: after.status ?? 'pending',
        debtId: after.debtId ?? null,
        autoPay: after.autoPay === true,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  } else if (before) {
    batch.delete(store.expenses.doc(before.id));
  }

  applyDelta(batch, uid, deltaForExpense(before, after, personalCategoryKey));
  writeAudit(batch, uid, actor, {
    action: after ? (before ? 'expense.update' : 'expense.create') : 'expense.delete',
    target: (after ?? before)?.id ?? '',
    before,
    after,
  });
  await batch.commit();
};

/**
 * ★ DoD: 40 ta to'lovni bulk "To'landi" qilish = BITTA batch,
 * agregat BIR MARTA yangilanadi.
 */
export const commitBulkPaid = async (
  uid: string,
  actor: string,
  items: readonly { before: Expense; amount: number }[],
  personalCategoryKey: string,
): Promise<{ batches: number; updated: number }> => {
  const store = refs(uid);
  let batch = adminDb().batch();
  let operations = 0;
  let batches = 0;
  let updated = 0;
  let pending: AggregateDelta[] = [];

  const flush = async (): Promise<void> => {
    if (operations === 0 && pending.length === 0) return;
    const delta = mergeDeltas(pending);
    if (!isDeltaEmpty(delta)) applyDelta(batch, uid, delta);
    await batch.commit();
    batches += 1;
    batch = adminDb().batch();
    operations = 0;
    pending = [];
  };

  for (const { before, amount } of items) {
    if ((before.actual ?? 0) > 0) continue;
    const after: Expense = { ...before, actual: amount, status: 'paid' };
    batch.set(
      store.expenses.doc(before.id),
      {
        actual: amount,
        status: 'paid',
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    pending.push(deltaForExpense(before, after, personalCategoryKey));
    operations += 1;
    updated += 1;

    const projected = operations + deltaDocumentCount(mergeDeltas(pending));
    if (projected >= MAX_BATCH_OPERATIONS) await flush();
  }

  if (operations > 0) {
    writeAudit(batch, uid, actor, {
      action: 'expense.bulkPaid',
      target: `${updated} ta`,
    });
    operations += 1;
  }
  await flush();
  return { batches, updated };
};

export const commitIncomeChange = async (
  uid: string,
  actor: string,
  { before, after }: { before: Income | null; after: Income | null },
): Promise<void> => {
  const batch = adminDb().batch();
  const store = refs(uid);

  if (after) {
    batch.set(
      store.incomes.doc(after.id),
      {
        amount: after.amount,
        type: after.type,
        method: after.method,
        paidAt: new Date(after.paidAt),
        monthKey: after.monthKey,
        debtId: after.debtId ?? null,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  } else if (before) {
    batch.delete(store.incomes.doc(before.id));
  }

  applyDelta(batch, uid, deltaForIncome(before, after));
  writeAudit(batch, uid, actor, {
    action: after ? (before ? 'income.update' : 'income.create') : 'income.delete',
    target: (after ?? before)?.id ?? '',
    before,
    after,
  });
  await batch.commit();
};

export const commitPersonalSpendChange = async (
  uid: string,
  actor: string,
  { before, after }: { before: PersonalSpend | null; after: PersonalSpend | null },
): Promise<void> => {
  const batch = adminDb().batch();
  const store = refs(uid);

  if (after) {
    batch.set(
      store.personalSpends.doc(after.id),
      {
        amount: after.amount,
        purpose: after.purpose,
        method: after.method,
        spentAt: new Date(after.spentAt),
        monthKey: after.monthKey,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  } else if (before) {
    batch.delete(store.personalSpends.doc(before.id));
  }

  applyDelta(batch, uid, deltaForPersonalSpend(before, after));
  writeAudit(batch, uid, actor, {
    action: after ? 'personalSpend.upsert' : 'personalSpend.delete',
    target: (after ?? before)?.id ?? '',
  });
  await batch.commit();
};
