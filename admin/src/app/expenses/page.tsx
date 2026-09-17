import { monthKeyOf } from '@byudjet/calc';
import { redirect } from 'next/navigation';

import { ExpenseTable } from '@/components/expense-table';
import { EmptyState, PageHeader } from '@/components/ui';
import { monthTitle } from '@/lib/format';
import { currentUser } from '@/lib/session';
import { getMonthExpenses } from '@/server/queries';

export const dynamic = 'force-dynamic';

/** Xarajatlar jadvali — bulk "To'landi" bilan. */
export default async function ExpensesPage(props: {
  searchParams: Promise<{ month?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect('/');

  const { month } = await props.searchParams;
  const monthKey = month ?? monthKeyOf(new Date());
  const page = await getMonthExpenses(user.uid, monthKey, { limit: 200 });

  return (
    <main>
      <PageHeader
        title="Xarajatlar"
        subtitle={`${monthTitle(monthKey)} · ${page.items.length} ta yozuv`}
      />
      {page.items.length === 0 ? (
        <EmptyState message="Bu oyda xarajat yo'q" />
      ) : (
        <ExpenseTable items={page.items} />
      )}
    </main>
  );
}
