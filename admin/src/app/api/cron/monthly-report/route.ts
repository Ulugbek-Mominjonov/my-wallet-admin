import {
  balanceOf,
  emptySummary,
  monthKeyOf,
  personalBalanceOf,
  savedOf,
  savedRatioOf,
  savingsOf,
  shiftMonth,
  type MonthSummary,
} from '@byudjet/calc';
import { NextResponse } from 'next/server';

import { refs } from '@/lib/firebase-admin';
import { money, monthTitle } from '@/lib/format';
import { assertCron, sendTelegram, targetUsers } from '@/server/cron';

export const runtime = 'nodejs';

/**
 * Oylik hisobot — har oyning 21-kuni (§6.1).
 *
 * Nega 21? Daromad oyning ~20-sanasigacha to'liq tushadi (oylik 1–3,
 * KPI 5–8, avans 15–17, qo'shimcha 15–20). 1-sanada yuborilsa oldingi oy
 * to'liq bo'lmasdi.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const denied = assertCron(request);
  if (denied) return denied;

  const now = new Date();
  const monthKey = shiftMonth(monthKeyOf(now), -1);
  const results: Record<string, boolean> = {};

  for (const uid of await targetUsers()) {
    const store = refs(uid);
    const [reminderDoc, monthDoc, totalsDoc, monthsSnapshot] =
      await Promise.all([
        store.settings.doc('reminders').get(),
        store.month(monthKey).get(),
        store.totals.get(),
        store.months.get(),
      ]);

    const settings = reminderDoc.data() ?? {};
    if (settings.monthlyEnabled === false) {
      results[uid] = false;
      continue;
    }

    const summary: MonthSummary = {
      ...emptySummary(monthKey),
      ...(monthDoc.data() as Partial<MonthSummary> | undefined),
      monthKey,
      byType: (monthDoc.data()?.byType ?? {}) as MonthSummary['byType'],
      byCategory: (monthDoc.data()?.byCategory ??
        {}) as MonthSummary['byCategory'],
    };

    const totals = {
      income: Number(totalsDoc.data()?.income ?? 0),
      expense: Number(totalsDoc.data()?.expense ?? 0),
      personalAllocated: Number(totalsDoc.data()?.personalAllocated ?? 0),
      personalSpent: Number(totalsDoc.data()?.personalSpent ?? 0),
    };

    // Daromad odatdagidan ancha kam bo'lsa — yozuvlar to'liq kiritilmagan
    // bo'lishi mumkin (Sheets'dagi ogohlantirishning aynan o'zi).
    const otherMonths = Math.max(0, monthsSnapshot.size - 1);
    const averageIncome =
      otherMonths > 0 ? (totals.income - summary.income) / otherMonths : 0;
    const suspicious =
      averageIncome > 0 && summary.income < averageIncome * 0.6;

    const categories = Object.entries(summary.byCategory)
      .sort((a, b) => b[1].actual - a[1].actual)
      .slice(0, 5);

    const text = [
      `📊 <b>${monthTitle(monthKey)} yakuni</b>`,
      '',
      `Daromad: <b>${money(summary.income)}</b> so'm`,
      `Xarajat: <b>${money(summary.expense)}</b> so'm`,
      `💰 Qoldiq: <b>${money(balanceOf(summary))}</b> so'm`,
      `📈 Orttirgan: <b>${money(savedOf(summary))}</b> so'm ` +
        `(${Math.round(savedRatioOf(summary) * 100)}%)`,
      '',
      `👤 Shaxsiy fond: ${money(personalBalanceOf(totals))} so'm`,
      `🏦 Jamg'arma: ${money(savingsOf(totals))} so'm`,
      categories.length > 0 ? "\n<b>Eng ko'p sarflangan:</b>" : '',
      ...categories.map(
        ([name, split]) => `  • ${name} — ${money(split.actual)}`,
      ),
      suspicious
        ? `\n⚠️ <b>Diqqat:</b> bu oy daromadi odatdagidan ancha kam ` +
          `(o'rtacha ${money(Math.round(averageIncome))}). Yozuvlarni tekshiring.`
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    results[uid] = await sendTelegram(text);
  }

  return NextResponse.json({ ok: true, monthKey, results });
}
