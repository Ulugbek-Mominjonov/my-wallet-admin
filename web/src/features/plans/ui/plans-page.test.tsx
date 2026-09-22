import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { useState } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'

import type { Account } from '@/entities/account'
import type { Role } from '@/entities/household'
import { TEST_HOUSEHOLD_ID, WithHousehold } from '@/entities/household/testing'
import { PlansPage, type PlansTab } from '@/features/plans/ui/plans-page'
import { server, signInTestUser, supabasePath } from '@/shared/test/msw'
import { renderWithProviders } from '@/shared/test/render'

const CASH = '0198f000-0000-7000-8000-0000000000a1'
const FUND = '0198f000-0000-7000-8000-0000000000a9'

const account = (id: string, name: string, type: Account['type'] = 'cash'): Account => ({
  id,
  name,
  type,
  currency: 'UZS',
  openingBalance: 0,
  openingDate: '2026-01-01',
  icon: null,
  color: null,
  sortOrder: 0,
  archivedAt: null,
  balance: 0,
})

/** `planned_items` qatori (PostgREST javobi). */
const plan = (id: string, name: string, overrides: Record<string, unknown> = {}) => ({
  id,
  kind: 'expense',
  name,
  category_id: null,
  account_id: CASH,
  planned_amount: 15000000,
  paid_amount: 0,
  due_date: '2026-09-22',
  budget_month: '2026-09-01',
  auto_pay: false,
  debt_id: null,
  system_code: null,
  settled_at: null,
  skipped_at: null,
  ...overrides,
})

const PLANS = [
  plan('p-ijara', 'Ijara', {
    planned_amount: 300000000,
    paid_amount: 100000000,
    due_date: '2026-09-05',
  }),
  plan('p-internet', 'Internet'),
  plan('p-svet', 'Svet', { planned_amount: null, due_date: '2026-09-24' }),
  plan('p-sport', 'Sport', { paid_amount: 15000000, settled_at: '2026-09-02T00:00:00Z' }),
  plan('p-kino', 'Kino', { skipped_at: '2026-09-03T00:00:00Z' }),
  plan('p-oylik', 'Oylik', { kind: 'income', planned_amount: 900000000, due_date: '2026-09-25' }),
]

function Harness({ memberRole = 'owner' }: { memberRole?: Role }) {
  const [tab, setTab] = useState<PlansTab>('expense')
  return (
    <WithHousehold memberRole={memberRole}>
      <PlansPage
        householdId={TEST_HOUSEHOLD_ID}
        month="2026-09"
        tab={tab}
        onMonthChange={() => undefined}
        onTabChange={setTab}
        currentMonth="2026-09"
        today="2026-09-22"
        baseCurrency="UZS"
        accounts={[account(CASH, 'Naqd'), account(FUND, 'Shaxsiy fond', 'personal_fund')]}
        categories={[]}
      />
    </WithHousehold>
  )
}

function mockPlans(rows: object[] = PLANS) {
  const rpc: { name: string; body: Record<string, unknown> }[] = []
  server.use(
    http.get(supabasePath('/rest/v1/planned_items'), () => HttpResponse.json(rows)),
    http.post(supabasePath('/rest/v1/rpc/:name'), async ({ request, params }) => {
      const body = (await request.json()) as Record<string, unknown>
      rpc.push({ name: String(params.name), body })
      if (params.name === 'bulk_pay_planned') {
        return HttpResponse.json({
          paid: ['p-internet'],
          skipped: [{ id: 'p-svet', reason: 'amount_unknown' }],
        })
      }
      return HttpResponse.json({})
    }),
  )
  return rpc
}

const sectionOf = (name: RegExp) => screen.getByRole('region', { name })

describe('PlansPage (E23-T04)', () => {
  beforeEach(() => {
    signInTestUser()
  })

  it('bo‘limlar holat bo‘yicha, jami `X + N ta ?` (BR-076); daromadlar alohida tabda', async () => {
    mockPlans()
    const user = userEvent.setup()
    renderWithProviders(<Harness />)

    expect(await screen.findByRole('region', { name: "Muddati o'tgan · 1" })).toHaveTextContent(
      'Ijara',
    )
    expect(sectionOf(/^Bugun/)).toHaveTextContent('Internet')
    expect(sectionOf(/^Yaqin 3 kunda/)).toHaveTextContent('Svet')
    expect(sectionOf(/^To'langan/)).toHaveTextContent('Sport')
    expect(sectionOf(/^O'tkazib yuborilgan/)).toHaveTextContent('Kino')
    expect(screen.queryByText('Oylik')).toBeNull()
    // Qolgan: Ijara 2 000 000 + Internet 150 000; Svet — noma'lum.
    expect(screen.getByText("2 150 000 so'm")).toBeInTheDocument()
    expect(screen.getByText('+ 1 ta ?')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Daromadlar' }))
    expect(await screen.findByRole('button', { name: 'Keldi' })).toBeInTheDocument()
    expect(screen.getByText('Oylik')).toBeInTheDocument()
  })

  it('To‘landi: summa standart — qolgan; kamroq bo‘lsa — yopish tanlovi (BR-073)', async () => {
    const rpc = mockPlans()
    const user = userEvent.setup()
    renderWithProviders(<Harness />)

    const overdue = await screen.findByRole('region', { name: "Muddati o'tgan · 1" })
    await user.click(within(overdue).getByRole('button', { name: "To'landi" }))
    const dialog = await screen.findByRole('dialog', { name: "«Ijara» — to'lov" })
    expect(within(dialog).getByText("Qolgan: 2 000 000 so'm")).toBeInTheDocument()
    const amount = within(dialog).getByLabelText('Summa (UZS)')
    expect(amount).toHaveValue('2 000 000')

    await user.clear(amount)
    await user.type(amount, '500 000')
    await user.click(within(dialog).getByLabelText("Yopish — reja to'landi deb belgilansin"))
    await user.click(within(dialog).getByRole('button', { name: "To'landi" }))

    await waitFor(() => {
      expect(rpc).toEqual([
        {
          name: 'pay_planned',
          body: {
            p_item: 'p-ijara',
            p_amount: 50000000,
            p_account: CASH,
            p_date: '2026-09-22',
            p_settle: true,
          },
        },
      ])
    })
    expect(await screen.findByText("To'landi: «Ijara»")).toBeInTheDocument()
  })

  it('summasi noma’lum reja — summa majburiy', async () => {
    const rpc = mockPlans()
    const user = userEvent.setup()
    renderWithProviders(<Harness />)

    const soon = await screen.findByRole('region', { name: /^Yaqin 3 kunda/ })
    await user.click(within(soon).getByRole('button', { name: "To'landi" }))
    const dialog = await screen.findByRole('dialog', { name: "«Svet» — to'lov" })
    expect(
      within(dialog).getByText(
        "Bu to'lovning summasi belgilanmagan — qancha to'laganingizni kiriting",
      ),
    ).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: "To'landi" }))
    expect(within(dialog).getByText('Summani kiriting (0 dan katta)')).toBeInTheDocument()
    expect(rpc).toEqual([])

    await user.type(within(dialog).getByLabelText('Summa (UZS)'), '87 500')
    await user.click(within(dialog).getByRole('button', { name: "To'landi" }))
    await waitFor(() => {
      expect(rpc[0]?.body).toMatchObject({ p_item: 'p-svet', p_amount: 8750000, p_settle: false })
    })
  })

  it('o‘tkazib yuborish va qaytarish', async () => {
    const rpc = mockPlans()
    const user = userEvent.setup()
    renderWithProviders(<Harness />)

    await user.click(await screen.findByRole('button', { name: 'Internet: amallar' }))
    await user.click(await screen.findByRole('menuitem', { name: "O'tkazib yuborish" }))
    await user.click(screen.getByRole('button', { name: 'Kino: amallar' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Qaytarish' }))
    await waitFor(() => {
      expect(rpc).toEqual([
        { name: 'skip_planned', body: { p_item: 'p-internet', p_skipped: true } },
        { name: 'skip_planned', body: { p_item: 'p-kino', p_skipped: false } },
      ])
    })
  })

  it('ommaviy To‘landi (BR-074): to‘lanmaganlari sababi bilan va tanlangan qoladi', async () => {
    const rpc = mockPlans()
    const user = userEvent.setup()
    renderWithProviders(<Harness />)

    await user.click(await screen.findByRole('checkbox', { name: 'Tanlash: Internet' }))
    await user.click(screen.getByRole('checkbox', { name: 'Tanlash: Svet' }))
    const bar = screen.getByRole('region', { name: 'Tanlangan: 2' })
    await user.click(within(bar).getByRole('button', { name: "Tanlanganlarni to'lash" }))
    const dialog = await screen.findByRole('dialog', { name: "Tanlangan rejalarni to'lash" })
    await user.click(within(dialog).getByRole('button', { name: "Tanlanganlarni to'lash" }))

    expect(await screen.findByText("To'landi: 1, o'tkazildi: 1")).toBeInTheDocument()
    expect(screen.getByText("Summasi noma'lum — alohida to'lang (1)")).toBeInTheDocument()
    expect(rpc[0]).toEqual({
      name: 'bulk_pay_planned',
      body: { p_items: ['p-internet', 'p-svet'], p_date: '2026-09-22' },
    })
    expect(await screen.findByRole('region', { name: 'Tanlangan: 1' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Tanlash: Svet' })).toBeChecked()
  })

  it('viewer: faqat ko‘radi', async () => {
    mockPlans()
    renderWithProviders(<Harness memberRole="viewer" />)
    await screen.findByRole('region', { name: "Muddati o'tgan · 1" })
    expect(screen.queryByRole('button', { name: "To'landi" })).toBeNull()
    expect(screen.queryByRole('checkbox')).toBeNull()
  })

  it('reja yo‘q — oyni ochish haqida izoh', async () => {
    mockPlans([])
    renderWithProviders(<Harness />)
    expect(await screen.findByText("Bu oyda reja yo'q")).toBeInTheDocument()
  })
})
