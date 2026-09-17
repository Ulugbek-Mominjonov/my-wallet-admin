import 'server-only';

import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * Admin SDK — FAQAT serverda.
 *
 * Kalit `FIREBASE_SERVICE_ACCOUNT` muhit o'zgaruvchisida (base64 JSON)
 * turadi va repoda hech qachon saqlanmaydi (§13.3). `server-only` importi
 * bu faylning brauzer bundle'iga tushib qolishini KOMPILYATSIYA VAQTIDA
 * taqiqlaydi.
 */
const credentials = (): App => {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT berilmagan — Vercel env sozlamalarini tekshiring',
    );
  }
  const json = JSON.parse(
    Buffer.from(raw, 'base64').toString('utf8'),
  ) as Record<string, string>;
  return initializeApp({
    credential: cert({
      projectId: json.project_id,
      clientEmail: json.client_email,
      privateKey: json.private_key?.replace(/\\n/g, '\n'),
    }),
    projectId: process.env.FIREBASE_PROJECT_ID ?? json.project_id,
  });
};

export const adminApp = (): App =>
  getApps().length > 0 ? getApps()[0]! : credentials();

export const adminDb = () => getFirestore(adminApp());

export const adminAuth = () => getAuth(adminApp());

/** Dart tomonidagi `refs.dart` bilan bir xil yo'llar. */
export const refs = (uid: string) => {
  const user = adminDb().collection('users').doc(uid);
  return {
    user,
    incomes: user.collection('incomes'),
    expenses: user.collection('expenses'),
    personalSpends: user.collection('personalSpends'),
    debts: user.collection('debts'),
    goals: user.collection('goals'),
    months: user.collection('months'),
    recurring: user.collection('recurring'),
    limits: user.collection('limits'),
    quickAdd: user.collection('quickAdd'),
    categories: user.collection('categories'),
    settings: user.collection('settings'),
    auditLog: user.collection('auditLog'),
    totals: user.collection('meta').doc('totals'),
    health: user.collection('meta').doc('health'),
    month: (monthKey: string) => user.collection('months').doc(monthKey),
  };
};
