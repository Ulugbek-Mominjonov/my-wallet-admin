import { redirect } from 'next/navigation';

import { Card, PageHeader } from '@/components/ui';
import { currentUser } from '@/lib/session';
import { getMonths, getTotals } from '@/server/queries';

export const dynamic = 'force-dynamic';

/** Backup — JSON ko'chirma (oy agregatlari + umumiy hisob). */
export default async function ExportPage() {
  const user = await currentUser();
  if (!user) redirect('/');

  const [months, totals] = await Promise.all([
    getMonths(user.uid, 120),
    getTotals(user.uid),
  ]);
  const payload = JSON.stringify({ months, totals }, null, 2);

  return (
    <main>
      <PageHeader
        title="Eksport"
        subtitle="Oy agregatlari va umumiy hisob — JSON"
      />
      <Card>
        <pre className="max-h-[60vh] overflow-auto rounded-xl bg-neutral-100 p-4 text-xs dark:bg-neutral-950">
          {payload}
        </pre>
      </Card>
    </main>
  );
}
