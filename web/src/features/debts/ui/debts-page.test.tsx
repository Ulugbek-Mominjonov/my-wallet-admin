import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { TEST_HOUSEHOLD_ID, WithHousehold } from '@/entities/household/testing'
import { DebtsPage } from '@/features/debts/ui/debts-page'
import { server, signInTestUser, supabasePath } from '@/shared/test/msw'
import { renderWithProviders } from '@/shared/test/render'

const debt = (
  id: string,
  name: string,
  direction: string,
  total: number,
  monthly: number | null,
) => ({
  id,
  name,
  direction,
  currency: 'UZS',
  total,
  paid_before: 0,
  monthly_payment: monthly,
  due_date: null,
  note: null,
  archived_at: null,
})

function renderPage(role: 'owner' | 'viewer' = 'owner') {
  server.use(
    http.get(supabasePath('/rest/v1/debts'), () =>
      HttpResponse.json([
        debt('d-car', 'Mashina krediti', 'i_owe', 6000000000, 250000000),
        debt('d-friend', 'Akmalga qarz', 'owed_to_me', 100000000, null),
      ]),
    ),
    http.get(supabasePath('/rest/v1/debt_balances'), () =>
      HttpResponse.json([
        {
          debt_id: 'd-car',
          paid_in_app: 1000000000,
          pending_amount: 250000000,
          remaining: 5000000000,
          progress: 0.1667,
          months_left: 20,
          end_month: '2028-05-01',
          status: 'paying',
        },
        {
          debt_id: 'd-friend',
          paid_in_app: 0,
          pending_amount: 0,
          remaining: 100000000,
          progress: 0,
          months_left: null,
          end_month: null,
          status: 'unlinked',
        },
      ]),
    ),
  )
  renderWithProviders(
    <WithHousehold memberRole={role}>
      <DebtsPage
        householdId={TEST_HOUSEHOLD_ID}
        currencies={[{ value: 'UZS', label: 'UZS' }]}
        baseCurrency="UZS"
      />
    </WithHousehold>,
  )
  return userEvent.setup()
}

describe('DebtsPage (E22-T06)', () => {
  beforeEach(() => {
    signInTestUser()
  })

  it('jami (BR-114), qolgan, kutilmoqda, tugash oyi va holat', async () => {
    renderPage()
    const car = within(await screen.findByRole('row', { name: /Mashina krediti/ }))
    expect(car.getByText("50 000 000 so'm")).toBeInTheDocument()
    expect(car.getByText("kutilmoqda: 2 500 000 so'm")).toBeInTheDocument()
    expect(car.getByText('20 oy (May 2028)')).toBeInTheDocument()
    expect(car.getByText("To'lanyapti")).toBeInTheDocument()
    expect(
      within(screen.getByRole('row', { name: /Akmalga/ })).getByText("Bog'lanmagan"),
    ).toBeVisible()

    expect(
      screen.getByText('Oylik majburiyat').parentElement?.nextElementSibling,
    ).toHaveTextContent("2 500 000 so'm")
    expect(screen.getByText('Sof holat').parentElement?.nextElementSibling).toHaveTextContent(
      "−49 000 000 so'm",
    )
  })

  it("yangi qarz — summalar tiyinda; tahrirda yo'nalish va valyuta qulf", async () => {
    const insert = vi.fn()
    server.use(
      http.post(supabasePath('/rest/v1/debts'), async ({ request }) => {
        insert(await request.json())
        return new HttpResponse(null, { status: 201 })
      }),
    )
    const user = renderPage()
    await screen.findByText('Mashina krediti')
    await user.click(screen.getByRole('button', { name: "Qarz qo'shish" }))
    const form = await screen.findByRole('dialog', { name: 'Yangi qarz' })
    await user.type(within(form).getByLabelText('Nomi'), 'Ipoteka')
    await user.type(within(form).getByLabelText('Umumiy summa'), '300 000 000')
    await user.type(within(form).getByLabelText("Oylik to'lov"), '5 000 000')
    await user.click(within(form).getByRole('button', { name: 'Saqlash' }))

    await waitFor(() => {
      expect(insert).toHaveBeenCalledWith({
        household_id: TEST_HOUSEHOLD_ID,
        direction: 'i_owe',
        currency: 'UZS',
        name: 'Ipoteka',
        total: 30000000000,
        paid_before: 0,
        monthly_payment: 500000000,
        due_date: null,
        note: null,
      })
    })

    await user.click(await screen.findByRole('button', { name: 'Mashina krediti' }))
    const edit = await screen.findByRole('dialog', { name: 'Qarzni tahrirlash' })
    expect(within(edit).getByRole('combobox', { name: "Yo'nalish" })).toHaveAttribute(
      'data-disabled',
    )
  })

  it("viewer — faqat ko'radi", async () => {
    renderPage('viewer')
    await screen.findByText('Mashina krediti')
    expect(screen.queryByRole('button', { name: "Qarz qo'shish" })).toBeNull()
  })
})
