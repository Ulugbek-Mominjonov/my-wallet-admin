import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { TEST_HOUSEHOLD_ID, WithHousehold } from '@/entities/household/testing'
import { DashboardPage } from '@/features/reports/ui/dashboard-page'
import { server, signInTestUser, supabasePath } from '@/shared/test/msw'
import { MONTH_REPORT, reportCategory, SAVINGS_REPORT } from '@/features/reports/testing'
import { renderWithProviders } from '@/shared/test/render'

// Havolalar (rejalarga o'tish) — routersiz testda oddiy <a>.
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children?: ReactNode }) => <a href="/">{children}</a>,
}))

function mockReports({ report = MONTH_REPORT }: { report?: object } = {}) {
  server.use(
    http.post(supabasePath('/rest/v1/rpc/report_month'), () => HttpResponse.json(report)),
    http.post(supabasePath('/rest/v1/rpc/report_savings'), () => HttpResponse.json(SAVINGS_REPORT)),
  )
}

const renderPage = (health = { problems: 1, warnings: 0 }) =>
  renderWithProviders(
    <WithHousehold>
      <DashboardPage
        householdId={TEST_HOUSEHOLD_ID}
        month="2026-09"
        baseCurrency="UZS"
        health={health}
      />
    </WithHousehold>,
  )

describe('DashboardPage (E24-T01)', () => {
  beforeEach(() => {
    signInTestUser()
  })

  it('joriy oy ko‘rsatkichlari: qoldiq, prognoz, orttirgan % va kunlik chegara', async () => {
    mockReports()
    renderPage()

    // Qoldiq va orttirgan bu oyda teng — ikkala kartada bir xil summa.
    expect(await screen.findAllByText("7 700 000 so'm")).toHaveLength(2)
    expect(screen.getByText("7 590 909 so'm")).toBeInTheDocument()
    expect(screen.getByText('Daromadning 96%')).toBeInTheDocument()
    expect(screen.getByText("900 000 so'm")).toBeInTheDocument()
    expect(screen.getByText('8 kun qoldi')).toBeInTheDocument()
  })

  it('grafik jadval ko‘rinishiga almashadi (rang yagona belgi emas)', async () => {
    mockReports()
    const user = userEvent.setup()
    renderPage()

    const figure = await screen.findByRole('figure', { name: 'Daromad va xarajat' })
    expect(within(figure).getByRole('img', { name: 'Daromad, Xarajat' })).toBeInTheDocument()

    await user.click(within(figure).getByRole('button', { name: 'Jadval' }))
    const table = within(figure).getByRole('table', { name: 'Daromad va xarajat' })
    expect(within(table).getAllByRole('row')).toHaveLength(3)
    expect(table).toHaveTextContent("6 400 000 so'm")
  })

  it('ko‘p sarflangan kategoriyalar — ulush bilan, xarajatsizlari yo‘q', async () => {
    mockReports()
    renderPage()

    const figure = await screen.findByRole('figure', { name: 'Ko‘p sarflangan kategoriyalar' })
    expect(within(figure).getByText(/Oziq-ovqat/)).toBeInTheDocument()
    expect(within(figure).getByText(/200 000 so'm · 67%/)).toBeInTheDocument()
    expect(within(figure).queryByText('Kiyim')).toBeNull()
  })

  it('yaqin to‘lovlar muddati bo‘yicha; summasi noma’lumi "?" bilan', async () => {
    mockReports()
    renderPage()

    // Muddati yaqinroq (05.09) — birinchi; summasi noma'lum "?" bilan.
    const ijara = (await screen.findByText('Ijara')).closest('li')
    expect(ijara).toHaveTextContent('?')
    expect(ijara).toHaveTextContent('05')
    const internet = screen.getByText('Internet').closest('li')
    expect(internet).toHaveTextContent("100 000 so'm")
    expect(internet).toHaveTextContent("Avto to'lov")
    expect(ijara?.compareDocumentPosition(internet as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })

  it('ogohlantirishlar: limit, kechikkan reja va tekshiruv muammolari', async () => {
    mockReports()
    renderPage()

    expect(await screen.findByText('Limitdan oshgan: 1')).toBeInTheDocument()
    expect(screen.getByText('Limitga yaqin: 1')).toBeInTheDocument()
    expect(screen.getByText("Muddati o'tgan rejalar: 1")).toBeInTheDocument()
    expect(screen.getByText('Tekshiruv muammolari: 1')).toBeInTheDocument()
  })

  it('muammo yo‘q bo‘lsa — tinch holat', async () => {
    mockReports({
      // Limitsiz va kechikmagan oy.
      report: {
        ...MONTH_REPORT,
        by_category: [reportCategory('c-food', 'Oziq-ovqat', 20000000)],
        unpaid: [{ ...MONTH_REPORT.unpaid[0], status: 'pending' }],
      },
    })
    renderPage({ problems: 0, warnings: 0 })
    expect(await screen.findByText('Muammo topilmadi')).toBeInTheDocument()
  })
})
