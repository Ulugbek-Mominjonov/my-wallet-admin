import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'

import type { Role } from '@/entities/household'
import { TEST_HOUSEHOLD_ID, WithHousehold } from '@/entities/household/testing'
import { MonthActions } from '@/features/plans/ui/month-actions'
import type { MonthKey } from '@/shared/lib/month'
import { server, signInTestUser, supabasePath } from '@/shared/test/msw'
import { renderWithProviders } from '@/shared/test/render'

const PREVIEW = {
  month: '2026-09-01',
  closed: false,
  new: 2,
  existing: 1,
  items: [
    {
      kind: 'expense',
      name: 'Ijara',
      planned_amount: 300000000,
      due_date: '2026-09-05',
      exists: false,
    },
    {
      kind: 'allocation',
      name: "O'zim uchun",
      planned_amount: null,
      due_date: '2026-09-05',
      exists: false,
    },
    {
      kind: 'income',
      name: 'Oylik',
      planned_amount: 900000000,
      due_date: '2026-09-02',
      exists: true,
    },
  ],
}

function renderActions({
  month = '2026-09',
  role = 'owner',
  state = {},
  preview = PREVIEW,
}: {
  month?: MonthKey
  role?: Role
  state?: { opened_at?: string; closed_at?: string }
  preview?: object
} = {}) {
  const rpc: { name: string; body: Record<string, unknown> }[] = []
  server.use(
    http.get(supabasePath('/rest/v1/months'), () =>
      HttpResponse.json(Object.keys(state).length > 0 ? [state] : []),
    ),
    http.post(supabasePath('/rest/v1/rpc/:name'), async ({ request, params }) => {
      const name = String(params.name)
      rpc.push({ name, body: (await request.json()) as Record<string, unknown> })
      if (name === 'open_month_preview') return HttpResponse.json(preview)
      if (name === 'open_month') return HttpResponse.json({ created: 2, skipped: 1, items: [] })
      if (name === 'month_close_check') {
        return HttpResponse.json({ unpaid_count: 2, unpaid_amount: 150000000, unknown_count: 1 })
      }
      return HttpResponse.json({})
    }),
  )
  renderWithProviders(
    <WithHousehold memberRole={role}>
      <MonthActions
        householdId={TEST_HOUSEHOLD_ID}
        month={month}
        currentMonth="2026-09"
        baseCurrency="UZS"
      />
    </WithHousehold>,
  )
  return { rpc, user: userEvent.setup() }
}

describe('MonthActions (E23-T05)', () => {
  beforeEach(() => {
    signInTestUser()
  })

  it('oyni ochish: preview (yangi / bor) → tasdiq → natija (BR-081, BR-084)', async () => {
    const { rpc, user } = renderActions()
    await user.click(await screen.findByRole('button', { name: 'Oyni ochish' }))
    const dialog = await screen.findByRole('dialog', { name: 'Sentabr 2026 — oyni ochish' })
    expect(await within(dialog).findByText('Yangi: 2')).toBeInTheDocument()
    expect(within(dialog).getByText('Allaqachon bor: 1')).toBeInTheDocument()
    expect(within(dialog).getByText('Ijara')).toBeInTheDocument()
    expect(within(dialog).getByText('bor')).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Ochish' }))
    expect(await screen.findByText("2 ta qo'shildi, 1 ta allaqachon bor edi")).toBeInTheDocument()
    expect(rpc.map((r) => r.name)).toEqual(['open_month_preview', 'open_month'])
    expect(rpc[1]?.body).toEqual({ p_household: TEST_HOUSEHOLD_ID, p_month: '2026-09-01' })
  })

  it('yangi reja yo‘q — ochish tugmasi faol emas', async () => {
    const { user } = renderActions({ preview: { ...PREVIEW, new: 0, existing: 3 } })
    await user.click(await screen.findByRole('button', { name: 'Oyni ochish' }))
    const dialog = await screen.findByRole('dialog')
    expect(
      await within(dialog).findByText("Yangi reja yo'q — hammasi allaqachon yaratilgan"),
    ).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Ochish' })).toBeDisabled()
  })

  it('tugagan oyni yopish: to‘lanmaganlar ogohlantirishi, "Baribir yopish" (BR-150, BR-153)', async () => {
    const { rpc, user } = renderActions({ month: '2026-08', role: 'admin' })
    await user.click(await screen.findByRole('button', { name: 'Oyni yopish' }))
    const dialog = await screen.findByRole('dialog', { name: 'Avgust 2026 — oyni yopish' })
    expect(await within(dialog).findByRole('status')).toHaveTextContent(
      "To'lanmagan rejalar: 2 ta (1 500 000 so'm)",
    )
    expect(within(dialog).getByText("Summasi noma'lum: 1 ta")).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Baribir yopish' }))
    await waitFor(() => {
      expect(rpc.at(-1)).toEqual({
        name: 'set_month_closed',
        body: { p_household: TEST_HOUSEHOLD_ID, p_month: '2026-08-01', p_closed: true },
      })
    })
    expect(await screen.findByText('Avgust 2026 yopildi')).toBeInTheDocument()
  })

  it('joriy oy yopilmaydi; member oyni ochadi, lekin yopa olmaydi', async () => {
    renderActions({ role: 'member' })
    expect(await screen.findByRole('button', { name: 'Oyni ochish' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Oyni yopish' })).toBeNull()
  })

  it('yopilgan oy: 🔒 belgisi, ochish yo‘q, qayta ochish — tasdiq bilan', async () => {
    const { rpc, user } = renderActions({
      month: '2026-08',
      state: { opened_at: '2026-08-01T00:30:00Z', closed_at: '2026-09-01T10:00:00Z' },
    })
    expect(await screen.findByText('Yopilgan')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Oyni ochish' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Qayta ochish' }))
    const confirm = await screen.findByRole('dialog', { name: 'Avgust 2026 qayta ochilsinmi?' })
    await user.click(within(confirm).getByRole('button', { name: 'Qayta ochish' }))
    await waitFor(() => {
      expect(rpc.at(-1)?.body).toMatchObject({ p_closed: false })
    })
  })

  it('viewer: tugmalar yo‘q', async () => {
    renderActions({ month: '2026-08', role: 'viewer' })
    await waitFor(() => {
      expect(screen.queryAllByRole('button')).toHaveLength(0)
    })
  })
})
