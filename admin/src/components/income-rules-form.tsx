'use client';

import { useState, useTransition } from 'react';

import { saveIncomeRules } from '@/server/actions';
import { Card } from './ui';

interface Rule {
  type: string;
  shift: number;
}

/** Qoidalarni tahrirlash — saqlashdan oldin ta'sir ko'rsatiladi. */
export function IncomeRulesForm({ rules }: { rules: Rule[] }) {
  const [draft, setDraft] = useState<Rule[]>(rules);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const setShift = (type: string, shift: number): void => {
    setDraft((current) =>
      current.map((rule) => (rule.type === type ? { ...rule, shift } : rule)),
    );
  };

  const save = (): void => {
    startTransition(async () => {
      const result = await saveIncomeRules({ rules: draft });
      setMessage(result.message);
    });
  };

  const today = new Date();
  const monthName = (shift: number): string => {
    const date = new Date(today.getFullYear(), today.getMonth() + shift, 1);
    return date.toLocaleDateString('uz-UZ', { month: 'long', year: 'numeric' });
  };

  return (
    <div className="space-y-4">
      {draft.map((rule) => (
        <Card key={rule.type}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-medium">{rule.type}</p>
              <p className="text-xs text-neutral-500">
                Bugun kiritilsa → {monthName(rule.shift)}
              </p>
            </div>
            <div className="flex gap-2">
              {[-1, 0].map((shift) => (
                <button
                  key={shift}
                  type="button"
                  onClick={() => setShift(rule.type, shift)}
                  className={`rounded-lg px-3 py-1.5 text-sm ${
                    rule.shift === shift
                      ? 'bg-[var(--color-brand-500)] text-white'
                      : 'border border-neutral-200 dark:border-neutral-700'
                  }`}
                >
                  {shift === -1 ? 'Oldingi oy' : 'Joriy oy'}
                </button>
              ))}
            </div>
          </div>
        </Card>
      ))}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-lg bg-[var(--color-brand-500)] px-4 py-2 text-sm text-white disabled:opacity-60"
        >
          {pending ? 'Saqlanmoqda…' : 'Saqlash'}
        </button>
        {message ? (
          <span className="text-sm text-neutral-500">{message}</span>
        ) : null}
      </div>

      <p className="text-xs text-neutral-400">
        Eski yozuvlarni ko'chirish uchun `recalcMonthKeys` funksiyasi
        ishlatiladi — u avval `dryRun` bilan nechta yozuv ko'chishini
        qaytaradi.
      </p>
    </div>
  );
}
