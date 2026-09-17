import { redirect } from 'next/navigation';

import { SavingsChart } from '@/components/savings-chart';
import { Card, PageHeader, Stat } from '@/components/ui';
import { money, monthTitle } from '@/lib/format';
import { currentUser } from '@/lib/session';
import { getSavings, getTotals } from '@/server/queries';

export const dynamic = 'force-dynamic';

/** 🏦 Jamg'arma — oylik qoldiqlarning xronologik to'planishi. */
export default async function SavingsPage() {
  const user = await currentUser();
  if (!user) redirect('/');

  const [savings, totals] = await Promise.all([
    getSavings(user.uid),
    getTotals(user.uid),
  ]);

  return (
    <main>
      <PageHeader
        title="🏦 Jamg'arma"
        subtitle="Σ(oylik qoldiq) — 👤 shaxsiy fond bilan qo'shilmaydi"
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="To'plangan" value={savings.total} tone="sign" />
        <Stat label="Umumiy daromad" value={totals.income} />
        <Stat label="Umumiy xarajat" value={totals.expense} />
      </div>
      <div className="mt-4">
        <Card title="To'planish">
          <SavingsChart
            points={savings.points.map((point) => ({
              month: monthTitle(point.monthKey),
              cumulative: point.cumulative,
              balance: point.balance,
            }))}
          />
        </Card>
      </div>
      <div className="mt-4">
        <Card title="Oylar kesimi">
          <ul className="divide-y divide-neutral-200 text-sm dark:divide-neutral-800">
            {savings.points
              .slice()
              .reverse()
              .map((point) => (
                <li
                  key={point.monthKey}
                  className="flex justify-between py-2"
                >
                  <span>{monthTitle(point.monthKey)}</span>
                  <span className="tabular">
                    {money(point.balance)} → Σ {money(point.cumulative)}
                  </span>
                </li>
              ))}
          </ul>
        </Card>
      </div>
    </main>
  );
}
