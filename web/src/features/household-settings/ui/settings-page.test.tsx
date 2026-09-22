import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Role } from '@/entities/household'
import { TEST_HOUSEHOLD_ID, WithHousehold } from '@/entities/household/testing'
import { SettingsPage } from '@/features/household-settings/ui/settings-page'
import { server, signInTestUser, supabasePath, TEST_USER_ID } from '@/shared/test/msw'
import { renderWithProviders } from '@/shared/test/render'

// Navigatsiya (chiqish/o'chirishdan keyin) — routersiz testda soxta.
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => vi.fn() }))

const OTHER = '0198f000-0000-7000-8000-000000000002'

function renderPage(role: Role) {
  server.use(
    http.get(supabasePath('/rest/v1/households'), () =>
      HttpResponse.json({
        id: TEST_HOUSEHOLD_ID,
        name: 'Oila byudjeti',
        base_currency: 'UZS',
        timezone: 'Asia/Tashkent',
        personal_fund_mode: 'percent',
        personal_fund_percent: 10,
        personal_fund_fixed_amount: 0,
        personal_fund_day: 5,
        personal_fund_source_account_id: 'a-cash',
        auto_open_month: true,
        strict_month_lock: false,
      }),
    ),
    http.post(supabasePath('/rest/v1/rpc/report_month'), () =>
      HttpResponse.json({ totals: { income: 1499600000 } }),
    ),
    http.get(supabasePath('/rest/v1/household_members'), () =>
      HttpResponse.json([
        { user_id: TEST_USER_ID, role, joined_at: '2026-09-01T00:00:00Z' },
        { user_id: OTHER, role: 'member', joined_at: '2026-09-10T00:00:00Z' },
      ]),
    ),
    http.get(supabasePath('/rest/v1/profiles'), () =>
      HttpResponse.json([
        { user_id: TEST_USER_ID, display_name: 'Ali' },
        { user_id: OTHER, display_name: 'Vali' },
      ]),
    ),
    http.get(supabasePath('/rest/v1/household_invites'), () => HttpResponse.json([])),
  )
  renderWithProviders(
    <WithHousehold memberRole={role}>
      <SettingsPage
        householdId={TEST_HOUSEHOLD_ID}
        userId={TEST_USER_ID}
        role={role}
        month="2026-09-01"
        accounts={[{ value: 'a-cash', label: 'Naqd' }]}
        allocationUnit={100000}
      />
    </WithHousehold>,
  )
  return userEvent.setup()
}

describe('SettingsPage (E22-T07)', () => {
  beforeEach(() => {
    signInTestUser()
  })

  it('fond ajratmasi jonli: daromad × foiz, server yaxlitlashi bilan (BR-060)', async () => {
    const user = renderPage('owner')
    expect(
      await screen.findByText("Joriy oy ajratmasi: 1 500 000 so'm (daromad 14 996 000 so'm × 10%)"),
    ).toBeInTheDocument()

    const percent = screen.getByLabelText('Foiz')
    await user.clear(percent)
    await user.type(percent, '20')
    expect(
      // 14 996 000 × 20% = 2 999 200 → 1000 so'mga yaxlitlanadi (server formulasi).
      screen.getByText("Joriy oy ajratmasi: 2 999 000 so'm (daromad 14 996 000 so'm × 20%)"),
    ).toBeInTheDocument()
  })

  it("member: ko'radi, lekin o'zgartira olmaydi; o'zi chiqa oladi; xavfli zona yo'q", async () => {
    renderPage('member')
    expect(await screen.findByLabelText('Byudjet nomi')).toBeDisabled()
    // Base UI switch — ARIA holati (native disabled atributi yo'q).
    expect(screen.getByRole('switch', { name: 'Qattiq qulf' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    expect(screen.queryByRole('button', { name: 'Taklif yaratish' })).toBeNull()
    expect(await screen.findByRole('button', { name: 'Byudjetdan chiqish' })).toBeInTheDocument()
    expect(screen.queryByText('Xavfli zona')).toBeNull()
  })

  it('owner: taklif kodi yaratiladi (tanlangan rol bilan)', async () => {
    const invite = vi.fn()
    server.use(
      http.post(supabasePath('/rest/v1/rpc/create_invite'), async ({ request }) => {
        invite(await request.json())
        return HttpResponse.json([{ code: 'ABCD2345', expires_at: '2026-09-29T10:00:00Z' }])
      }),
    )
    const user = renderPage('owner')
    await user.click(await screen.findByRole('combobox', { name: 'Taklif roli' }))
    await user.click(await screen.findByRole('option', { name: 'Kuzatuvchi' }))
    await user.click(screen.getByRole('button', { name: 'Taklif yaratish' }))

    const dialog = await screen.findByRole('dialog', { name: 'Taklif kodi' })
    expect(within(dialog).getByText('ABCD2345')).toBeInTheDocument()
    expect(invite).toHaveBeenCalledWith({ p_household: TEST_HOUSEHOLD_ID, p_role: 'viewer' })
  })

  it("owner: o'chirish faqat nom to'g'ri yozilganda", async () => {
    const remove = vi.fn()
    server.use(
      http.post(supabasePath('/rest/v1/rpc/delete_household'), async ({ request }) => {
        remove(await request.json())
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const user = renderPage('owner')
    await user.click(await screen.findByRole('button', { name: "Byudjetni o'chirish" }))
    const dialog = await screen.findByRole('dialog', { name: "Byudjetni o'chirish" })
    const confirm = within(dialog).getByRole('button', { name: "Byudjetni o'chirish" })
    expect(confirm).toBeDisabled()

    await user.type(within(dialog).getByRole('textbox'), 'oila BYUDJETI')
    expect(confirm).toBeEnabled()
    await user.click(confirm)

    await waitFor(() => {
      expect(remove).toHaveBeenCalledWith({
        p_household: TEST_HOUSEHOLD_ID,
        p_confirm_name: 'oila BYUDJETI',
      })
    })
  })
})
