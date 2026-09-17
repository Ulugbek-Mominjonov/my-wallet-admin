import { redirect } from 'next/navigation';

import { Badge, EmptyState, PageHeader } from '@/components/ui';
import { money } from '@/lib/format';
import { currentUser } from '@/lib/session';
import { getRecurring } from '@/server/queries';

export const dynamic = 'force-dynamic';

/** Doimiy xarajatlar shabloni — yangi oy shulardan quriladi (§2.11). */
export default async function RecurringPage() {
  const user = await currentUser();
  if (!user) redirect('/');
  const items = await getRecurring(user.uid);

  return (
    <main>
      <PageHeader
        title="Doimiy xarajatlar"
        subtitle="Summasi bo'sh shablon = «har oy o'zgaradi»"
      />
      {items.length === 0 ? (
        <EmptyState message="Shablon qo'shilmagan" />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-sm">
            <thead className="bg-neutral-100 text-left dark:bg-neutral-900">
              <tr>
                <th className="p-3">Nomi</th>
                <th className="p-3">Kategoriya</th>
                <th className="p-3">Kun</th>
                <th className="p-3">Usul</th>
                <th className="p-3 text-right">Summa</th>
                <th className="p-3">Holat</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="border-t border-neutral-200 dark:border-neutral-800"
                >
                  <td className="p-3">
                    {item.name} {item.autoPay ? '⚡' : ''}
                  </td>
                  <td className="p-3 text-neutral-500">{item.category}</td>
                  <td className="p-3">{item.day}</td>
                  <td className="p-3 text-neutral-500">
                    {item.method === 'card' ? 'Karta' : 'Naqd'}
                  </td>
                  <td className="tabular p-3 text-right">
                    {item.amount === null ? "o'zgaruvchi" : money(item.amount)}
                  </td>
                  <td className="p-3">
                    {item.active ? (
                      <Badge tone="positive">Faol</Badge>
                    ) : (
                      <Badge>O'chirilgan</Badge>
                    )}
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
