import { balanceOf, forecastOf, savedOf } from '@byudjet/calc';
import { redirect } from 'next/navigation';

import { ExpenseTable } from '@/components/expense-table';
import { Card, PageHeader, Stat } from '@/components/ui';
import { dayText, money, monthTitle } from '@/lib/format';
import { currentUser } from '@/lib/session';
import {
  getMonthExpenses,
  getMonthIncomes,
  getMonthSpends,
  getMonthSummary,
} from '@/server/queries';

export const dynamic = 'force-dynamic';

/** Bitta oyning to'liq kesimi: daromad + xarajat + shaxsiy sarf. */
export default async function MonthPage(props: {
  params: Promise<{ key: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect('/');
  const { key } = await props.params;

  const [summary, expenses, incomes, spends] = await Promise.all([
    getMonthSummary(user.uid, key),
    getMonthExpenses(user.uid, key, { limit: 200 }),
    getMonthIncomes(user.uid, key),
    getMonthSpends(user.uid, key),
  ]);

  return (
    <main>
      <PageHeader
        title={monthTitle(key)}
        subtitle={summary.closed ? '🔒 Oy yopilgan' : 'Oy ochiq'}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Qoldiq" value={balanceOf(summary)} tone="sign" />
        <Stat label="Orttirgan" value={savedOf(summary)} tone="sign" />
        <Stat label="Prognoz" value={forecastOf(summary)} tone="sign" />
        <Stat label="To'lanmagan" value={summary.unpaidTotal} tone="negative" />
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-lg font-semibold">Xarajatlar</h2>
        <ExpenseTable items={expenses.items} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card title="Daromadlar">
          <ul className="space-y-2 text-sm">
            {incomes.map((item) => (
              <li key={item.id} className="flex justify-between">
                <span>
                  {item.type} · {dayText(item.paidAt)}
                </span>
                <span className="tabular">{money(item.amount)}</span>
              </li>
            ))}
            {incomes.length === 0 ? (
              <li className="text-neutral-400">Yozuv yo'q</li>
            ) : null}
          </ul>
        </Card>

        <Card title="👤 Shaxsiy fond sarflari">
          <ul className="space-y-2 text-sm">
            {spends.map((item) => (
              <li key={item.id} className="flex justify-between">
                <span>
                  {item.purpose} · {dayText(item.spentAt)}
                </span>
                <span className="tabular">{money(item.amount)}</span>
              </li>
            ))}
            {spends.length === 0 ? (
              <li className="text-neutral-400">Sarf yo'q</li>
            ) : null}
          </ul>
        </Card>
      </div>
    </main>
  );
}
