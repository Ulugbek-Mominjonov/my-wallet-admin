import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { TEST_HOUSEHOLD_ID, WithHousehold } from '@/entities/household/testing'
import { YearReportPage } from '@/features/reports/ui/year-report-page'
import { server, signInTestUser, supabasePath } from '@/shared/test/msw'
import { renderWithProviders } from '@/shared/test/render'

const month = (
  index: number,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  month: `2026-${String(index + 1).padStart(2, '0')}-01`,
  income: 0,
  expense: 0,
  allocated: 0,
  fund_spent: 0,
  balance: 0,
  forecast: 0,
  saved: 0,
  saved_ratio: 0,
  spent_ratio: 0,
  plan_ratio: null,
  closed: false,
  has_records: false,
  ...overrides,
})

const YEAR = {
  year: 2026,
  months: [
    month(0, {
      income: 700000000,
      expense: 60000000,
      balance: 640000000,
      saved: 640000000,
      saved_ratio: 0.91,
      has_records: true,
      closed: true,
    }),
    ...Array.from({ length: 7 }, (_, i) => month(i + 1)),
    month(8, {
      income: 800000000,
      expense: 30000000,
      balance: 770000000,
      saved: 770000000,
      saved_ratio: 0.96,
      has_records: true,
    }),
    ...Array.from({ length: 3 }, (_, i) => month(i + 9)),
  ],
  totals: {
    income: 1500000000,
    expense: 90000000,
    allocated: 0,
    fund_spent: 0,
    balance: 1410000000,
    forecast: 1410000000,
    saved: 1410000000,
    saved_ratio: 0.94,
    spent_ratio: 0.06,
    plan_ratio: null,
  },
}

function renderPage(data: object = YEAR) {
  server.use(http.post(supabasePath('/rest/v1/rpc/report_year'), () => HttpResponse.json(data)))
  const onYearChange = vi.fn()
  renderWithProviders(
    <WithHousehold>
      <YearReportPage
        householdId={TEST_HOUSEHOLD_ID}
        year={2026}
        currentYear={2026}
        onYearChange={onYearChange}
        baseCurrency="UZS"
      />
    </WithHousehold>,
  )
  return { onYearChange, user: userEvent.setup() }
}

describe('YearReportPage (E24-T03)', () => {
  beforeEach(() => {
    signInTestUser()
  })

  it('12 oy jadvali, JAMI qatori va yopilgan oy belgisi', async () => {
    renderPage()
    const table = await screen.findByRole('table', { name: 'Yillik ko‘rinish' })
    // 12 oy + sarlavha + JAMI.
    expect(within(table).getAllByRole('row')).toHaveLength(14)
    const total = within(table).getByRole('row', { name: /JAMI/ })
    expect(total).toHaveTextContent("15 000 000 so'm")
    expect(total).toHaveTextContent('94%')
    expect(within(table).getByLabelText('Yopilgan')).toBeInTheDocument()
  })

  it('grafik — 12 nuqta, jadval doim ko‘rinadi (almashtirish tugmasi yo‘q)', async () => {
    renderPage()
    const figure = await screen.findByRole('figure', {
      name: 'Daromad, xarajat va orttirish',
    })
    expect(within(figure).getByRole('img', { name: 'Daromad, Xarajat' })).toBeInTheDocument()
    expect(within(figure).queryByRole('button', { name: 'Jadval' })).toBeNull()
  })

  it('yil almashtirish; kelgusi yil tanlanmaydi', async () => {
    const { onYearChange, user } = renderPage()
    await screen.findByRole('table', { name: 'Yillik ko‘rinish' })
    expect(screen.getByRole('button', { name: 'Keyingi yil' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Oldingi yil' }))
    expect(onYearChange).toHaveBeenCalledWith(2025)
  })

  it('yozuvsiz yil — bo‘sh holat', async () => {
    renderPage({ ...YEAR, months: Array.from({ length: 12 }, (_, i) => month(i)) })
    expect(await screen.findByText("Bu yilda yozuv yo'q")).toBeInTheDocument()
  })
})
