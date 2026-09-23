import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, beforeEach } from 'vitest'

import { TEST_HOUSEHOLD_ID, WithHousehold } from '@/entities/household/testing'
import { ImportPage } from '@/features/tools/ui/import-page'
import { server, signInTestUser, supabasePath } from '@/shared/test/msw'
import { renderWithProviders } from '@/shared/test/render'

const CSV = [
  'Sana;Summa;Joy;Kategoriya;Hisob',
  '05.09.2026;-25 000,50;Makro;Oziq-ovqat;Naqd',
  '06.09.2026;-30 000;Korzinka;Yo‘q kategoriya;Naqd',
  '07.09.2026;-12 000;Taksi;Transport;Naqd',
].join('\n')

interface RpcCall {
  p_dry_run: boolean
  p_rows: { occurred_on: string | null; amount: number | null; payee: string }[]
}

const calls: RpcCall[] = []

const PREVIEW = {
  total: 3,
  ready: 1,
  imported: 0,
  duplicates: [{ index: 3, transaction_id: '0198f000-0000-7000-8000-0000000000aa' }],
  errors: [{ index: 2, code: 'category_not_found' }],
}

function renderPage() {
  server.use(
    http.post(supabasePath('/rest/v1/rpc/import_transactions'), async ({ request }) => {
      const body = (await request.json()) as RpcCall
      calls.push(body)
      return HttpResponse.json(body.p_dry_run ? PREVIEW : { ...PREVIEW, ready: 1, imported: 1 })
    }),
  )
  renderWithProviders(
    <WithHousehold>
      <ImportPage householdId={TEST_HOUSEHOLD_ID} baseCurrency="UZS" />
    </WithHousehold>,
  )
  return userEvent.setup()
}

const upload = (user: ReturnType<typeof userEvent.setup>, text = CSV) =>
  user.upload(
    screen.getByLabelText('CSV fayl'),
    new File([text], 'kochirma.csv', { type: 'text/csv' }),
  )

describe('ImportPage (E25-T03, BR-182)', () => {
  beforeEach(() => {
    signInTestUser()
    calls.length = 0
  })

  it('ustunlar sarlavhadan taxmin qilinadi, tekshiruvda hech narsa yozilmaydi', async () => {
    const user = renderPage()
    await upload(user)

    expect(await screen.findByText('Ustunlarni moslashtirish')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Tekshirish (yozilmaydi)' }))

    expect(await screen.findByText('Tayyor: 1')).toBeInTheDocument()
    expect(calls).toHaveLength(1)
    expect(calls[0]?.p_dry_run).toBe(true)
    // Sana ISO'ga, summa tiyinga o'tadi; sarlavha qatori yuborilmaydi.
    expect(calls[0]?.p_rows).toHaveLength(3)
    expect(calls[0]?.p_rows[0]).toMatchObject({
      occurred_on: '2026-09-05',
      amount: -2500050,
      payee: 'Makro',
    })

    expect(screen.getByText('Qatorlar: 3')).toBeInTheDocument()
    expect(screen.getByText('Dublikat: 1')).toBeInTheDocument()
    expect(screen.getByText('Xato: 1')).toBeInTheDocument()
    expect(screen.getByText('Kategoriya topilmadi')).toBeInTheDocument()
    expect(screen.getByText('Mavjud amal bilan bir xil')).toBeInTheDocument()
  })

  it('import faqat tekshiruvdan keyin yoziladi', async () => {
    const user = renderPage()
    await upload(user)

    const apply = await screen.findByRole('button', { name: 'Import qilish' })
    expect(apply).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Tekshirish (yozilmaydi)' }))
    expect(await screen.findByText('Tayyor: 1')).toBeInTheDocument()
    await user.click(apply)

    expect(await screen.findByText('1 ta amal import qilindi')).toBeInTheDocument()
    expect(calls[1]?.p_dry_run).toBe(false)
  })

  it('majburiy ustun topilmasa tekshirish boshlanmaydi', async () => {
    const user = renderPage()
    await upload(user, 'Sana;Summa;Joy\n05.09.2026;-25 000;Makro')

    expect(
      await screen.findByText('Sana, summa, kategoriya va hisob ustunlari tanlanishi kerak'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tekshirish (yozilmaydi)' })).toBeDisabled()
    expect(calls).toHaveLength(0)
  })
})
