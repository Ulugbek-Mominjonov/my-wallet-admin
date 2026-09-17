import 'server-only';

import { cookies } from 'next/headers';

import { adminAuth } from './firebase-admin';

/**
 * Sessiya cookie'si — brauzerga Firestore'ga yozish huquqi BERILMAYDI.
 * Barcha yozuv Server Action orqali, Admin SDK bilan ketadi (§12.3).
 */
export const SESSION_COOKIE = 'byudjet_session';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 5;

export const adminUids = (): string[] =>
  (process.env.ADMIN_UIDS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

export interface SessionUser {
  readonly uid: string;
  readonly email: string | null;
  readonly name: string | null;
}

/** Cookie'ni tekshiradi; yaroqsiz bo'lsa `null`. */
export const currentUser = async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const value = store.get(SESSION_COOKIE)?.value;
  if (!value) return null;
  try {
    const decoded = await adminAuth().verifySessionCookie(value, true);
    const allowed = adminUids();
    if (allowed.length > 0 && !allowed.includes(decoded.uid)) return null;
    return {
      uid: decoded.uid,
      email: decoded.email ?? null,
      name: (decoded.name as string | undefined) ?? null,
    };
  } catch {
    // Muddati o'tgan yoki bekor qilingan cookie — kirish ekraniga.
    return null;
  }
};

/** Sahifa va Server Action'lar uchun: kirmagan bo'lsa xato tashlaydi. */
export const requireUser = async (): Promise<SessionUser> => {
  const user = await currentUser();
  if (!user) throw new Error('Kirish talab qilinadi');
  return user;
};
