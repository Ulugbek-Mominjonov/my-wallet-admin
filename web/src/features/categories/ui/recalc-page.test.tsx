import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'

import { TEST_HOUSEHOLD_ID, WithHousehold } from '@/entities/household/testing'
import { RecalcPage } from '@/features/categories/ui/recalc-page'
import { server, signInTestUser, supabasePath } from '@/shared/test/msw'
import { renderWithProviders } from '@/shared/test/render'

const ROWS = {
  total: 1,
  rows: [
    {
      id: '0198f000-0000-7000-8000-0000000000a1',
      occurred_on: '2026-10-02',
      payee: 'Ish joyi',
      category: 'Oylik',
      amount_base: 800000000,
      from_month: '2026-09-01',
      to_month: '2026-10-01',
    },
  ],
}

const applied: { p_expected_count: number }[] = []

function renderPage(data: typeof ROWS = ROWS) {
  server.use(
    http.post(supabasePath('/rest/v1/rpc/recalc_income_months_rows'), () =>
      HttpResponse.json(data),
    ),
    http.post(supabasePath('/rest/v1/rpc/recalc_income_months_apply'), async ({ request }) => {
      applied.push((await request.json()) as { p_expected_count: number })
      return HttpResponse.json({ moved: data.total })
    }),
  )
  renderWithProviders(
    <WithHousehold>
      <RecalcPage householdId={TEST_HOUSEHOLD_ID} baseCurrency="UZS" />
    </WithHousehold>,
  )
  return userEvent.setup()
}

describe('RecalcPage (E25-T04, BR-043)', () => {
  beforeEach(() => {
    signInTestUser()
    applied.length = 0
  })

  it('har yozuv ko‘rinadi: turi, summa, eski oy → yangi oy', async () => {
    renderPage()
    expect(await screen.findByText('Oylik')).toBeInTheDocument()
    expect(screen.getByText('Ish joyi')).toBeInTheDocument()
    expect(screen.getByText("8 000 000 so'm")).toBeInTheDocument()
    expect(screen.getByText('Sentabr 2026 → Oktabr 2026')).toBeInTheDocument()
  })

  it('tasdiqdan keyin preview soni bilan qo‘llanadi', async () => {
    const user = renderPage()
    await user.click(await screen.findByRole('button', { name: 'Qayta joylash' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/1 ta amalning tegishli oyi/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Qayta joylash' }))
    expect(await screen.findByText('1 ta amal qayta joylandi')).toBeInTheDocument()
    expect(applied).toEqual([{ p_household: TEST_HOUSEHOLD_ID, p_expected_count: 1 }])
  })

  it('ko‘chadigan amal bo‘lmasa — bo‘sh holat, tugma yo‘q', async () => {
    renderPage({ total: 0, rows: [] })
    expect(await screen.findByText("Ko'chadigan amal yo'q — hammasi joyida.")).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Qayta joylash' })).toBeNull()
  })
})
