import {
  buildMonthSummary,
  compareSummaries,
  emptySummary,
  monthKeyOf,
  normalizeKey,
  shiftMonth,
  DEFAULT_PERSONAL_CATEGORY_KEY,
  type Expense,
  type Income,
  type MonthSummary,
  type PersonalSpend,
} from '@byudjet/calc';
import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';

import { refs } from '@/lib/firebase-admin';
import { assertCron, sendTelegram, targetUsers } from '@/server/cron';

export const runtime = 'nodejs';
// Vercel'ning bepul rejasida funksiya 60 soniyadan oshmaydi.
// Bir foydalanuvchi uchun 2 oy ≈ 60–200 hujjat — bu chegaradan ancha past.
export const maxDuration = 60;

const toDateString = (value: unknown): string => {
  if (value && typeof value === 'object' && 'toDate' in value) {
    const date = (value as { toDate: () => Date }).toDate();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  return '1970-01-01';
};

/**
 * §5.5 — kechasi 03:00 (Toshkent) agregatni noldan hisoblab solishtiradi
 * va farqni tuzatadi. Natija `meta/health` ga yoziladi; farq topilsa
 * Telegram'ga ogohlantirish ketadi (§13.6).
 */
export async function GET(request: Request): Promise<NextResponse> {
  const denied = assertCron(request);
  if (denied) return denied;

  const now = new Date();
  const months = [monthKeyOf(now), shiftMonth(monthKeyOf(now), -1)];
  const report: Record<string, unknown> = {};

  for (const uid of await targetUsers()) {
    const store = refs(uid);
    const settingsDoc = await store.settings.doc('app').get();
    const personalCategoryKey = settingsDoc.data()?.personalCategory
      ? normalizeKey(settingsDoc.data()!.personalCategory)
      : DEFAULT_PERSONAL_CATEGORY_KEY;

    const drift: Record<string, unknown> = {};
    let driftCount = 0;
    let fixedCount = 0;

    for (const monthKey of months) {
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
      if (difference.fields.length === 0) continue;

      driftCount += difference.fields.length;
      drift[monthKey] = difference.fields;
      await store.month(monthKey).set({
        ...computed,
        version: Number(storedDoc.data()?.version ?? 1) + 1,
        updatedAt: FieldValue.serverTimestamp(),
      });
      fixedCount += 1;
    }

    // Totalsni oy hujjatlaridan qayta quramiz — bitta manba qoidasi.
    const allMonths = await store.months.get();
    const totals = allMonths.docs.reduce(
      (sum, doc) => ({
        income: sum.income + Number(doc.data().income ?? 0),
        expense: sum.expense + Number(doc.data().expense ?? 0),
        personalAllocated:
          sum.personalAllocated + Number(doc.data().personalAllocated ?? 0),
        personalSpent:
          sum.personalSpent + Number(doc.data().personalSpent ?? 0),
      }),
      { income: 0, expense: 0, personalAllocated: 0, personalSpent: 0 },
    );
    await store.totals.set(
      { ...totals, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );

    await store.health.set(
      {
        lastRun: FieldValue.serverTimestamp(),
        checkedMonths: months,
        driftCount,
        fixedCount,
        drift,
      },
      { merge: true },
    );

    if (driftCount > 0) {
      await sendTelegram(
        `⚠️ <b>Agregatda farq topildi</b>\nOylar: ${months.join(', ')}\n` +
          `Farq: ${driftCount} ta · tuzatildi: ${fixedCount} ta`,
      );
    }
    report[uid] = { driftCount, fixedCount };
  }

  return NextResponse.json({ ok: true, report });
}
