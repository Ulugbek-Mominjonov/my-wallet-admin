'use client';

import type { Expense } from '@byudjet/calc';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import { useMemo, useState, useTransition } from 'react';

import { money, monthTitle } from '@/lib/format';
import { markManyPaid } from '@/server/actions';
import { Badge } from './ui';

/**
 * Xarajatlar jadvali — Sheets'ning o'rnini bosuvchi asosiy ko'rinish.
 *
 * TanStack Table: saralash va qidiruv (katta ekranda shu ikkisi eng kerak).
 *
 * ★ DoD: tanlangan to'lovlar BITTA Server Action chaqiruviga ketadi va
 * server ularni BITTA `WriteBatch` da yozadi — agregat bir marta
 * yangilanadi (§12.5).
 */
const columnHelper = createColumnHelper<Expense>();

export function ExpenseTable({ items }: { items: Expense[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'dueDate', desc: false },
  ]);
  const [filter, setFilter] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = (id: string): void => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: 'select',
        header: () => null,
        cell: (context) => {
          const row = context.row.original;
          const paid = (row.actual ?? 0) > 0;
          return (
            <input
              type="checkbox"
              checked={selected.has(row.id)}
              disabled={paid}
              onChange={() => toggle(row.id)}
              aria-label={`${row.name} ni tanlash`}
            />
          );
        },
      }),
      columnHelper.accessor('name', {
        header: 'Nomi',
        cell: (context) =>
          `${context.getValue()}${context.row.original.autoPay ? ' ⚡' : ''}`,
      }),
      columnHelper.accessor('category', { header: 'Kategoriya' }),
      columnHelper.accessor('dueDate', {
        header: 'Sana',
        cell: (context) => context.getValue().split('-').reverse().join('.'),
      }),
      columnHelper.accessor('monthKey', {
        header: 'Oy',
        cell: (context) =>
          `${monthTitle(context.getValue())}${
            context.row.original.monthKeySource === 'manual' ? ' ✋' : ''
          }`,
      }),
      columnHelper.accessor((row) => row.planned ?? -1, {
        id: 'planned',
        header: 'Reja',
        cell: (context) =>
          context.row.original.planned === null
            ? '—'
            : money(context.row.original.planned),
      }),
      columnHelper.accessor((row) => row.actual ?? 0, {
        id: 'actual',
        header: 'Fakt',
        cell: (context) =>
          context.row.original.actual ? money(context.row.original.actual) : '',
      }),
      columnHelper.accessor('status', {
        header: 'Holat',
        cell: (context) => {
          const status = context.getValue();
          if (status === 'paid') return <Badge tone="positive">To'landi</Badge>;
          if (status === 'overdue') {
            return <Badge tone="negative">Muddati o'tdi</Badge>;
          }
          if (status === 'none') return <Badge>—</Badge>;
          return <Badge tone="warning">Kutilmoqda</Badge>;
        },
      }),
    ],
    [selected],
  );

  const table = useReactTable({
    data: items,
    columns,
    state: { sorting, globalFilter: filter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const unpaid = items.filter((item) => (item.actual ?? 0) <= 0);

  const payAll = (): void => {
    startTransition(async () => {
      const result = await markManyPaid([...selected]);
      setMessage(result.message);
      setSelected(new Set());
    });
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Qidirish…"
          className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
        <button
          type="button"
          onClick={() => setSelected(new Set(unpaid.map((item) => item.id)))}
          className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm dark:border-neutral-700"
        >
          To'lanmaganlarni tanlash ({unpaid.length})
        </button>
        <button
          type="button"
          disabled={selected.size === 0 || pending}
          onClick={payAll}
          className="rounded-lg bg-[var(--color-brand-500)] px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {pending ? 'Yozilmoqda…' : `To'landi (${selected.size}) — 1 batch`}
        </button>
        {message ? (
          <span className="text-sm text-neutral-500">{message}</span>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-100 text-left dark:bg-neutral-900">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className={`p-3 font-medium ${
                      header.column.getCanSort() ? 'cursor-pointer select-none' : ''
                    }`}
                  >
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
                    {{ asc: ' ↑', desc: ' ↓' }[
                      header.column.getIsSorted() as string
                    ] ?? ''}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="border-t border-neutral-200 dark:border-neutral-800"
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className={`p-3 ${
                      ['planned', 'actual'].includes(cell.column.id)
                        ? 'tabular text-right'
                        : ''
                    }`}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
