/**
 * Kirishdan keyingi manzil — faqat shu ilova ichidagi yo'l (`/...`).
 * Tashqi havola (`//evil`, `https://...`) — ochiq redirect zaifligi; bosh sahifa.
 */
export function safeRedirect(value: unknown): string {
  if (typeof value !== 'string') return '/'
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return '/'
  return value
}
