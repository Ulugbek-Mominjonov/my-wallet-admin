import { reminderBuckets, type Expense } from '@byudjet/calc';
import { getMessaging } from 'firebase-admin/messaging';
import { NextResponse } from 'next/server';

import { adminApp, refs } from '@/lib/firebase-admin';
import { money } from '@/lib/format';
import { assertCron, sendTelegram, targetUsers } from '@/server/cron';

export const runtime = 'nodejs';
export const maxDuration = 60;

const toDateString = (value: unknown): string => {
  if (value && typeof value === 'object' && 'toDate' in value) {
    const date = (value as { toDate: () => Date }).toDate();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  return '1970-01-01';
};

/** Kunlik eslatma: kechikkan / bugungi / yaqin to'lovlar → FCM + Telegram. */
export async function GET(request: Request): Promise<NextResponse> {
  const denied = assertCron(request);
  if (denied) return denied;

  const today = new Date();
  const sent: Record<string, number> = {};

  for (const uid of await targetUsers()) {
    const store = refs(uid);
    const [reminderDoc, snapshot, userDoc] = await Promise.all([
      store.settings.doc('reminders').get(),
      store.expenses
        .where('status', 'in', ['pending', 'overdue'])
        .orderBy('dueDate')
        .limit(200)
        .get(),
      store.user.get(),
    ]);

    const settings = reminderDoc.data() ?? {};
    const expenses: Expense[] = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: String(data.name ?? ''),
        category: String(data.category ?? ''),
        method: data.method === 'card' ? 'card' : 'cash',
        planned: data.planned == null ? null : Number(data.planned),
        actual: data.actual == null ? null : Number(data.actual),
        dueDate: toDateString(data.dueDate),
        monthKey: String(data.monthKey ?? ''),
      };
    });

    const buckets = reminderBuckets(
      expenses,
      today,
      Number(settings.daysAhead ?? 3),
    );
    const count =
      buckets.overdue.length + buckets.dueToday.length + buckets.upcoming.length;
    if (count === 0) {
      sent[uid] = 0;
      continue;
    }

    const line = (item: Expense): string =>
      `  • ${item.name} — ${item.planned === null ? "summa o'zgaruvchi" : money(item.planned)} (${item.dueDate})`;

    const text = [
      "🔔 <b>To'lov eslatmasi</b>",
      buckets.overdue.length
        ? `\n⚠️ <b>Muddati o'tgan:</b>\n${buckets.overdue.map(line).join('\n')}`
        : '',
      buckets.dueToday.length
        ? `\n📌 <b>Bugun to'lanadi:</b>\n${buckets.dueToday.map(line).join('\n')}`
        : '',
      buckets.upcoming.length
        ? `\n🗓 <b>Yaqin kunlarda:</b>\n${buckets.upcoming.map(line).join('\n')}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    if (settings.telegramEnabled === true) await sendTelegram(text);

    const tokens = (userDoc.data()?.fcmTokens ?? []) as string[];
    if (settings.pushEnabled !== false && tokens.length > 0) {
      await getMessaging(adminApp()).sendEachForMulticast({
        tokens,
        notification: {
          title: "To'lov eslatmasi",
          body: `${count} ta to'lov kutilmoqda`,
        },
      });
    }
    sent[uid] = count;
  }

  return NextResponse.json({ ok: true, sent });
}
