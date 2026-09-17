'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { moneyCompact } from '@/lib/format';

/** 🏦 Jamg'armaning to'planish grafigi (mobil ilovadagi bilan bir xil). */
export function SavingsChart({
  points,
}: {
  points: { month: string; cumulative: number; balance: number }[];
}) {
  if (points.length < 2) {
    return (
      <p className="py-10 text-center text-sm text-neutral-400">
        Grafik uchun kamida ikkita oy kerak
      </p>
    );
  }
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={(value: number) => moneyCompact(value)}
            width={70}
          />
          <Tooltip
            formatter={(value: number) => moneyCompact(value)}
            labelClassName="text-xs"
          />
          <Area
            type="monotone"
            dataKey="cumulative"
            stroke="var(--color-brand-500)"
            fill="var(--color-brand-500)"
            fillOpacity={0.15}
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
