import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

/**
 * Admin SDK — rules'dan o'tmaydi, shuning uchun `meta/health` kabi
 * "faqat server yozadi" hujjatlarni ham yozа oladi.
 */
export const db = (): Firestore => {
  if (getApps().length === 0) initializeApp();
  return getFirestore();
};

/** Barcha yo'llar YAGONA joyda — Dart tomonidagi `refs.dart` bilan bir xil. */
export const refs = (uid: string) => {
  const user = db().collection('users').doc(uid);
  return {
    user,
    incomes: user.collection('incomes'),
    expenses: user.collection('expenses'),
    personalSpends: user.collection('personalSpends'),
    debts: user.collection('debts'),
    months: user.collection('months'),
    settings: user.collection('settings'),
    totals: user.collection('meta').doc('totals'),
    health: user.collection('meta').doc('health'),
    month: (monthKey: string) => user.collection('months').doc(monthKey),
  };
};
