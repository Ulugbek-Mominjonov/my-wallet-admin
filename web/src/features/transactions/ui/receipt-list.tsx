import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { receiptsQuery } from '@/features/transactions/api/transactions-api'
import { Skeleton } from '@/shared/ui/skeleton'

/** BR-201: amal cheklari — kichik rasm, bosilsa to'liq o'lchamda (yangi oynada). */
export function ReceiptList({
  householdId,
  transactionId,
}: {
  householdId: string
  transactionId: string
}) {
  const { t } = useTranslation()
  const receipts = useQuery(receiptsQuery(householdId, transactionId))

  return (
    <section aria-labelledby="tx-receipts" className="grid gap-1.5">
      <h3 id="tx-receipts" className="text-sm font-medium">
        {t('transactions.form.receipts')}
      </h3>
      {receipts.isPending ? (
        <Skeleton className="size-20" />
      ) : receipts.error ? (
        <p role="alert" className="text-sm text-destructive">
          {receipts.error.message}
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {receipts.data.map((receipt, index) => (
            <li key={receipt.id}>
              <a href={receipt.url} target="_blank" rel="noreferrer">
                <img
                  src={receipt.url}
                  alt={t('transactions.form.receipt', { n: index + 1 })}
                  className="size-20 rounded-md border object-cover"
                />
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
