/**
 * BR-060: 👤 fondga oylik ajratma (foiz rejimi) — serverdagi
 * `private.fund_allocation_amount` bilan bir xil: `round(daromad × foiz /
 * 100 / birlik) × birlik`; nol — ajratma yo'q (`null`).
 */
export function fundAllocation(income: number, percent: number, unit: number): number | null {
  const amount = Math.round((income * percent) / 100 / unit) * unit
  return amount === 0 ? null : amount
}
