import { compareSummaries, monthKeyOf, shiftMonth, normalizeKey, DEFAULT_PERSONAL_CATEGORY_KEY } from '@byudjet/calc';
import { redirect } from 'next/navigation';

import { Badge, Card, PageHeader } from '@/components/ui';
import { dayText, monthTitle } from '@/lib/format';
import { currentUser } from '@/lib/session';
import {
  getHealth,
  getMonthSummary,
  getSettings,
  recomputeMonth,
} from '@/server/queries';

export const dynamic = 'force-dynamic';

/**
 * 🩺 Tekshiruv sahifasi — Sheets'dagi «Tekshirish va tuzatish» ning davomi.
 *
 * Bu yerda agregat XOM YOZUVLARDAN qayta hisoblanadi va saqlangani bilan
 * solishtiriladi. Tuzatish `reconcileAggregates` onCall funksiyasi orqali
 * (yoki kechasi cron bilan) bajariladi.
 */
export default async function HealthPage() {
  const user = await currentUser();
  if (!user) redirect('/');

  const settings = await getSettings(user.uid);
  const personalCategoryKey = settings.app.personalCategory
    ? normalizeKey(settings.app.personalCategory as string)
    : DEFAULT_PERSONAL_CATEGORY_KEY;

  const now = new Date();
  const months = [monthKeyOf(now), shiftMonth(monthKeyOf(now), -1)];
  const [health, ...checks] = await Promise.all([
    getHealth(user.uid),
    ...months.map(async (monthKey) => {
      const [stored, computed] = await Promise.all([
        getMonthSummary(user.uid, monthKey),
        recomputeMonth(user.uid, monthKey, personalCategoryKey),
      ]);
      return { monthKey, drift: compareSummaries(stored, computed) };
    }),
  ]);

  const totalDrift = checks.reduce(
    (sum, check) => sum + check.drift.fields.length,
    0,
  );

  return (
    <main>
      <PageHeader
        title="🩺 Tekshirish"
        subtitle="Delta bilan yig'ilgan agregat xom yozuvlarga mos keladimi?"
      />

      <Card title="Serverdagi oxirgi tekshiruv">
        {health ? (
          <div className="space-y-1 text-sm">
            <p>Vaqti: {dayText(health.lastRun)}</p>
            <p>
              Tekshirilgan oylar:{' '}
              {(health.checkedMonths as string[] | undefined)?.join(', ') ?? '—'}
            </p>
            <p>
              Farq: {String(health.driftCount ?? 0)} · tuzatilgan:{' '}
              {String(health.fixedCount ?? 0)}
            </p>
          </div>
        ) : (
          <p className="text-sm text-neutral-400">
            Hali ishga tushmagan — kechasi 03:00 da cron chaqiradi.
          </p>
        )}
      </Card>

      <div className="mt-4 space-y-4">
        {checks.map((check) => (
          <Card
            key={check.monthKey}
            title={monthTitle(check.monthKey)}
            action={
              check.drift.fields.length === 0 ? (
                <Badge tone="positive">Toza</Badge>
              ) : (
                <Badge tone="negative">
                  {check.drift.fields.length} ta farq
                </Badge>
              )
            }
          >
            {check.drift.fields.length === 0 ? (
              <p className="text-sm text-neutral-400">
                Agregat xom yozuvlarga to'liq mos.
              </p>
            ) : (
              <ul className="space-y-1 text-sm">
                {check.drift.fields.map((field) => (
                  <li key={field.field} className="tabular">
                    {field.field}: {field.stored} → {field.computed}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))}
      </div>

      {totalDrift > 0 ? (
        <p className="mt-4 text-sm text-[var(--color-warning)]">
          Tuzatish uchun `reconcileAggregates` onCall funksiyasini
          `{`{ fix: true }`}` bilan chaqiring yoki kechki cronni kuting.
        </p>
      ) : null}
    </main>
  );
}
