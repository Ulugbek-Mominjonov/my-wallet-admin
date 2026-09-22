import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { HouseholdProvider } from '@/entities/household'
import { CategoriesPage } from '@/features/categories/ui/categories-page'
import { server, signInTestUser, supabasePath } from '@/shared/test/msw'
import { renderWithProviders } from '@/shared/test/render'
import { Toaster } from '@/shared/ui/sonner'

const HOUSEHOLD = '0198f000-0000-7000-8000-00000000000a'

const row = (
  id: string,
  name: string,
  patch: { kind?: string; parent_id?: string; month_shift?: number; system_code?: string } = {},
) => ({
  id,
  kind: 'expense',
  name,
  parent_id: null,
  month_shift: 0,
  system_code: null,
  icon: null,
  color: null,
  sort_order: 0,
  archived_at: null,
  ...patch,
})

const CATEGORIES = [
  row('c-transport', 'Transport'),
  row('c-taxi', 'Taksi', { parent_id: 'c-transport' }),
  row('c-food', 'Oziq-ovqat'),
  row('c-self', "O'zim uchun", { system_code: 'personal_allocation' }),
  row('c-salary', 'Oylik', { kind: 'income', month_shift: -1 }),
  row('c-advance', 'Avans', { kind: 'income' }),
]

function renderPage() {
  server.use(http.get(supabasePath('/rest/v1/categories'), () => HttpResponse.json(CATEGORIES)))
  renderWithProviders(
    <HouseholdProvider
      household={{
        id: HOUSEHOLD,
        name: 'Uy',
        role: 'owner',
        base_currency: 'UZS',
        timezone: 'Asia/Tashkent',
        onboarded: true,
      }}
    >
      <CategoriesPage householdId={HOUSEHOLD} baseCurrency="UZS" />
      <Toaster />
    </HouseholdProvider>,
  )
  return userEvent.setup()
}

const openActions = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
  await user.click(await screen.findByRole('button', { name: `${name}: amallar` }))
}

describe('CategoriesPage (E22-T03)', () => {
  beforeEach(() => {
    signInTestUser()
  })

  it('xarajat — daraxt (bola otasidan keyin), daromad — oy siljishi ustuni', async () => {
    const user = renderPage()
    await screen.findByText('Transport')

    const names = screen
      .getAllByRole('row')
      .slice(1)
      .map((r) => r.textContent)
    expect(names.findIndex((n) => n.includes('Taksi'))).toBe(
      names.findIndex((n) => n.includes('Transport')) + 1,
    )
    expect(screen.queryByText('Oylik')).toBeNull()

    await user.click(screen.getByRole('tab', { name: 'Daromad' }))
    expect(
      within(screen.getByRole('row', { name: /Oylik/ })).getByText('Oldingi oy'),
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole('row', { name: /Avans/ })).getByText('Joriy oy (kelgan oyi)'),
    ).toBeInTheDocument()
  })

  it("tizim kategoriyasi — arxiv, o'chirish, birlashtirish va subkategoriya yo'q", async () => {
    const user = renderPage()
    await openActions(user, "O'zim uchun")
    expect(await screen.findByRole('menuitem', { name: 'Tahrirlash' })).toBeInTheDocument()
    for (const name of ['Arxivlash', "O'chirish", 'Birlashtirish', "Subkategoriya qo'shish"]) {
      expect(screen.queryByRole('menuitem', { name })).toBeNull()
    }
  })

  it('subkategoriya — ota oldindan tanlangan (BR-034)', async () => {
    const insert = vi.fn()
    server.use(
      http.post(supabasePath('/rest/v1/categories'), async ({ request }) => {
        insert(await request.json())
        return new HttpResponse(null, { status: 201 })
      }),
    )
    const user = renderPage()
    await openActions(user, 'Transport')
    await user.click(await screen.findByRole('menuitem', { name: "Subkategoriya qo'shish" }))
    const form = await screen.findByRole('dialog', { name: 'Yangi kategoriya' })
    await user.type(within(form).getByLabelText('Nomi'), "Yoqilg'i")
    await user.click(within(form).getByRole('button', { name: 'Saqlash' }))

    await waitFor(() => {
      expect(insert).toHaveBeenCalledOnce()
    })
    expect(insert.mock.calls[0]?.[0]).toMatchObject({
      household_id: HOUSEHOLD,
      kind: 'expense',
      name: "Yoqilg'i",
      parent_id: 'c-transport',
      month_shift: 0,
    })
  })

  it("oy siljishi o'zgardi — preview (BR-043) va tasdiqdan keyin qayta joylash", async () => {
    const apply = vi.fn()
    server.use(
      http.patch(
        supabasePath('/rest/v1/categories'),
        () => new HttpResponse(null, { status: 204 }),
      ),
      http.post(supabasePath('/rest/v1/rpc/recalc_income_months_preview'), () =>
        HttpResponse.json({
          count: 3,
          moves: [
            { from_month: '2026-09-01', to_month: '2026-08-01', count: 3, amount_base: 2400000000 },
          ],
        }),
      ),
      http.post(supabasePath('/rest/v1/rpc/recalc_income_months_apply'), async ({ request }) => {
        apply(await request.json())
        return HttpResponse.json({ moved: 3 })
      }),
    )
    const user = renderPage()
    await user.click(await screen.findByRole('tab', { name: 'Daromad' }))
    await user.click(await screen.findByRole('button', { name: 'Avans' }))
    const form = await screen.findByRole('dialog', { name: 'Kategoriyani tahrirlash' })
    await user.click(within(form).getByRole('combobox', { name: 'Qaysi oyga tegishli' }))
    await user.click(await screen.findByRole('option', { name: 'Oldingi oy' }))
    await user.click(within(form).getByRole('button', { name: 'Saqlash' }))

    const recalc = await screen.findByRole('dialog', { name: 'Amallarni qayta joylash' })
    expect(await within(recalc).findByText(/Sentabr 2026 → Avgust 2026: 3 ta/)).toBeInTheDocument()
    await user.click(within(recalc).getByRole('button', { name: 'Qayta joylash' }))

    await waitFor(() => {
      expect(apply).toHaveBeenCalledWith({ p_household: HOUSEHOLD, p_expected_count: 3 })
    })
    expect(await screen.findByText('3 ta amal qayta joylandi')).toBeInTheDocument()
  })

  it('birlashtirish (BR-036) — maqsad tanlanadi, natija xabarda', async () => {
    const merge = vi.fn()
    server.use(
      http.post(supabasePath('/rest/v1/rpc/merge_categories'), async ({ request }) => {
        merge(await request.json())
        return HttpResponse.json({
          children: 0,
          transactions: 12,
          plans: 2,
          recurring_rules: 1,
          quick_actions: 0,
        })
      }),
    )
    const user = renderPage()
    await openActions(user, 'Taksi')
    await user.click(await screen.findByRole('menuitem', { name: 'Birlashtirish' }))
    const dialog = await screen.findByRole('dialog', { name: '«Taksi» ni birlashtirish' })
    await user.click(within(dialog).getByRole('combobox', { name: 'Qaysi kategoriyaga' }))
    await user.click(await screen.findByRole('option', { name: 'Transport' }))
    await user.click(within(dialog).getByRole('button', { name: 'Birlashtirish' }))

    await waitFor(() => {
      expect(merge).toHaveBeenCalledWith({ p_from: 'c-taxi', p_to: 'c-transport' })
    })
    expect(
      await screen.findByText('Birlashtirildi: 12 amal, 2 reja, 1 doimiy reja'),
    ).toBeInTheDocument()
  })
})
