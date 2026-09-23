import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'

import { TEST_HOUSEHOLD_ID, WithHousehold } from '@/entities/household/testing'
import { ObligationsReportPage } from '@/features/reports/ui/obligations-report-page'
import { server, signInTestUser, supabasePath } from '@/shared/test/msw'
import { renderWithProviders } from '@/shared/test/render'

const DEBTS = {
  debts: [
    {
      debt_id: 'd1',
      name: 'Mashina krediti',
      direction: 'i_owe',
      currency: 'UZS',
      total: 6000000000,
      paid_before: 1000000000,
      monthly_payment: 250000000,
      due_date: '2028-01-31',
      archived: false,
      paid_in_app: 500000000,
      pending_amount: 0,
      pending_count: 0,
      remaining: 4500000000,
      progress: 0.25,
      months_left: 18,
      end_month: '2028-03-01',
      status: 'paying',
    },
    {
      debt_id: 'd2',
      name: 'Do‘stdan',
      direction: 'owed_to_me',
      currency: 'UZS',
      total: 100000000,
      paid_before: 0,
      monthly_payment: null,
      due_date: null,
      archived: false,
      paid_in_app: 0,
      pending_amount: 0,
      pending_count: 0,
      remaining: 100000000,
      progress: 0,
      months_left: null,
      end_month: null,
      status: 'unlinked',
    },
  ],
  totals: {
    i_owe: 4500000000,
    owed_to_me: 100000000,
    monthly_obligation: 250000000,
    net: -4400000000,
    paid_this_month: 250000000,
  },
}

const GOALS = {
  avg_monthly_saved: 700000000,
  goals: [
    {
      goal_id: 'g1',
      name: 'Sayohat',
      currency: 'UZS',
      target: 1000000000,
      saved: 400000000,
      remaining: 600000000,
      progress: 0.4,
      monthly: 700000000,
      monthly_source: 'average',
      months_left: 1,
      end_month: '2026-10-01',
      deadline: '2026-12-31',
      on_track: true,
      account_id: null,
      achieved_at: null,
    },
    {
      goal_id: 'g2',
      name: 'Kvartira',
      currency: 'UZS',
      target: 50000000000,
      saved: 1000000000,
      remaining: 49000000000,
      progress: 0.02,
      monthly: 100000000,
      monthly_source: 'goal',
      months_left: 490,
      end_month: '2067-07-01',
      deadline: '2030-01-01',
      on_track: false,
      account_id: null,
      achieved_at: null,
    },
  ],
}

function renderPage({ debts = DEBTS, goals = GOALS } = {}) {
  server.use(
    http.post(supabasePath('/rest/v1/rpc/report_debts'), () => HttpResponse.json(debts)),
    http.post(supabasePath('/rest/v1/rpc/report_goals'), () => HttpResponse.json(goals)),
  )
  renderWithProviders(
    <WithHousehold>
      <ObligationsReportPage householdId={TEST_HOUSEHOLD_ID} baseCurrency="UZS" />
    </WithHousehold>,
  )
}

describe('ObligationsReportPage (E24-T04)', () => {
  beforeEach(() => {
    signInTestUser()
  })

  it('qarzlar: jamlar, progress, tugash oyi; oylik to‘lovsizida — chiziqcha', async () => {
    renderPage()
    const table = await screen.findByRole('table', { name: '💳 Qarzlar' })
    const paying = within(table).getByRole('row', { name: /Mashina krediti/ })
    expect(paying).toHaveTextContent("45 000 000 so'm")
    expect(paying).toHaveTextContent('Mart 2028')
    expect(within(paying).getByRole('progressbar')).toHaveAttribute('aria-valuetext', '25%')
    expect(within(table).getByRole('row', { name: /Do‘stdan/ })).toHaveTextContent('—')
    expect(screen.getByText("−44 000 000 so'm")).toBeInTheDocument()
  })

  it('maqsadlar: o‘rtachadan hisoblangan badal va ulgurish belgisi', async () => {
    renderPage()
    const table = await screen.findByRole('table', { name: '🎯 Maqsadlar' })
    const travel = within(table).getByRole('row', { name: /Sayohat/ })
    expect(travel).toHaveTextContent("o'rtachadan")
    expect(travel).toHaveTextContent('Ulguradi')
    expect(within(table).getByRole('row', { name: /Kvartira/ })).toHaveTextContent('Kechikadi')
  })

  it('bo‘sh holatlar', async () => {
    renderPage({ debts: { ...DEBTS, debts: [] }, goals: { ...GOALS, goals: [] } })
    expect(await screen.findByText("Qarz yo'q")).toBeInTheDocument()
    expect(screen.getByText("Maqsad yo'q")).toBeInTheDocument()
  })
})
