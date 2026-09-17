import { balanceOf, savedOf } from '@byudjet/calc';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { SavingsChart } from '@/components/savings-chart';
import { Card, PageHeader } from '@/components/ui';
import { money, monthTitle } from '@/lib/format';
import { currentUser } from '@/lib/session';
import { getMonths, getSavings } from '@/server/queries';

export const dynamic = 'force-dynamic';

/** Barcha oylar jadvali + jamg'armaning to'planishi (prefix-sum). */
export default async function MonthsPage() {
  const user = await currentUser();
  if (!user) redirect('/');

  const [months, savings] = await Promise.all([
    getMonths(user.uid),
    getSavings(user.uid),
  ]);

  return (
    <main>
      <PageHeader
        title="Oylar"
        subtitle={`${months.length} oy · jamg'arma ${money(savings.total)} so'm`}
      />

      <Card title="To'planish">
        <SavingsChart
          points={savings.points.map((point) => ({
            month: monthTitle(point.monthKey),
            cumulative: point.cumulative,
            balance: point.balance,
          }))}
        />
      </Card>

      <div className="mt-4 overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-100 text-left dark:bg-neutral-900">
            <tr>
              <th className="p-3">Oy</th>
              <th className="p-3 text-right">Daromad</th>
              <th className="p-3 text-right">Xarajat</th>
              <th className="p-3 text-right">Qoldiq</th>
              <th className="p-3 text-right">Orttirgan</th>
              <th className="p-3 text-right">To'plangan</th>
            </tr>
          </thead>
          <tbody>
            {savings.points
              .slice()
              .reverse()
              .map((point) => {
                const summary = months.find(
                  (item) => item.monthKey === point.monthKey,
                )!;
                return (
                  <tr
                    key={point.monthKey}
                    className="border-t border-neutral-200 dark:border-neutral-800"
                  >
                    <td className="p-3">
                      <Link
                        href={`/months/${point.monthKey}`}
                        className="text-[var(--color-brand-500)]"
                      >
                        {monthTitle(point.monthKey)}
                      </Link>
                    </td>
                    <td className="tabular p-3 text-right">
                      {money(summary.income)}
                    </td>
                    <td className="tabular p-3 text-right">
                      {money(summary.expense)}
                    </td>
                    <td
                      className={`tabular p-3 text-right ${
                        balanceOf(summary) < 0
                          ? 'text-[var(--color-negative)]'
                          : ''
                      }`}
                    >
                      {money(balanceOf(summary))}
                    </td>
                    <td className="tabular p-3 text-right">
                      {money(savedOf(summary))}
                    </td>
                    <td className="tabular p-3 text-right font-semibold">
                      {money(point.cumulative)}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
