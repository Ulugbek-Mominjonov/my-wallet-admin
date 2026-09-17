/** Ko'rsatish formatlari — Flutter ilovasidagi `Fmt` bilan bir xil. */
const MONTHS = [
  'Yanvar',
  'Fevral',
  'Mart',
  'Aprel',
  'May',
  'Iyun',
  'Iyul',
  'Avgust',
  'Sentabr',
  'Oktabr',
  'Noyabr',
  'Dekabr',
];

export const money = (value: number): string =>
  new Intl.NumberFormat('en-US').format(value).replace(/,/g, ' ');

export const moneyLong = (value: number): string => `${money(value)} so'm`;

export const moneyCompact = (value: number): string => {
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} mln`;
  if (absolute >= 1_000) return `${(value / 1_000).toFixed(0)} ming`;
  return money(value);
};

export const percent = (ratio: number): string => `${Math.round(ratio * 100)}%`;

export const monthTitle = (monthKey: string): string => {
  const month = Number(monthKey.slice(5, 7));
  return `${MONTHS[month - 1] ?? monthKey} ${monthKey.slice(0, 4)}`;
};

export const dayText = (value: unknown): string => {
  if (!value) return '';
  const date =
    value && typeof value === 'object' && 'toDate' in value
      ? (value as { toDate: () => Date }).toDate()
      : new Date(String(value));
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('ru-RU');
};
