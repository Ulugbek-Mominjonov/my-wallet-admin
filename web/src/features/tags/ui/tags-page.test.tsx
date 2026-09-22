import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { TagsPage } from '@/features/tags/ui/tags-page'
import { TEST_HOUSEHOLD_ID, WithHousehold } from '@/entities/household/testing'
import { server, signInTestUser, supabasePath } from '@/shared/test/msw'
import { renderWithProviders } from '@/shared/test/render'

function renderPage(role: 'owner' | 'member' | 'viewer') {
  server.use(
    http.get(supabasePath('/rest/v1/tags'), () =>
      HttpResponse.json([{ id: 't-trip', name: "Ta'til", color: '#0EA5E9' }]),
    ),
  )
  renderWithProviders(
    <WithHousehold role={role}>
      <TagsPage householdId={TEST_HOUSEHOLD_ID} />
    </WithHousehold>,
  )
  return userEvent.setup()
}

describe('TagsPage (E22-T05, BR-200)', () => {
  beforeEach(() => {
    signInTestUser()
  })

  it("member teg qo'sha oladi, lekin tahrirlay olmaydi", async () => {
    const insert = vi.fn()
    server.use(
      http.post(supabasePath('/rest/v1/tags'), async ({ request }) => {
        insert(await request.json())
        return new HttpResponse(null, { status: 201 })
      }),
    )
    const user = renderPage('member')
    await screen.findByText("Ta'til")
    expect(screen.queryByRole('button', { name: "Ta'til: amallar" })).toBeNull()

    await user.click(screen.getByRole('button', { name: "Teg qo'shish" }))
    const form = await screen.findByRole('dialog', { name: 'Yangi teg' })
    await user.type(within(form).getByLabelText('Nomi'), "Ta'mirlash")
    await user.click(within(form).getByRole('button', { name: '#E11D48' }))
    await user.click(within(form).getByRole('button', { name: 'Saqlash' }))

    await waitFor(() => {
      expect(insert).toHaveBeenCalledWith({
        household_id: TEST_HOUSEHOLD_ID,
        name: "Ta'mirlash",
        color: '#E11D48',
      })
    })
  })

  it("viewer — qo'shish yo'q", async () => {
    renderPage('viewer')
    await screen.findByText("Ta'til")
    expect(screen.queryByRole('button', { name: "Teg qo'shish" })).toBeNull()
  })
})
