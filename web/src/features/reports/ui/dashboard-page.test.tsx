import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { TEST_HOUSEHOLD_ID, WithHousehold } from '@/entities/household/testing'
import { DashboardPage } from '@/features/reports/ui/dashboard-page'
import { server, signInTestUser, supabasePath } from '@/shared/test/msw'
import { renderWithProviders } from '@/shared/test/render'

// Havolalar (rejalarga o'tish) — routersiz testda oddiy <a>.
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children?: ReactNode }) => <a href="/">{children}</a>,
}))

const category = (
  id: string,
  name: string,
  actualTotal: number,
  extra: Record<string, unknown> = {},
) => ({
  category_id: id,
  name,
  parent_id: null,
  planned: 0,
  actual: actualTotal,
  actual_total: actualTotal,
  limit: null,
  limit_ratio: null,
  limit_status: null,
  ...extra,
})

const REPORT = {
  month: '2026-09-01',
  closed: false,
  is_current: true,
  totals: {
    income: 800000000,
    income_card: 800000000,
    income_cash: 0,
    expense: 30000000,
    expense_card: 20000000,
    expense_cash: 10000000,
    planned: 50000000,
    unpaid: 20000000,
    unknown_count: 1,
    allocated: 8000000,
    fund_spent: 0,
  },
  derived: {
    balance: 770000000,
    forecast: 750000000,
    saved: 770000000,
    saved_ratio: 0.9625,
    spent_ratio: 0.0375,
    plan_ratio: null,
    card: 0,
    cash: 0,
  },
  projection: {
    days_in_month: 30,
    days_elapsed: 22,
    daily_spend: 1363636,
    month_end_spend: 40909090,
    income_received: 800000000,
    income_expected: 800000000,
    income_pending: false,
    month_end_balance: 759090910,
    per_day_available: 90000000,
  },
  by_type: [],
  by_category: [
    category('c-food', 'Oziq-ovqat', 20000000, {
      limit: 15000000,
      limit_ratio: 1.33,
      limit_status: 'over',
    }),
    category('c-transport', 'Transport', 10000000, { limit_status: 'near' }),
    category('c-clothes', 'Kiyim', 0),
  ],
  unpaid: [
    {
      id: 'p-internet',
      kind: 'expense',
      name: 'Internet',
      category_id: null,
      planned_amount: 15000000,
      paid_amount: 5000000,
      due_date: '2026-09-25',
      auto_pay: true,
      status: 'pending',
    },
    {
      id: 'p-ijara',
      kind: 'expense',
      name: 'Ijara',
      category_id: null,
      planned_amount: null,
      paid_amount: 0,
      due_date: '2026-09-05',
      auto_pay: false,
      status: 'overdue',
    },
  ],
  fund: { allocated: 8000000, spent: 0, balance: 8000000 },
  savings: { before: 0, this_month: 770000000, total: 770000000 },
  debts: { i_owe: 0, owed_to_me: 0, monthly_obligation: 0, net: 0, paid_this_month: 0 },
  goals: [],
}

const SAVINGS = {
  months: [
    {
      month: '2026-08-01',
      income: 700000000,
      expense: 60000000,
      balance: 640000000,
      accumulated: 640000000,
      is_current: false,
    },
    {
      month: '2026-09-01',
      income: 800000000,
      expense: 30000000,
      balance: 770000000,
      accumulated: 1410000000,
      is_current: true,
    },
  ],
  summary: {
    months_count: 2,
    total_income: 1500000000,
    total_expense: 90000000,
    total_balance: 1410000000,
    total_saved: 1410000000,
    avg_monthly_saved: 705000000,
    avg_monthly_expense: 45000000,
  },
}

function mockReports({
  health = { problems: [{ code: 'month_not_opened' }], warnings: [] },
  report = REPORT,
}: { health?: object; report?: object } = {}) {
  server.use(
    http.post(supabasePath('/rest/v1/rpc/report_month'), () => HttpResponse.json(report)),
    http.post(supabasePath('/rest/v1/rpc/report_savings'), () => HttpResponse.json(SAVINGS)),
    http.post(supabasePath('/rest/v1/rpc/health_check'), () => HttpResponse.json(health)),
  )
}

const renderPage = () =>
  renderWithProviders(
    <WithHousehold>
      <DashboardPage householdId={TEST_HOUSEHOLD_ID} month="2026-09" baseCurrency="UZS" />
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
      health: { problems: [], warnings: [] },
      // Limitsiz va kechikmagan oy.
      report: {
        ...REPORT,
        by_category: [category('c-food', 'Oziq-ovqat', 20000000)],
        unpaid: [{ ...REPORT.unpaid[0], status: 'pending' }],
      },
    })
    renderPage()
    expect(await screen.findByText('Muammo topilmadi')).toBeInTheDocument()
  })
})
