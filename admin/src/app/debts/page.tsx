import { debtView } from '@byudjet/calc';
import { redirect } from 'next/navigation';

import { Badge, Card, PageHeader, Progress, Stat } from '@/components/ui';
import { money, monthTitle } from '@/lib/format';
import { currentUser } from '@/lib/session';
import { getDebts } from '@/server/queries';

export const dynamic = 'force-dynamic';

/** 💳 Qarzlar — bog'langan yozuvlar hisoblagichlardan olinadi (N+1 yo'q). */
export default async function DebtsPage() {
  const user = await currentUser();
  if (!user) redirect('/');

  const today = new Date();
  const views = (await getDebts(user.uid))
    .filter((debt) => !debt.archived)
    .map((debt) => debtView(debt, today));

  const iOwe = views
    .filter((view) => view.debt.direction === 'iOwe')
    .reduce((sum, view) => sum + view.remaining, 0);
  const owedToMe = views
    .filter((view) => view.debt.direction === 'owedToMe')
    .reduce((sum, view) => sum + view.remaining, 0);

  return (
    <main>
      <PageHeader title="💳 Qarzlar" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Men qarzdorman" value={iOwe} tone="negative" />
        <Stat label="Menga qarzdor" value={owedToMe} tone="positive" />
        <Stat label="Sof holat" value={owedToMe - iOwe} tone="sign" />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {views.map((view) => (
          <Card key={view.debt.id}>
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold">{view.debt.name}</h3>
              <Badge tone={view.debt.direction === 'iOwe' ? 'negative' : 'positive'}>
                {view.debt.direction === 'iOwe' ? 'Men qarzdorman' : 'Menga qarzdor'}
              </Badge>
            </div>
            <div className="mt-3">
              <Progress
                value={view.debt.total > 0 ? view.paid / view.debt.total : 0}
                tone={view.remaining === 0 ? 'var(--color-positive)' : undefined}
              />
            </div>
            <dl className="mt-3 space-y-1 text-sm text-neutral-500">
              <div className="flex justify-between">
                <dt>Qolgan</dt>
                <dd className="tabular font-semibold text-neutral-900 dark:text-neutral-100">
                  {money(view.remaining)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt>To'langan (ilovadan)</dt>
                <dd className="tabular">{money(view.applied)}</dd>
              </div>
              {view.debt.pendingFromApp > 0 ? (
                <div className="flex justify-between text-[var(--color-warning)]">
                  <dt>Bog'langan, to'lanmagan</dt>
                  <dd className="tabular">{money(view.debt.pendingFromApp)}</dd>
                </div>
              ) : null}
              {view.monthsLeft > 0 ? (
                <div className="flex justify-between">
                  <dt>Tugash</dt>
                  <dd>
                    {view.monthsLeft} oy ·{' '}
                    {view.finishMonth ? monthTitle(view.finishMonth) : ''}
                  </dd>
                </div>
              ) : null}
            </dl>
          </Card>
        ))}
        {views.length === 0 ? (
          <p className="text-sm text-neutral-400">Qarz yo'q 🎉</p>
        ) : null}
      </div>
    </main>
  );
}
