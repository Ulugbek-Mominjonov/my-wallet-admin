import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { TEST_HOUSEHOLD_ID, WithHousehold } from '@/entities/household/testing'
import { GoalsPage } from '@/features/goals/ui/goals-page'
import { server, signInTestUser, supabasePath } from '@/shared/test/msw'
import { renderWithProviders } from '@/shared/test/render'

function renderPage() {
  server.use(
    http.get(supabasePath('/rest/v1/goals'), () =>
      HttpResponse.json([
        {
          id: 'g-trip',
          name: "Ta'til",
          currency: 'UZS',
          target: 2000000000,
          saved_manual: 500000000,
          monthly_contribution: 100000000,
          deadline: '2026-12-01',
          account_id: null,
          sort_order: 0,
        },
        {
          id: 'g-car',
          name: 'Mashina',
          currency: 'UZS',
          target: 10000000000,
          saved_manual: 0,
          monthly_contribution: null,
          deadline: null,
          account_id: null,
          sort_order: 1,
        },
      ]),
    ),
    http.get(supabasePath('/rest/v1/goal_progress'), () =>
      HttpResponse.json([
        {
          goal_id: 'g-trip',
          saved: 500000000,
          remaining: 1500000000,
          progress: 0.25,
          months_left: 15,
          end_month: '2027-12-01',
          on_track: false,
        },
        {
          goal_id: 'g-car',
          saved: 0,
          remaining: 10000000000,
          progress: 0,
          months_left: null,
          end_month: null,
          on_track: null,
        },
      ]),
    ),
  )
  renderWithProviders(
    <WithHousehold memberRole="member">
      <GoalsPage
        householdId={TEST_HOUSEHOLD_ID}
        currencies={[
          { value: 'UZS', label: 'UZS' },
          { value: 'USD', label: 'USD' },
        ]}
        accounts={[
          { id: 'a-dep', name: 'Omonat', currency: 'UZS' },
          { id: 'a-usd', name: 'Dollar hisob', currency: 'USD' },
        ]}
        baseCurrency="UZS"
      />
    </WithHousehold>,
  )
  return userEvent.setup()
}

describe('GoalsPage (E22-T06)', () => {
  beforeEach(() => {
    signInTestUser()
  })

  it('prognoz va muddatga ulgurmaslik (BR-121, BR-123)', async () => {
    renderPage()
    const trip = within(await screen.findByRole('row', { name: /Ta'til/ }))
    expect(trip.getByText('15 oy (Dekabr 2027)')).toBeInTheDocument()
    expect(trip.getByText('Ulgurmaydi')).toBeInTheDocument()
    expect(
      within(screen.getByRole('row', { name: /Mashina/ })).getByText("— oyiga ajratma yo'q"),
    ).toBeVisible()
  })

  it("member maqsad qo'shadi; hisobga bog'lash — shu valyutadagi hisoblar", async () => {
    const insert = vi.fn()
    server.use(
      http.post(supabasePath('/rest/v1/goals'), async ({ request }) => {
        insert(await request.json())
        return new HttpResponse(null, { status: 201 })
      }),
    )
    const user = renderPage()
    await screen.findByText("Ta'til")
    await user.click(screen.getByRole('button', { name: "Maqsad qo'shish" }))
    const form = await screen.findByRole('dialog', { name: 'Yangi maqsad' })
    await user.type(within(form).getByLabelText('Nomi'), 'Uy')
    await user.type(within(form).getByLabelText('Kerakli summa'), '500 000 000')
    await user.click(within(form).getByRole('combobox', { name: "Hisobga bog'lash" }))
    expect(screen.queryByRole('option', { name: 'Dollar hisob' })).toBeNull()
    await user.click(await screen.findByRole('option', { name: 'Omonat' }))
    expect(within(form).queryByLabelText("Yig'ilgan (qo'lda)")).toBeNull()
    await user.click(within(form).getByRole('button', { name: 'Saqlash' }))

    await waitFor(() => {
      expect(insert).toHaveBeenCalledWith({
        household_id: TEST_HOUSEHOLD_ID,
        currency: 'UZS',
        sort_order: 2,
        name: 'Uy',
        target: 50000000000,
        saved_manual: 0,
        monthly_contribution: null,
        deadline: null,
        account_id: 'a-dep',
      })
    })
  })
})
