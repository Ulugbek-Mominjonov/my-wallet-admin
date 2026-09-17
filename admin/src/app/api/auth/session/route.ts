import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { adminAuth } from '@/lib/firebase-admin';
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  adminUids,
} from '@/lib/session';

export const runtime = 'nodejs';

/**
 * idToken → sessiya cookie.
 *
 * `ADMIN_UIDS` ro'yxatida bo'lmagan foydalanuvchi 403 oladi — panelning
 * hech bir sahifasi ochilmaydi (§12.6).
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as { idToken?: string };
  if (!body.idToken) {
    return NextResponse.json({ message: 'idToken kerak' }, { status: 400 });
  }

  const decoded = await adminAuth().verifyIdToken(body.idToken);
  const allowed = adminUids();
  if (allowed.length > 0 && !allowed.includes(decoded.uid)) {
    return NextResponse.json(
      { message: 'Bu hisob uchun ruxsat yo\'q' },
      { status: 403 },
    );
  }

  const sessionCookie = await adminAuth().createSessionCookie(body.idToken, {
    expiresIn: SESSION_MAX_AGE_SECONDS * 1000,
  });
  const store = await cookies();
  store.set(SESSION_COOKIE, sessionCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return NextResponse.json({ ok: true });
}

/** Chiqish — forma POST bilan ham ishlaydi. */
export async function DELETE(): Promise<NextResponse> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  return NextResponse.json({ ok: true });
}
