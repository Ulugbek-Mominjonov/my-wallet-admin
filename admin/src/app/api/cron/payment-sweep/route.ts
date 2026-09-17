import {
  paymentStatus,
  shouldAutoPay,
  deltaForExpense,
  DEFAULT_PERSONAL_CATEGORY_KEY,
  normalizeKey,
  type Expense,
} from '@byudjet/calc';
import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';

import { adminDb, refs } from '@/lib/firebase-admin';
import { applyDelta } from '@/server/writer';
import { assertCron, targetUsers } from '@/server/cron';

export const runtime = 'nodejs';
export const maxDuration = 60;

const toDateString = (value: unknown): string => {
  if (value && typeof value === 'object' && 'toDate' in value) {
    const date = (value as { toDate: () => Date }).toDate();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  return '1970-01-01';
};

/**
 * Kunlik skan (00:10 Toshkent):
 * * muddati o'tgan to'lovlar `overdue` ga o'tadi;
 * * `autoPay` bo'lsa `fakt = reja` (§2.6) va agregat delta bilan
 *   yangilanadi — ilova ochilmasa ham.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const denied = assertCron(request);
  if (denied) return denied;

  const today = new Date();
  const results: Record<string, number> = {};

  for (const uid of await targetUsers()) {
    const store = refs(uid);
    const settingsDoc = await store.settings.doc('app').get();
    const personalCategoryKey = settingsDoc.data()?.personalCategory
      ? normalizeKey(settingsDoc.data()!.personalCategory)
      : DEFAULT_PERSONAL_CATEGORY_KEY;

    const snapshot = await store.expenses
      .where('status', 'in', ['pending', 'overdue'])
      .where('dueDate', '<=', today)
      .limit(400)
      .get();

    let changed = 0;
    const batch = adminDb().batch();

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const before: Expense = {
        id: doc.id,
        name: String(data.name ?? ''),
        category: String(data.category ?? ''),
        method: data.method === 'card' ? 'card' : 'cash',
        planned: data.planned == null ? null : Number(data.planned),
        actual: data.actual == null ? null : Number(data.actual),
        dueDate: toDateString(data.dueDate),
        monthKey: String(data.monthKey ?? ''),
        debtId: data.debtId ?? null,
        autoPay: data.autoPay === true,
        status: data.status ?? 'pending',
      };

      const autoPay = shouldAutoPay(before, today);
      const actual = autoPay ? before.planned : before.actual;
      const status = paymentStatus(
        before.planned,
        actual ?? null,
        before.dueDate,
        today,
      );
      if (!autoPay && status === before.status) continue;

      const after: Expense = { ...before, actual: actual ?? null, status };
      batch.set(
        store.expenses.doc(doc.id),
        {
          ...(autoPay ? { actual } : {}),
          status,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      if (autoPay) {
        applyDelta(batch, uid, deltaForExpense(before, after, personalCategoryKey));
      }
      changed += 1;
    }

    if (changed > 0) await batch.commit();
    results[uid] = changed;
  }

  return NextResponse.json({ ok: true, updated: results });
}
