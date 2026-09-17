import { redirect } from 'next/navigation';

import { IncomeRulesForm } from '@/components/income-rules-form';
import { PageHeader } from '@/components/ui';
import { currentUser } from '@/lib/session';
import { getSettings } from '@/server/queries';

export const dynamic = 'force-dynamic';

/**
 * Daromad qoidalari (§2.1).
 *
 * Qoida o'zgarsa eski yozuvlar ham ko'chishi kerak — shuning uchun avval
 * "nechta yozuv ko'chadi" preview ko'rsatiladi (§6.5).
 */
export default async function IncomeRulesPage() {
  const user = await currentUser();
  if (!user) redirect('/');
  const settings = await getSettings(user.uid);

  const rules =
    settings.incomeRules.length > 0
      ? settings.incomeRules
      : [
          { type: 'Avans', shift: 0 },
          { type: 'Oylik', shift: -1 },
          { type: 'KPI', shift: -1 },
          { type: "Qo'shimcha", shift: -1 },
        ];

  return (
    <main>
      <PageHeader
        title="Daromad qoidalari"
        subtitle="1-sentabrdagi «Oylik» — avgust oyining puli"
      />
      <IncomeRulesForm rules={rules} />
    </main>
  );
}
