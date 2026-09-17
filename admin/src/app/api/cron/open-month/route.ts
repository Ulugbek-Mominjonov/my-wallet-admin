import {
  dayOfMonth,
  deltaForExpense,
  monthKeyOf,
  normalizeKey,
  paymentStatus,
  personalFundPlan,
  shiftMonth,
  type Expense,
} from '@byudjet/calc';
import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';

import { adminDb, refs } from '@/lib/firebase-admin';
import { applyDelta } from '@/server/writer';
import { assertCron, targetUsers } from '@/server/cron';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * §2.11 — keyingi oyni tayyorlaydi (oyning oxirgi kuni ishlaydi).
 *
 * IDEMPOTENT: shu nomdagi qator oyda bor bo'lsa o'tkazib yuboriladi,
 * shuning uchun cron bir necha marta ishga tushsa ham takror yozuv
 * paydo bo'lmaydi.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const denied = assertCron(request);
  if (denied) return denied;

  const now = new Date();
  // Faqat oyning OXIRGI kunida ishlaydi (cron 28–31 kunlari chaqiradi).
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  if (now.getDate() !== lastDay) {
    return NextResponse.json({ ok: true, skipped: 'oy oxiri emas' });
  }

  const nextMonth = shiftMonth(monthKeyOf(now), 1);
  const created: Record<string, number> = {};

  for (const uid of await targetUsers()) {
    const store = refs(uid);
    const [appDoc, fundDoc, recurringSnapshot, existingSnapshot, monthDoc] =
      await Promise.all([
        store.settings.doc('app').get(),
        store.settings.doc('personalFund').get(),
        store.recurring.orderBy('order').get(),
        store.expenses.where('monthKey', '==', nextMonth).get(),
        store.month(nextMonth).get(),
      ]);

    const personalCategory =
      (appDoc.data()?.personalCategory as string | undefined) ?? "O'zim uchun";
    const personalCategoryKey = normalizeKey(personalCategory);
    const personalRowName =
      (appDoc.data()?.personalRowName as string | undefined) ??
      "O'zim uchun (ajratma)";

    const existingNames = new Set(
      existingSnapshot.docs.map((doc) => normalizeKey(doc.data().name)),
    );
    const hasPersonalRow = existingSnapshot.docs.some(
      (doc) => normalizeKey(doc.data().category) === personalCategoryKey,
    );

    const batch = adminDb().batch();
    let count = 0;

    const addExpense = (expense: Expense): void => {
      batch.set(store.expenses.doc(expense.id), {
        name: expense.name,
        category: expense.category,
        method: expense.method,
        planned: expense.planned,
        actual: null,
        dueDate: new Date(expense.dueDate),
        monthKey: expense.monthKey,
        monthKeySource: 'manual',
        status: expense.status,
        debtId: expense.debtId ?? null,
        recurringId: expense.id,
        autoPay: expense.autoPay === true,
        source: 'recurring',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      applyDelta(batch, uid, deltaForExpense(null, expense, personalCategoryKey));
      count += 1;
    };

    for (const doc of recurringSnapshot.docs) {
      const data = doc.data();
      if (data.active === false) continue;
      const name = String(data.name ?? '');
      if (existingNames.has(normalizeKey(name))) continue;

      const due = dayOfMonth(nextMonth, Number(data.day ?? 1));
      const dueDate = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`;
      const planned = data.amount == null ? null : Number(data.amount);

      addExpense({
        id: store.expenses.doc().id,
        name,
        category: String(data.category ?? 'Boshqa'),
        method: data.method === 'card' ? 'card' : 'cash',
        planned,
        actual: null,
        dueDate,
        monthKey: nextMonth,
        monthKeySource: 'manual',
        debtId: data.debtId ?? null,
        autoPay: data.autoPay === true,
        status: paymentStatus(planned, null, dueDate, now),
      });
      existingNames.add(normalizeKey(name));
    }

    if (!hasPersonalRow) {
      const fund = fundDoc.data() ?? {};
      const due = dayOfMonth(nextMonth, Number(fund.day ?? 1));
      const dueDate = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`;
      const planned = personalFundPlan(
        Number(monthDoc.data()?.income ?? 0),
        fund.mode === 'fixed' ? 'fixed' : 'percent',
        Number(fund.value ?? 10),
      );
      addExpense({
        id: store.expenses.doc().id,
        name: personalRowName,
        category: personalCategory,
        method: fund.method === 'card' ? 'card' : 'cash',
        planned,
        actual: null,
        dueDate,
        monthKey: nextMonth,
        monthKeySource: 'manual',
        debtId: null,
        autoPay: false,
        status: paymentStatus(planned, null, dueDate, now),
      });
    }

    if (count > 0) await batch.commit();
    created[uid] = count;
  }

  return NextResponse.json({ ok: true, month: nextMonth, created });
}
