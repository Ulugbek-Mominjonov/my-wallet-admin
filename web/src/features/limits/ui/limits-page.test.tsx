import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Category } from '@/entities/category'
import { LimitsPage } from '@/features/limits/ui/limits-page'
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
  icon: null,
  color: null,
  sortOrder: 0,
  archivedAt: null,
})
const CATEGORIES = [
  category('c-food', 'Oziq-ovqat'),
  category('c-fun', "Ko'ngilochar"),
  category('c-rent', 'Ijara'),
  category('c-salary', 'Oylik', 'income'),
]

function renderPage() {
  server.use(
    http.get(supabasePath('/rest/v1/category_limits'), () =>
      HttpResponse.json([
        {
          id: 'l-food',
          category_id: 'c-food',
          amount: 200000000,
          alert_80: true,
          alert_100: true,
          rollover: true,
          rollover_negative: false,
        },
        {
          id: 'l-fun',
          category_id: 'c-fun',
          amount: 50000000,
          alert_80: false,
          alert_100: true,
          rollover: false,
          rollover_negative: false,
        },
      ]),
    ),
    http.post(supabasePath('/rest/v1/rpc/report_month'), () =>
      HttpResponse.json({
        by_category: [
          {
            category_id: 'c-food',
            actual_total: 170000000,
            limit: 240000000,
            limit_carry: 40000000,
            limit_ratio: 0.7083,
            limit_status: 'ok',
          },
          {
            category_id: 'c-fun',
            actual_total: 60000000,
            limit: 50000000,
            limit_carry: 0,
            limit_ratio: 1.2,
            limit_status: 'over',
          },
        ],
      }),
    ),
  )
  renderWithProviders(
    <WithHousehold>
      <LimitsPage
        householdId={TEST_HOUSEHOLD_ID}
        month="2026-09-01"
        categories={CATEGORIES}
        baseCurrency="UZS"
      />
    </WithHousehold>,
  )
  return userEvent.setup()
}

describe('LimitsPage (E22-T05)', () => {
  beforeEach(() => {
    signInTestUser()
  })

  it('joriy oy holati: fakt, foiz va holat — oshganlar birinchi', async () => {
    renderPage()
    const bars = await screen.findAllByRole('progressbar')
    expect(bars.map((b) => b.getAttribute('aria-valuetext'))).toEqual([
      '120% — Oshib ketdi',
      "71% — Me'yorda",
    ])
    const food = within(screen.getByRole('row', { name: /Oziq-ovqat/ }))
    expect(food.getByText("1 700 000 so'm")).toBeVisible()
    // BR-134: amaldagi limit — 2 000 000 + o'tgan oydan 400 000.
    expect(food.getByText("2 400 000 so'm")).toBeVisible()
    expect(food.getByText("o'tgan oydan 400 000 so'm")).toBeVisible()
    expect(food.getByText("↻ o'tkazish")).toBeVisible()
  })

  it('yangi limit — faqat limitsiz xarajat kategoriyalari', async () => {
    const insert = vi.fn()
    server.use(
      http.post(supabasePath('/rest/v1/category_limits'), async ({ request }) => {
        insert(await request.json())
        return new HttpResponse(null, { status: 201 })
      }),
    )
    const user = renderPage()
    await screen.findAllByRole('progressbar')
    await user.click(screen.getByRole('button', { name: "Limit qo'shish" }))
    const form = await screen.findByRole('dialog', { name: 'Yangi limit' })
    await user.click(within(form).getByRole('combobox', { name: 'Kategoriya' }))
    expect(screen.queryByRole('option', { name: 'Oziq-ovqat' })).toBeNull()
    expect(screen.queryByRole('option', { name: 'Oylik' })).toBeNull()
    await user.click(await screen.findByRole('option', { name: 'Ijara' }))
    await user.type(within(form).getByLabelText('Oylik limit'), '3 000 000')
    await user.click(within(form).getByRole('switch', { name: '80% da xabar' }))
    // BR-134: manfiy qoldiq rollover yoqilmaguncha tanlanmaydi.
    await user.click(within(form).getByRole('switch', { name: 'Oshib ketganini ayirish' }))
    await user.click(within(form).getByRole('switch', { name: "Qolganini keyingi oyga o'tkazish" }))
    await user.click(within(form).getByRole('button', { name: 'Saqlash' }))

    await waitFor(() => {
      expect(insert).toHaveBeenCalledWith({
        household_id: TEST_HOUSEHOLD_ID,
        category_id: 'c-rent',
        amount: 300000000,
        alert_80: false,
        alert_100: true,
        rollover: true,
        rollover_negative: false,
      })
    })
  })
})
