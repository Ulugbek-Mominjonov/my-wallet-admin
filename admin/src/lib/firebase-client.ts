'use client';

import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  getAuth,
  signInWithPopup,
  type Auth,
} from 'firebase/auth';

/**
 * Brauzerdagi Firebase — FAQAT autentifikatsiya uchun.
 *
 * Ma'lumot yozish brauzerdan qilinmaydi: idToken serverga yuboriladi,
 * server sessiya cookie'sini beradi va barcha yozuv Server Action orqali,
 * Admin SDK bilan ketadi (§12.3).
 */
const app = (): FirebaseApp =>
  getApps()[0] ??
  initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  });

export const clientAuth = (): Auth => getAuth(app());

export const signInWithGoogle = async (): Promise<string> => {
  const credential = await signInWithPopup(
    clientAuth(),
    new GoogleAuthProvider(),
  );
  return credential.user.getIdToken();
};
