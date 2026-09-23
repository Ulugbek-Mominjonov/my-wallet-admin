import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { TEST_HOUSEHOLD_ID, WithHousehold } from '@/entities/household/testing'
import { HealthPage } from '@/features/tools/ui/health-page'
import { server, signInTestUser, supabasePath } from '@/shared/test/msw'
import { renderWithProviders } from '@/shared/test/render'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children?: ReactNode }) => <a href="/">{children}</a>,
}))

const INFO = {
  transactions: 12,
  planned_items: 3,
  first_month: '2026-01-01',
  opened_months: ['2026-09-01'],
  closed_months: [],
  income_rules: [{ name: 'Oylik', month_shift: -1 }],
}

const HEALTH = {
  problems: [
    { code: 'month_not_opened', count: 2 },
    {
      code: 'debt_unlinked',
      debt_id: 'd1',
      name: 'Mashina krediti',
      suggestions: [
        { transaction_id: 't1', occurred_on: '2026-09-05', amount: 25000000, payee: 'Bank' },
        { transaction_id: 't2', occurred_on: '2026-09-06', amount: 25000000, payee: null },
      ],
    },
  ],
  warnings: [{ code: 'negative_cash', account_id: 'a1', balance: -5000000 }],
  info: INFO,
}

function renderPage(health: object = HEALTH) {
  const patched: Record<string, unknown>[] = []
  server.use(
    http.post(supabasePath('/rest/v1/rpc/health_check'), () => HttpResponse.json(health)),
    http.patch(supabasePath('/rest/v1/transactions'), async ({ request }) => {
      patched.push({
        id: new URL(request.url).searchParams.get('id'),
        ...((await request.json()) as object),
      })
      return new HttpResponse(null, { status: 204 })
    }),
  )
  renderWithProviders(
    <WithHousehold>
      <HealthPage householdId={TEST_HOUSEHOLD_ID} baseCurrency="UZS" />
    </WithHousehold>,
  )
  return { patched, user: userEvent.setup() }
}

describe('HealthPage (E25-T01)', () => {
  beforeEach(() => {
    signInTestUser()
  })

  it('muammo va ogohlantirishlar o‘qiladigan matn bilan, har biri yonida amal', async () => {
    renderPage()
    expect(await screen.findByText(/Ochilmagan oylar: 2 ta/)).toBeInTheDocument()
    expect(screen.getByText(/Naqd hisob qoldig'i manfiy: −50 000 so'm/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Rejalarga o‘tish' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Hisoblarga o‘tish' })).toBeInTheDocument()
  })

  it('BR-131: o‘xshash xarajatni qarzga bog‘lash', async () => {
    const { patched, user } = renderPage()
    await user.click(await screen.findByRole('button', { name: "Qarzga bog'lash" }))
    const dialog = await screen.findByRole('dialog', {
      name: "«Mashina krediti» qarziga bog'lash",
    })
    expect(within(dialog).getByText('Bank')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: "Bog'lash" })).toBeDisabled()

    // Sana ko'rinishi ICU versiyasiga bog'liq — qatorni joy nomidan topamiz.
    const row = within(dialog).getByRole('row', { name: /Bank/ })
    await user.click(within(row).getByRole('button'))
    await user.click(within(dialog).getByRole('button', { name: "Bog'lash" }))
    await waitFor(() => {
      expect(patched[0]).toMatchObject({ id: 'eq.t1', debt_id: 'd1' })
    })
  })

  it('muammo yo‘q — tinch holat va ma’lumot bo‘limi', async () => {
    renderPage({ problems: [], warnings: [], info: INFO })
    expect(await screen.findByText('Muammo topilmadi — hammasi joyida')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('Oylik')).toBeInTheDocument()
  })
})
