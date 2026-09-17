import { monthKeyOf, personalBalanceOf } from '@byudjet/calc';
import { redirect } from 'next/navigation';

import { Card, PageHeader, Progress, Stat } from '@/components/ui';
import { dayText, money, monthTitle } from '@/lib/format';
import { currentUser } from '@/lib/session';
import { getMonthSpends, getTotals } from '@/server/queries';

export const dynamic = 'force-dynamic';

/** 👤 Shaxsiy fond — ajratma va sarflar alohida hisob. */
export default async function PersonalFundPage(props: {
  searchParams: Promise<{ month?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect('/');

  const { month } = await props.searchParams;
  const monthKey = month ?? monthKeyOf(new Date());
  const [totals, spends] = await Promise.all([
    getTotals(user.uid),
    getMonthSpends(user.uid, monthKey),
  ]);

  const used =
    totals.personalAllocated > 0
      ? totals.personalSpent / totals.personalAllocated
      : 0;

  return (
    <main>
      <PageHeader
        title="👤 Shaxsiy fond"
        subtitle="Xarajatdagi «O'zim uchun» — ajratma; bu yerdagi sarflar byudjet qoldig'iga ta'sir qilmaydi"
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="Qoldiq"
          value={personalBalanceOf(totals)}
          tone="sign"
        />
        <Stat label="Ajratilgan" value={totals.personalAllocated} />
        <Stat label="Sarflangan" value={totals.personalSpent} />
      </div>
      <div className="mt-4">
        <Card title="Foydalanish">
          <Progress value={used} tone="var(--color-personal)" />
        </Card>
      </div>
      <div className="mt-4">
        <Card title={`${monthTitle(monthKey)} sarflari`}>
          <ul className="divide-y divide-neutral-200 text-sm dark:divide-neutral-800">
            {spends.map((item) => (
              <li key={item.id} className="flex justify-between py-2">
                <span>
                  {item.purpose} · {dayText(item.spentAt)}
                </span>
                <span className="tabular">{money(item.amount)}</span>
              </li>
            ))}
            {spends.length === 0 ? (
              <li className="py-4 text-neutral-400">Sarf yo'q</li>
            ) : null}
          </ul>
        </Card>
      </div>
    </main>
  );
}
