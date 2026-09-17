import { monthKeyOf } from '@byudjet/calc';
import { redirect } from 'next/navigation';

import { EmptyState, PageHeader } from '@/components/ui';
import { dayText, money, monthTitle } from '@/lib/format';
import { currentUser } from '@/lib/session';
import { getMonthIncomes } from '@/server/queries';

export const dynamic = 'force-dynamic';

export default async function IncomesPage(props: {
  searchParams: Promise<{ month?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect('/');

  const { month } = await props.searchParams;
  const monthKey = month ?? monthKeyOf(new Date());
  const items = await getMonthIncomes(user.uid, monthKey);
  const total = items.reduce((sum, item) => sum + item.amount, 0);

  return (
    <main>
      <PageHeader
        title="Daromadlar"
        subtitle={`${monthTitle(monthKey)} · jami ${money(total)} so'm`}
      />
      {items.length === 0 ? (
        <EmptyState message="Bu oyda daromad yozuvi yo'q" />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-sm">
            <thead className="bg-neutral-100 text-left dark:bg-neutral-900">
              <tr>
                <th className="p-3">Sana</th>
                <th className="p-3">Tur</th>
                <th className="p-3">Usul</th>
                <th className="p-3 text-right">Summa</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="border-t border-neutral-200 dark:border-neutral-800"
                >
                  <td className="p-3">{dayText(item.paidAt)}</td>
                  <td className="p-3">{item.type}</td>
                  <td className="p-3 text-neutral-500">
                    {item.method === 'card' ? 'Karta' : 'Naqd'}
                  </td>
                  <td className="tabular p-3 text-right">
                    {money(item.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
