import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'

import type { Account } from '@/entities/account'
import { TEST_HOUSEHOLD_ID, WithHousehold } from '@/entities/household/testing'
import { SAVINGS_REPORT } from '@/features/reports/testing'
import { SavingsReportPage } from '@/features/reports/ui/savings-report-page'
import { server, signInTestUser, supabasePath } from '@/shared/test/msw'
import { renderWithProviders } from '@/shared/test/render'

const account = (id: string, name: string, balance: number, currency = 'UZS'): Account => ({
  id,
  name,
  type: 'cash',
  currency,
  openingBalance: 0,
  openingDate: '2026-01-01',
  icon: null,
  color: null,
  cardLast4: null,
  sortOrder: 0,
  archivedAt: null,
  balance,
})

const FUND = {
  balance: 5000000,
  total_allocated: 8000000,
  total_spent: 3000000,
  months: [{ month: '2026-09-01', allocated: 8000000, spent: 3000000 }],
  spends: [
    {
      id: 'f1',
      occurred_on: '2026-09-10',
      amount: 3000000,
      category_id: null,
      payee: 'Kitob',
      note: null,
    },
  ],
}

function renderPage(savings: object = SAVINGS_REPORT) {
  server.use(
    http.post(supabasePath('/rest/v1/rpc/report_savings'), () => HttpResponse.json(savings)),
    http.post(supabasePath('/rest/v1/rpc/report_personal_fund'), () => HttpResponse.json(FUND)),
  )
  renderWithProviders(
    <WithHousehold>
      <SavingsReportPage
        householdId={TEST_HOUSEHOLD_ID}
        currentMonth="2026-09"
        baseCurrency="UZS"
        accounts={[account('a1', 'Naqd', 40000000), account('a2', 'Dollar', 10000, 'USD')]}
      />
    </WithHousehold>,
  )
}

describe('SavingsReportPage (E24-T04)', () => {
  beforeEach(() => {
    signInTestUser()
  })

  it('oylar jadvali: yangisi yuqorida, joriy oyda ⏳ belgisi', async () => {
    renderPage()
    const table = await screen.findByRole('table', { name: 'Jamg‘arma' })
    const rows = within(table).getAllByRole('row')
    expect(rows[1]).toHaveTextContent('Sentabr 2026')
    expect(rows[1]).toHaveTextContent('⏳')
    expect(rows[2]).toHaveTextContent('Avgust 2026')
    // To'plangan (accumulated) ustuni.
    expect(rows[1]).toHaveTextContent("14 100 000 so'm")
  })

  it('👤 fond: jamlar va sarflar daftari', async () => {
    renderPage()
    expect(await screen.findByText("80 000 so'm")).toBeInTheDocument()
    const spends = screen.getByRole('table', { name: 'Sarflar' })
    expect(within(spends).getByText('Kitob')).toBeInTheDocument()
    expect(within(spends).getByText("30 000 so'm")).toBeInTheDocument()
  })

  it('hisoblar qoldig‘i: har biri o‘z valyutasida, jami — asosiy valyutada', async () => {
    renderPage()
    const table = await screen.findByRole('table', { name: 'Hisoblar qoldig‘i' })
    expect(within(table).getByText('Naqd')).toBeInTheDocument()
    expect(within(table).getByText('100,00 $')).toBeInTheDocument()
    const total = within(table).getByRole('row', { name: /JAMI/ })
    expect(total).toHaveTextContent("400 000 so'm")
  })

  it('yozuvsiz byudjet — bo‘sh holat', async () => {
    renderPage({ ...SAVINGS_REPORT, months: [] })
    expect(await screen.findByText("Hali yozuv yo'q")).toBeInTheDocument()
  })
})
