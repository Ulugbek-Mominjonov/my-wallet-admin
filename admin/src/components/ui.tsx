import type { ReactNode } from 'react';

import { money, moneyLong } from '@/lib/format';

/** Sarlavhali karta. */
export function Card({
  title,
  action,
  children,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      {title ? (
        <header className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-neutral-500 dark:text-neutral-400">
            {title}
          </h2>
          {action}
        </header>
      ) : null}
      {children}
    </section>
  );
}

/** Katta ko'rsatkich. */
export function Stat({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  hint?: string;
  tone?: 'neutral' | 'positive' | 'negative' | 'sign';
}) {
  const color =
    tone === 'sign'
      ? value < 0
        ? 'text-[var(--color-negative)]'
        : 'text-[var(--color-positive)]'
      : tone === 'positive'
        ? 'text-[var(--color-positive)]'
        : tone === 'negative'
          ? 'text-[var(--color-negative)]'
          : '';
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <p className="text-xs font-medium text-neutral-500">{label}</p>
      <p className={`tabular mt-1 text-2xl font-bold ${color}`}>
        {money(value)}
      </p>
      {hint ? <p className="mt-1 text-xs text-neutral-400">{hint}</p> : null}
    </div>
  );
}

export function Money({ value, long = false }: { value: number; long?: boolean }) {
  return <span className="tabular">{long ? moneyLong(value) : money(value)}</span>;
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'positive' | 'negative' | 'warning';
}) {
  const tones: Record<string, string> = {
    neutral: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
    positive: 'bg-emerald-100 text-emerald-800',
    negative: 'bg-red-100 text-red-800',
    warning: 'bg-amber-100 text-amber-800',
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Progress({ value, tone }: { value: number; tone?: string }) {
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
      <div
        className="h-full rounded-full"
        style={{
          width: `${clamped * 100}%`,
          background: tone ?? 'var(--color-brand-500)',
        }}
      />
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <p className="py-10 text-center text-sm text-neutral-400">{message}</p>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle ? (
          <p className="text-sm text-neutral-500">{subtitle}</p>
        ) : null}
      </div>
      {action}
    </header>
  );
}
