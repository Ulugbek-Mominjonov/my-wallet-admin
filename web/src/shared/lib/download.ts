import { toCsvRows, type CsvRow } from '@/shared/lib/csv'

/** Brauzerda fayl yuklab olish (Blob → vaqtinchalik havola). */
export function downloadFile(name: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
}

/** Hisobot jadvalini CSV qilib yuklab olish (sarlavha — birinchi qator). */
export function downloadCsv(name: string, rows: readonly CsvRow[]): void {
  downloadFile(name, toCsvRows(rows), 'text/csv;charset=utf-8')
}
