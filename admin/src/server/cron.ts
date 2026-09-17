import 'server-only';

import { NextResponse } from 'next/server';

import { adminDb } from '@/lib/firebase-admin';
import { adminUids } from '@/lib/session';

/**
 * Vercel Cron endpointlari uchun umumiy qism (§13.5).
 *
 * Rejali ishlar Cloud Scheduler o'rniga Vercel'da: loglar bitta joyda,
 * debug oson. Mantiq `@byudjet/calc` da bo'lgani uchun kerak bo'lsa
 * Cloud Functions'ga ko'chirish 10 daqiqalik ish.
 */

/** Har bir endpoint birinchi qatorda shuni chaqiradi. */
export const assertCron = (request: Request): NextResponse | null => {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { message: 'CRON_SECRET sozlanmagan' },
      { status: 500 },
    );
  }
  const header = request.headers.get('authorization');
  if (header !== `Bearer ${secret}`) {
    return NextResponse.json({ message: 'Ruxsat yo\'q' }, { status: 401 });
  }
  return null;
};

/** Cron qaysi foydalanuvchilar uchun ishlaydi. */
export const targetUsers = async (): Promise<string[]> => {
  const configured = adminUids();
  if (configured.length > 0) return configured;
  const snapshot = await adminDb().collection('users').limit(50).get();
  return snapshot.docs.map((doc) => doc.id);
};

/** Telegram xabari — token bo'lmasa jimgina o'tkazib yuboriladi. */
export const sendTelegram = async (text: string): Promise<boolean> => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return false;

  const response = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    },
  );
  return response.ok;
};
