import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Category } from '@/entities/category'
import { QuickActionsPage } from '@/features/quick-actions/ui/quick-actions-page'
import { TEST_HOUSEHOLD_ID, WithHousehold } from '@/entities/household/testing'
import { server, signInTestUser, supabasePath } from '@/shared/test/msw'
import { renderWithProviders } from '@/shared/test/render'

const category = (id: string, name: string, kind: Category['kind'] = 'expense'): Category => ({
  id,
  kind,
  name,
  parentId: null,
  monthShift: 0,
  systemCode: null,
  icon: 'coffee',
  color: null,
  sortOrder: 0,
  archivedAt: null,
})

function renderPage(role: 'owner' | 'member' = 'owner') {
  server.use(
    http.get(supabasePath('/rest/v1/quick_actions'), () =>
      HttpResponse.json([
        {
          id: 'q-coffee',
          name: 'Kofe',
          amount: 2500000,
          category_id: 'c-food',
          account_id: 'a-cash',
          payee: null,
          sort_order: 0,
        },
      ]),
    ),
  )
  renderWithProviders(
    <WithHousehold memberRole={role}>
      <QuickActionsPage
        householdId={TEST_HOUSEHOLD_ID}
        categories={[category('c-food', 'Ovqat'), category('c-salary', 'Oylik', 'income')]}
        accounts={[
          { id: 'a-cash', name: 'Hamyon', archivedAt: null },
          { id: 'a-old', name: 'Eski karta', archivedAt: '2026-01-01' },
        ]}
        baseCurrency="UZS"
      />
    </WithHousehold>,
  )
  return userEvent.setup()
}

describe('QuickActionsPage (E22-T05)', () => {
  beforeEach(() => {
    signInTestUser()
  })

  it("chip ko'rinishi: nom va summa (mobil bilan bir xil)", async () => {
    renderPage()
    expect(await screen.findByText("Kofe · 25 000 so'm")).toBeInTheDocument()
  })

  it('yangi tez tugma — faol hisoblar, xarajat kategoriyalari', async () => {
    const insert = vi.fn()
    server.use(
      http.post(supabasePath('/rest/v1/quick_actions'), async ({ request }) => {
        insert(await request.json())
        return new HttpResponse(null, { status: 201 })
      }),
    )
    const user = renderPage()
    await screen.findByText("Kofe · 25 000 so'm")
    await user.click(screen.getByRole('button', { name: "Tez tugma qo'shish" }))
    const form = await screen.findByRole('dialog', { name: 'Yangi tez tugma' })
    await user.type(within(form).getByLabelText('Nomi'), "Yo'l")
    await user.type(within(form).getByLabelText('Summa'), '2 000')
    await user.click(within(form).getByRole('combobox', { name: 'Kategoriya' }))
    expect(screen.queryByRole('option', { name: 'Oylik' })).toBeNull()
    await user.click(await screen.findByRole('option', { name: 'Ovqat' }))
    await user.click(within(form).getByRole('combobox', { name: 'Hisob' }))
    expect(screen.queryByRole('option', { name: 'Eski karta' })).toBeNull()
    await user.click(await screen.findByRole('option', { name: 'Hamyon' }))
    await user.click(within(form).getByRole('button', { name: 'Saqlash' }))

    await waitFor(() => {
      expect(insert).toHaveBeenCalledWith({
        household_id: TEST_HOUSEHOLD_ID,
        sort_order: 1,
        name: "Yo'l",
        amount: 200000,
        category_id: 'c-food',
        account_id: 'a-cash',
        payee: null,
      })
    })
  })

  it("member — faqat ko'radi", async () => {
    renderPage('member')
    await screen.findByText("Kofe · 25 000 so'm")
    expect(screen.queryByRole('button', { name: "Tez tugma qo'shish" })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Kofe: amallar' })).toBeNull()
  })
})
