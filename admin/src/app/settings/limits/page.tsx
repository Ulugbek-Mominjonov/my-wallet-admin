import { monthKeyOf } from '@byudjet/calc';
import { redirect } from 'next/navigation';

import { EmptyState, PageHeader, Progress } from '@/components/ui';
import { money, percent } from '@/lib/format';
import { currentUser } from '@/lib/session';
import { getLimits, getMonthSummary } from '@/server/queries';

export const dynamic = 'force-dynamic';

/** Kategoriya limitlari — joriy oy sarfi bilan solishtirilgan. */
export default async function LimitsPage() {
  const user = await currentUser();
  if (!user) redirect('/');

  const monthKey = monthKeyOf(new Date());
  const [limits, summary] = await Promise.all([
    getLimits(user.uid),
    getMonthSummary(user.uid, monthKey),
  ]);

  const spentFor = (category: string): number => {
    const key = category.trim().toLowerCase();
    return Object.entries(summary.byCategory)
      .filter(([name]) => name.trim().toLowerCase() === key)
      .reduce((sum, [, split]) => sum + split.actual, 0);
  };

  return (
    <main>
      <PageHeader title="Kategoriya limitlari" />
      {limits.length === 0 ? (
        <EmptyState message="Limit qo'yilmagan" />
      ) : (
        <ul className="space-y-4">
          {limits.map((limit) => {
            const spent = spentFor(limit.category);
            const ratio = limit.monthlyLimit > 0 ? spent / limit.monthlyLimit : 0;
            return (
              <li
                key={limit.id}
                className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800"
              >
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{limit.category}</span>
                  <span className="tabular">
                    {money(spent)} / {money(limit.monthlyLimit)} ·{' '}
                    {percent(ratio)}
                  </span>
                </div>
                <div className="mt-2">
                  <Progress
                    value={ratio}
                    tone={
                      ratio > 1
                        ? 'var(--color-negative)'
                        : ratio >= 0.8
                          ? 'var(--color-warning)'
                          : undefined
                    }
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
