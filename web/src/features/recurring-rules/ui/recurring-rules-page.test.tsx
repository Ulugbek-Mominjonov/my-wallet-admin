import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Category } from '@/entities/category'
import { TEST_HOUSEHOLD_ID, WithHousehold } from '@/entities/household/testing'
import { RecurringRulesPage } from '@/features/recurring-rules/ui/recurring-rules-page'
import { server, signInTestUser, supabasePath } from '@/shared/test/msw'
import { renderWithProviders } from '@/shared/test/render'

const HOUSEHOLD = TEST_HOUSEHOLD_ID

const category = (id: string, name: string, kind: Category['kind']): Category => ({
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
  category('c-rent', 'Ijara', 'expense'),
  category('c-net', 'Internet', 'expense'),
  category('c-salary', 'Oylik', 'income'),
]
const ACCOUNTS = [
  { id: 'a-cash', name: 'Naqd pul', type: 'cash' },
  { id: 'a-card', name: 'Humo', type: 'card' },
  { id: 'a-fund', name: 'Shaxsiy fond', type: 'personal_fund' },
]

const rule = (id: string, name: string, patch: Record<string, unknown> = {}) => ({
  id,
  kind: 'expense',
  name,
  category_id: 'c-rent',
  account_id: null,
  amount: 300000000,
  day_of_month: 5,
  auto_pay: false,
  active: true,
  debt_id: null,
  start_month: null,
  end_month: null,
  sort_order: 0,
  ...patch,
})

const RULES = [
  rule('r-rent', 'Kvartira ijarasi'),
  rule('r-net', 'Uy interneti', {
    category_id: 'c-net',
    account_id: 'a-card',
    amount: 15000000,
    day_of_month: 10,
    auto_pay: true,
  }),
  rule('r-salary', 'Maosh', {
    kind: 'income',
    category_id: 'c-salary',
    amount: null,
    day_of_month: 2,
  }),
]

function renderPage() {
  server.use(http.get(supabasePath('/rest/v1/recurring_rules'), () => HttpResponse.json(RULES)))
  renderWithProviders(
    <WithHousehold>
      <RecurringRulesPage
        householdId={HOUSEHOLD}
        categories={CATEGORIES}
        accounts={ACCOUNTS}
        baseCurrency="UZS"
        timezone="Asia/Tashkent"
      />
    </WithHousehold>,
  )
  return userEvent.setup()
}

const ruleRow = (name: string) => screen.getByRole('row', { name: new RegExp(name) })

describe('RecurringRulesPage (E22-T04)', () => {
  beforeEach(() => {
    signInTestUser()
  })

  it("ro'yxat: tur, kategoriya, hisob, summa (o'zgaruvchan), kun va avto to'lov", async () => {
    renderPage()
    await screen.findByText('Kvartira ijarasi')

    const net = within(ruleRow('Uy interneti'))
    expect(net.getByText('Internet')).toBeInTheDocument()
    expect(net.getByText('Humo')).toBeInTheDocument()
    expect(net.getByText("150 000 so'm")).toBeInTheDocument()
    expect(net.getByText("Avto to'lov")).toBeInTheDocument()
    expect(within(ruleRow('Maosh')).getByText("O'zgaruvchan")).toBeInTheDocument()
    expect(within(ruleRow('Maosh')).getByText('2-kuni')).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Davr' })).toBeNull()
  })

  it('yangi doimiy reja — kategoriya shu turdan, summa tiyinda', async () => {
    const insert = vi.fn()
    server.use(
      http.post(supabasePath('/rest/v1/recurring_rules'), async ({ request }) => {
        insert(await request.json())
        return new HttpResponse(null, { status: 201 })
      }),
    )
    const user = renderPage()
    await screen.findByText('Kvartira ijarasi')

    await user.click(screen.getByRole('button', { name: "Doimiy reja qo'shish" }))
    const form = await screen.findByRole('dialog', { name: 'Yangi doimiy reja' })
    await user.type(within(form).getByLabelText('Nomi'), 'Kommunal')
    await user.click(within(form).getByRole('combobox', { name: 'Kategoriya' }))
    // Xarajat turida daromad kategoriyalari yo'q.
    expect(screen.queryByRole('option', { name: 'Oylik' })).toBeNull()
    await user.click(await screen.findByRole('option', { name: 'Internet' }))
    await user.type(within(form).getByLabelText('Summa'), '250 000')
    await user.clear(within(form).getByLabelText('Kuni'))
    await user.type(within(form).getByLabelText('Kuni'), '15')
    await user.click(within(form).getByRole('button', { name: 'Saqlash' }))

    await waitFor(() => {
      expect(insert).toHaveBeenCalledOnce()
    })
    expect(insert.mock.calls[0]?.[0]).toMatchObject({
      household_id: HOUSEHOLD,
      kind: 'expense',
      name: 'Kommunal',
      category_id: 'c-net',
      account_id: null,
      amount: 25000000,
      day_of_month: 15,
      auto_pay: false,
      active: true,
      sort_order: 1,
    })
  })

  it("avto to'lov hisobsiz — forma xatosi (BR-075), so'rov yo'q", async () => {
    const user = renderPage()
    await screen.findByText('Kvartira ijarasi')
    await user.click(screen.getByRole('button', { name: 'Kvartira ijarasi' }))
    const form = await screen.findByRole('dialog', { name: 'Doimiy rejani tahrirlash' })
    await user.click(within(form).getByRole('switch', { name: "Avto to'lov" }))
    await user.click(within(form).getByRole('button', { name: 'Saqlash' }))

    expect(await within(form).findByText("Avto to'lov uchun summa va hisob kerak")).toBeVisible()
  })

  it("faol/to'xtatilgan — darhol, server xatosida qaytadi", async () => {
    server.use(
      http.patch(supabasePath('/rest/v1/recurring_rules'), () =>
        HttpResponse.json({ code: '42501', message: 'permission denied' }, { status: 403 }),
      ),
    )
    const user = renderPage()
    const toggle = await screen.findByRole('switch', { name: 'Maosh: Faol' })
    expect(toggle).toBeChecked()

    await user.click(toggle)

    expect(await screen.findByText("Bu amal uchun huquqingiz yo'q.")).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByRole('switch', { name: 'Maosh: Faol' })).toBeChecked()
    })
  })

  it('keyingi oy preview — yangi va mavjud rejalar', async () => {
    const preview = vi.fn()
    server.use(
      http.post(supabasePath('/rest/v1/rpc/open_month_preview'), async ({ request }) => {
        preview(await request.json())
        return HttpResponse.json({
          month: '2026-10-01',
          closed: false,
          new: 1,
          existing: 1,
          items: [
            {
              kind: 'expense',
              name: 'Kvartira ijarasi',
              planned_amount: 300000000,
              due_date: '2026-10-05',
              recurring_rule_id: 'r-rent',
              system_code: null,
              exists: true,
            },
            {
              kind: 'income',
              name: 'Maosh',
              planned_amount: null,
              due_date: '2026-10-02',
              recurring_rule_id: 'r-salary',
              system_code: null,
              exists: false,
            },
          ],
        })
      }),
    )
    const user = renderPage()
    await user.click(await screen.findByRole('button', { name: 'Keyingi oy' }))

    const dialog = await screen.findByRole('dialog', { name: /oy ochilganda/ })
    expect(await within(dialog).findByText('1 ta yangi reja yaratiladi')).toBeInTheDocument()
    expect(within(dialog).getByText('bor')).toBeInTheDocument()
    expect(within(dialog).getByText("O'zgaruvchan")).toBeInTheDocument()
    expect(preview.mock.calls[0]?.[0]).toMatchObject({ p_household: HOUSEHOLD })
    expect((preview.mock.calls[0]?.[0] as { p_month: string }).p_month).toMatch(/^\d{4}-\d{2}-01$/)
  })
})
