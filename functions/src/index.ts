import {
  deltaForIncome,
  incomeMonthKey,
  monthKeyOf,
  shiftMonth,
  type IncomeRule,
  type Income,
} from '@byudjet/calc';
import { FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';

import { db, refs } from './firestore.js';
import { reconcileMonths, reconcileTotals } from './reconcile.js';

/**
 * Cloud Functions — ATAYLAB MINIMAL.
 *
 * Biznes logika klientda (sof Dart'da) turadi, chunki u offline ham
 * ishlashi shart. Rejali (cron) ishlar esa Vercel'da — loglar bitta
 * joyda bo'lishi uchun (§13.5). Bu yerda faqat klient to'g'ridan-to'g'ri
 * chaqiradigan `onCall` funksiyalar qoladi.
 */

const requireUid = (auth: { uid: string } | undefined): string => {
  if (!auth?.uid) {
    throw new HttpsError('unauthenticated', 'Avval tizimga kiring');
  }
  return auth.uid;
};

/** 🩺 Agregatni tekshirish va tuzatish (§5.5). */
export const reconcileAggregates = onCall<{
  months?: string[];
  fix?: boolean;
}>(
  { region: 'europe-west1', memory: '256MiB' },
  async (request) => {
    const uid = requireUid(request.auth);
    const now = new Date();
    const months = request.data?.months?.length
      ? request.data.months
      : [monthKeyOf(now), shiftMonth(monthKeyOf(now), -1)];

    const outcome = await reconcileMonths(uid, months, request.data?.fix !== false);
    if (outcome.fixedCount > 0) {
      await reconcileTotals(uid);
    }
    logger.info('reconcileAggregates', { uid, ...outcome });
    return outcome;
  },
);

/**
 * Daromad qoidasi o'zgarganda eski yozuvlarni qayta joylaydi (§6.5).
 *
 * `dryRun: true` — hech narsa yozilmaydi, faqat nechta yozuv ko'chishi
 * qaytariladi (admin paneldagi "preview" shu bilan ishlaydi).
 */
export const recalcMonthKeys = onCall<{
  rules?: IncomeRule[];
  dryRun?: boolean;
}>(
  { region: 'europe-west1', memory: '512MiB', timeoutSeconds: 300 },
  async (request) => {
    const uid = requireUid(request.auth);
    const store = refs(uid);

    const rules =
      request.data?.rules ??
      ((await store.settings.doc('incomeRules').get()).data()?.rules as
        | IncomeRule[]
        | undefined) ??
      [];
    const dryRun = request.data?.dryRun === true;

    const snapshot = await store.incomes.get();
    let moved = 0;
    let batch = db().batch();
    let operations = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const paidAt = data.paidAt?.toDate?.() as Date | undefined;
      if (!paidAt) continue;
      const paidAtString = `${paidAt.getFullYear()}-${String(
        paidAt.getMonth() + 1,
      ).padStart(2, '0')}-${String(paidAt.getDate()).padStart(2, '0')}`;

      const currentMonth = String(data.monthKey ?? '');
      const nextMonth = incomeMonthKey(
        paidAtString,
        String(data.type ?? ''),
        rules,
      );
      if (nextMonth === currentMonth) continue;
      moved += 1;
      if (dryRun) continue;

      const before: Income = {
        id: doc.id,
        amount: Number(data.amount ?? 0),
        type: String(data.type ?? ''),
        method: data.method === 'card' ? 'card' : 'cash',
        paidAt: paidAtString,
        monthKey: currentMonth,
        debtId: data.debtId ?? null,
      };
      const after: Income = { ...before, monthKey: nextMonth };
      const delta = deltaForIncome(before, after);

      batch.update(doc.ref, {
        monthKey: nextMonth,
        updatedAt: FieldValue.serverTimestamp(),
      });
      operations += 1;

      for (const [monthKey, monthDelta] of Object.entries(delta.months)) {
        batch.set(
          store.month(monthKey),
          {
            monthKey,
            income: FieldValue.increment(monthDelta.income),
            incomeCard: FieldValue.increment(monthDelta.incomeCard),
            incomeCash: FieldValue.increment(monthDelta.incomeCash),
            byType: Object.fromEntries(
              Object.entries(monthDelta.byType).map(([type, split]) => [
                type,
                {
                  card: FieldValue.increment(split.card),
                  cash: FieldValue.increment(split.cash),
                },
              ]),
            ),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
        operations += 1;
      }

      // Firestore chegarasi — 500 amal; zaxira bilan 400 da kesamiz.
      if (operations >= 400) {
        await batch.commit();
        batch = db().batch();
        operations = 0;
      }
    }

    if (!dryRun && operations > 0) await batch.commit();
    logger.info('recalcMonthKeys', { uid, moved, dryRun });
    return { moved, dryRun };
  },
);

/** Test push — eslatmalar sozlanganini tekshirish uchun. */
export const sendTestPush = onCall<{ title?: string; body?: string }>(
  { region: 'europe-west1' },
  async (request) => {
    const uid = requireUid(request.auth);
    const tokens = ((await refs(uid).user.get()).data()?.fcmTokens ??
      []) as string[];
    if (tokens.length === 0) {
      throw new HttpsError('failed-precondition', 'Qurilma tokeni topilmadi');
    }
    const response = await getMessaging().sendEachForMulticast({
      tokens,
      notification: {
        title: request.data?.title ?? 'Oylik byudjet',
        body: request.data?.body ?? 'Bildirishnomalar ishlayapti ✅',
      },
    });
    return { sent: response.successCount, failed: response.failureCount };
  },
);
