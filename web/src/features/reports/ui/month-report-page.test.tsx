import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { TEST_HOUSEHOLD_ID, WithHousehold } from '@/entities/household/testing'
import { MONTH_REPORT, SAVINGS_REPORT } from '@/features/reports/testing'
import { MonthReportPage } from '@/features/reports/ui/month-report-page'
import { server, signInTestUser, supabasePath } from '@/shared/test/msw'
import { renderWithProviders } from '@/shared/test/render'

const INCOME_TYPES = [
  { category_id: 'c-salary', name: 'Oylik', card: 700000000, cash: 0 },
  { category_id: 'c-extra', name: "Qo'shimcha", card: 0, cash: 50000000 },
]

function mockReport(overrides: Record<string, unknown> = {}) {
  server.use(
    http.post(supabasePath('/rest/v1/rpc/report_month'), () =>
      HttpResponse.json({ ...MONTH_REPORT, by_type: INCOME_TYPES, ...overrides }),
    ),
    http.post(supabasePath('/rest/v1/rpc/report_savings'), () => HttpResponse.json(SAVINGS_REPORT)),
  )
}

/** Bo'lim kartasi — sarlavhasi bo'yicha (bir xil summa bir necha bo'limda bo'ladi). */
async function cardOf(title: string): Promise<HTMLElement> {
  const heading = await screen.findByRole('heading', { name: title })
  const card = heading.closest('[data-slot="card"]')
  if (!card) throw new Error(`Karta topilmadi: ${title}`)
  return card as HTMLElement
}

const renderPage = (month = '2026-09' as const) => {
  const onMonthChange = vi.fn()
  renderWithProviders(
    <WithHousehold>
      <MonthReportPage
        householdId={TEST_HOUSEHOLD_ID}
        month={month}
        currentMonth="2026-09"
        onMonthChange={onMonthChange}
        baseCurrency="UZS"
      />
    </WithHousehold>,
  )
  return { onMonthChange, user: userEvent.setup() }
}

describe('MonthReportPage (E24-T02)', () => {
  beforeEach(() => {
    signInTestUser()
  })

  it('yakun: daromad, xarajat (ajratma bilan), reja, to‘lanmagan (+ noma’lumlar soni)', async () => {
    mockReport()
    renderPage()

    const summary = await cardOf('Yakun')
    expect(within(summary).getByText("8 000 000 so'm")).toBeInTheDocument()
    expect(within(summary).getByText("300 000 so'm")).toBeInTheDocument()
    expect(within(summary).getByText("shundan ajratma: 80 000 so'm")).toBeInTheDocument()
    expect(within(summary).getByText('+ 1 ta ?')).toBeInTheDocument()
    // spent_ratio 0.0375 → 4%.
    expect(within(summary).getByText('4%')).toBeInTheDocument()
  })

  it('daromad matritsasi: tur × karta/naqd va JAMI; ro‘yxatdan tashqari daromad ogohlantirishi', async () => {
    mockReport()
    renderPage()

    const table = await screen.findByRole('table', { name: 'Daromad turlari' })
    const rows = within(table).getAllByRole('row')
    expect(rows).toHaveLength(4)
    expect(rows.at(-1)).toHaveTextContent('JAMI')
    // 8 000 000 − (7 000 000 + 500 000) = 500 000.
    expect(screen.getByRole('status')).toHaveTextContent(
      "Ro'yxatdan tashqari daromad: 500 000 so'm",
    )
  })

  it('kategoriya va limit: faqat harakat bo‘lganlari, foiz holati bilan', async () => {
    mockReport()
    renderPage()

    const table = await screen.findByRole('table', { name: 'Kategoriyalar va limitlar' })
    expect(within(table).getByText('Oziq-ovqat')).toBeInTheDocument()
    // Limiti yo'q va xarajatsiz kategoriya ko'rinmaydi.
    expect(within(table).queryByText('Kiyim')).toBeNull()
    expect(within(table).getByRole('progressbar')).toHaveAttribute('aria-valuetext', '133%')
  })

  it('prognoz: kutilayotgan daromadda "hozircha kelgani" izohi', async () => {
    mockReport({ projection: { ...MONTH_REPORT.projection, income_pending: true } })
    renderPage()
    expect(await screen.findByText("hozircha kelgani: 8 000 000 so'm")).toBeInTheDocument()
  })

  it('yopilgan oyda 🔒 belgisi', async () => {
    mockReport({ closed: true })
    renderPage()
    expect(await screen.findByText('Yopilgan')).toBeInTheDocument()
  })

  it('oy almashtirish sarlavhadan', async () => {
    mockReport()
    const { onMonthChange, user } = renderPage()
    await cardOf('Yakun')
    await user.click(screen.getByRole('button', { name: 'Oldingi oy' }))
    expect(onMonthChange).toHaveBeenCalledWith('2026-08')
  })
})
