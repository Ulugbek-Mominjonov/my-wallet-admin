import { Download } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { CsvRow } from '@/shared/lib/csv'
import { downloadCsv } from '@/shared/lib/download'
import { Button } from '@/shared/ui/button'

/**
 * Hisobotni CSV qilib yuklab olish (BR-180). Qatorlar bosilganda quriladi —
 * sahifa har renderda jadval yasamaydi.
 */
export function ExportCsvButton({ fileName, rows }: { fileName: string; rows: () => CsvRow[] }) {
  const { t } = useTranslation()
  return (
    <Button
      variant="outline"
      className="print:hidden"
      onClick={() => {
        downloadCsv(fileName, rows())
      }}
    >
      <Download aria-hidden />
      {t('common.exportCsv')}
    </Button>
  )
}
