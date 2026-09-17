import { redirect } from 'next/navigation';

import { EmptyState, PageHeader } from '@/components/ui';
import { dayText } from '@/lib/format';
import { refs } from '@/lib/firebase-admin';
import { currentUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** Oxirgi 200 o'zgarish — kim, qachon, nima (§12.6). */
export default async function AuditPage() {
  const user = await currentUser();
  if (!user) redirect('/');

  const snapshot = await refs(user.uid)
    .auditLog.orderBy('createdAt', 'desc')
    .limit(200)
    .get();

  const entries = snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      action: String(data.action ?? ''),
      target: String(data.target ?? ''),
      actor: String(data.actor ?? ''),
      createdAt: data.createdAt,
    };
  });

  return (
    <main>
      <PageHeader title="Audit log" subtitle="Oxirgi 200 o'zgarish" />
      {entries.length === 0 ? (
        <EmptyState message="Hali yozuv yo'q" />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-sm">
            <thead className="bg-neutral-100 text-left dark:bg-neutral-900">
              <tr>
                <th className="p-3">Vaqt</th>
                <th className="p-3">Amal</th>
                <th className="p-3">Obyekt</th>
                <th className="p-3">Kim</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-t border-neutral-200 dark:border-neutral-800"
                >
                  <td className="p-3">{dayText(entry.createdAt)}</td>
                  <td className="p-3">{entry.action}</td>
                  <td className="p-3 text-neutral-500">{entry.target}</td>
                  <td className="p-3 text-neutral-500">{entry.actor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
