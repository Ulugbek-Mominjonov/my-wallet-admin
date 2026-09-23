import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'

import { PlatformRatesPage } from '@/features/platform/ui/rates-page'
import { server, signInTestUser, supabasePath } from '@/shared/test/msw'
import { renderWithProviders } from '@/shared/test/render'
import { Toaster } from '@/shared/ui/sonner'

const CURRENCIES = [
  {
    code: 'UZS',
    name_i18n: { uz: "O'zbek so'mi", ru: 'Сум', en: 'Som' },
    symbol: "so'm",
    exponent: 2,
    active: true,
    sort_order: 1,
  },
  {
    code: 'USD',
    name_i18n: { uz: 'AQSh dollari', ru: 'Доллар', en: 'US dollar' },
    symbol: '$',
    exponent: 2,
    active: true,
    sort_order: 2,
  },
]

const RATES = [
  { currency: 'USD', rate_date: '2026-09-22', rate_to_base: 12700, source: 'CBU' },
  { currency: 'USD', rate_date: '2026-09-21', rate_to_base: 12680.5, source: 'manual' },
]

const writes: unknown[] = []

function renderPage() {
  server.use(
    http.get(supabasePath('/rest/v1/currencies'), () => HttpResponse.json(CURRENCIES)),
    http.get(supabasePath('/rest/v1/exchange_rates'), () => HttpResponse.json(RATES)),
    http.post(supabasePath('/rest/v1/exchange_rates'), async ({ request }) => {
      writes.push(await request.json())
      return new HttpResponse(null, { status: 201 })
    }),
  )
  renderWithProviders(
    <>
      <PlatformRatesPage />
      <Toaster />
    </>,
  )
  return userEvent.setup()
}

describe('PlatformRatesPage (E29-T04)', () => {
  beforeEach(() => {
    signInTestUser()
    writes.length = 0
  })

  it('tarix: CBU va qo‘lda kiritilgan kurslar', async () => {
    renderPage()
    const table = await screen.findByRole('table', { name: 'USD kurslari' })
    expect(table).toHaveTextContent('12700')
    expect(table).toHaveTextContent('12680.5')
    expect(table).toHaveTextContent("Qo'lda")
    expect(table).toHaveTextContent('CBU')
  })

  it('qo‘lda kurs: noto‘g‘ri son saqlanmaydi', async () => {
    const user = renderPage()
    await screen.findByRole('table', { name: 'USD kurslari' })
    const save = screen.getByRole('button', { name: 'Saqlash' })
    expect(save).toBeDisabled()

    await user.type(screen.getByLabelText('Sana'), '2026-09-23')
    await user.type(screen.getByLabelText('1 USD = ? UZS'), '12 700')
    expect(screen.getByText(/Kurs musbat son/)).toBeInTheDocument()
    expect(save).toBeDisabled()
  })

  it('to‘g‘ri kurs `manual` manba bilan yoziladi', async () => {
    const user = renderPage()
    await screen.findByRole('table', { name: 'USD kurslari' })
    await user.type(screen.getByLabelText('Sana'), '2026-09-23')
    await user.type(screen.getByLabelText('1 USD = ? UZS'), '12750.25')
    await user.click(screen.getByRole('button', { name: 'Saqlash' }))

    expect(await screen.findByText('Kurs saqlandi')).toBeInTheDocument()
    expect(writes).toEqual([
      { currency: 'USD', rate_date: '2026-09-23', rate_to_base: 12750.25, source: 'manual' },
    ])
  })
})
