import { redirect } from 'next/navigation';

import { Card, PageHeader } from '@/components/ui';
import { currentUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * Sheets'dan import — bir martalik ish, shuning uchun skript sifatida
 * bajariladi (`scripts/import-from-sheets.mjs`). Bu sahifa ko'rsatma
 * beradi va import qadamlarini eslатib turadi (§11).
 */
export default async function ImportPage() {
  const user = await currentUser();
  if (!user) redirect('/');

  return (
    <main>
      <PageHeader title="Import" subtitle="Google Sheets → Firestore" />
      <Card title="Qadamlar">
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          <li>
            Apps Script'da <code>doGet?action=export&amp;k=...</code> ni ochib
            JSON ni saqlang.
          </li>
          <li>
            <code>node scripts/import-from-sheets.mjs export.json --uid=UID</code>
            {' '}— yozuvlar ≤500 talik batchlarda yoziladi.
          </li>
          <li>
            <code>node scripts/verify-import.mjs --uid=UID</code> — har oy
            uchun qoldiq va orttirgan Sheets bilan solishtiriladi.
          </li>
          <li>
            🩺 «Tekshirish» sahifasida drift yo'qligini tasdiqlang.
          </li>
        </ol>
        <p className="mt-4 text-xs text-neutral-500">
          Import <code>monthKey</code> ni QAYTA HISOBLAMAYDI — Sheets
          allaqachon hisoblagan qiymat saqlanadi, aks holda tarix o'zgarib
          ketardi.
        </p>
      </Card>
    </main>
  );
}
