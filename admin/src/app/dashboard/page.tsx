import {
  balanceOf,
  forecastOf,
  monthKeyOf,
  personalBalanceOf,
  savedOf,
  savedRatioOf,
  savingsOf,
} from '@byudjet/calc';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Card, PageHeader, Progress, Stat } from '@/components/ui';
import { moneyCompact, monthTitle, percent } from '@/lib/format';
import { currentUser } from '@/lib/session';
import { getMonthSummary, getSavings, getTotals } from '@/server/queries';

export const dynamic = 'force-dynamic';

/**
 * Joriy oy xulosasi.
 *
 * ★ Bu sahifa XOM HUJJAT O'QIMAYDI: `months/{oy}` + `meta/totals` —
 * jami 2 ta hujjat (§12.5). Kategoriya kesimi ham o'sha hujjat ichida.
 */
export default async function DashboardPage(props: {
  searchParams: Promise<{ month?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect('/');

  const { month } = await props.searchParams;
  const monthKey = month ?? monthKeyOf(new Date());
  const [summary, totals, savings] = await Promise.all([
    getMonthSummary(user.uid, monthKey),
    getTotals(user.uid),
    getSavings(user.uid),
  ]);

  const categories = Object.entries(summary.byCategory).sort(
    (a, b) => b[1].actual - a[1].actual,
  );
  const types = Object.entries(summary.byType).sort(
    (a, b) => b[1].card + b[1].cash - (a[1].card + a[1].cash),
  );

  return (
    <main>
      <PageHeader
        title={monthTitle(monthKey)}
        subtitle="Oylik xulosa — 2 ta hujjatdan hisoblangan"
        action={
          <Link
            href="/months"
            className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm dark:border-neutral-700"
          >
            Barcha oylar →
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Qoldiq" value={balanceOf(summary)} tone="sign" />
        <Stat
          label="Orttirgan"
          value={savedOf(summary)}
          tone="sign"
          hint={percent(savedRatioOf(summary))}
        />
        <Stat label="Daromad" value={summary.income} tone="positive" />
        <Stat label="Xarajat" value={summary.expense} tone="negative" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="Byudjet">
          <p className="tabular text-sm">
            {moneyCompact(summary.expense)} / {moneyCompact(summary.planned)}
          </p>
          <div className="mt-2">
            <Progress
              value={summary.planned > 0 ? summary.expense / summary.planned : 0}
              tone={
                summary.expense > summary.planned
                  ? 'var(--color-negative)'
                  : undefined
              }
            />
          </div>
          <dl className="mt-4 space-y-1 text-sm text-neutral-500">
            <div className="flex justify-between">
              <dt>Prognoz (to'lanmaganlar bilan)</dt>
              <dd className="tabular">{moneyCompact(forecastOf(summary))}</dd>
            </div>
            <div className="flex justify-between">
              <dt>To'lanmagan</dt>
              <dd className="tabular">{moneyCompact(summary.unpaidTotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Karta / naqd</dt>
              <dd className="tabular">
                {moneyCompact(summary.incomeCard - summary.expenseCard)} /{' '}
                {moneyCompact(summary.incomeCash - summary.expenseCash)}
              </dd>
            </div>
          </dl>
        </Card>

        <Card title="👤 Shaxsiy fond">
          <p className="tabular text-2xl font-bold text-[var(--color-personal)]">
            {moneyCompact(personalBalanceOf(totals))}
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            Ajratilgan {moneyCompact(totals.personalAllocated)} · sarflangan{' '}
            {moneyCompact(totals.personalSpent)}
          </p>
          <p className="mt-3 text-xs text-neutral-400">
            Bu pul 🏦 jamg'armaga qo'shilmaydi — alohida hisob.
          </p>
        </Card>

        <Card title="🏦 Jamg'arma">
          <p className="tabular text-2xl font-bold text-[var(--color-savings)]">
            {moneyCompact(savingsOf(totals))}
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            {savings.points.length} oy · o'rtacha orttirish{' '}
            {moneyCompact(savings.averageSaved)}
          </p>
          <Link
            href="/savings"
            className="mt-3 inline-block text-xs text-[var(--color-brand-500)]"
          >
            To'planish grafigi →
          </Link>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Kategoriyalar">
          {categories.length === 0 ? (
            <p className="text-sm text-neutral-400">Yozuv yo'q</p>
          ) : (
            <ul className="space-y-3">
              {categories.map(([name, split]) => (
                <li key={name}>
                  <div className="flex justify-between text-sm">
                    <span>{name}</span>
                    <span className="tabular">{moneyCompact(split.actual)}</span>
                  </div>
                  <div className="mt-1">
                    <Progress
                      value={
                        summary.expense > 0 ? split.actual / summary.expense : 0
                      }
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Daromad turlari">
          {types.length === 0 ? (
            <p className="text-sm text-neutral-400">Yozuv yo'q</p>
          ) : (
            <ul className="space-y-3">
              {types.map(([name, split]) => (
                <li key={name} className="text-sm">
                  <div className="flex justify-between">
                    <span>{name}</span>
                    <span className="tabular">
                      {moneyCompact(split.card + split.cash)}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400">
                    Karta {moneyCompact(split.card)} · naqd{' '}
                    {moneyCompact(split.cash)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </main>
  );
}
