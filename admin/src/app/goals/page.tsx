import { goalView } from '@byudjet/calc';
import { redirect } from 'next/navigation';

import { Card, PageHeader, Progress } from '@/components/ui';
import { money, percent } from '@/lib/format';
import { currentUser } from '@/lib/session';
import { getGoals, getSavings } from '@/server/queries';

export const dynamic = 'force-dynamic';

/** 🎯 Maqsadlar — oyiga ajratma ko'rsatilmasa o'rtacha orttirish olinadi. */
export default async function GoalsPage() {
  const user = await currentUser();
  if (!user) redirect('/');

  const [goals, savings] = await Promise.all([
    getGoals(user.uid),
    getSavings(user.uid),
  ]);
  const views = goals.map((goal) => goalView(goal, savings.averageSaved));

  return (
    <main>
      <PageHeader
        title="🎯 Maqsadlar"
        subtitle={`O'rtacha orttirish: ${money(savings.averageSaved)} so'm/oy`}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {views.map((view) => (
          <Card key={view.goal.id}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{view.goal.name}</h3>
              <span className="tabular text-sm">{percent(view.progress)}</span>
            </div>
            <div className="mt-3">
              <Progress value={view.progress} />
            </div>
            <p className="tabular mt-3 text-sm">
              {money(view.goal.saved)} / {money(view.goal.target)} so'm
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              {view.remaining === 0
                ? "✅ Yig'ildi"
                : view.monthsLeft > 0
                  ? `${view.monthsLeft} oy · oyiga ${money(view.perMonth)}`
                  : "Oyiga ajratma yo'q"}
            </p>
          </Card>
        ))}
        {views.length === 0 ? (
          <p className="text-sm text-neutral-400">Maqsad qo'shilmagan</p>
        ) : null}
      </div>
    </main>
  );
}
