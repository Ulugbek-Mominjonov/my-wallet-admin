import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { HouseholdProvider, type Role } from '@/entities/household'
import { AccountsPage } from '@/features/accounts/ui/accounts-page'
import { server, signInTestUser, supabasePath } from '@/shared/test/msw'
import { renderWithProviders } from '@/shared/test/render'
import { Toaster } from '@/shared/ui/sonner'

const HOUSEHOLD = '0198f000-0000-7000-8000-00000000000a'

const row = (id: string, name: string, type: string, sortOrder: number, archived = false) => ({
  id,
  name,
  type,
  currency: 'UZS',
  opening_balance: 0,
  opening_date: '2026-09-01',
  icon: null,
  color: null,
  sort_order: sortOrder,
  archived_at: archived ? '2026-09-10T00:00:00Z' : null,
})

const ACCOUNTS = [
  row('a-cash', 'Hamyon', 'cash', 0),
  row('a-card', 'Uzcard', 'card', 1),
  row('a-fund', 'Shaxsiy fond', 'personal_fund', 2),
]

function mockList(accounts = ACCOUNTS) {
  server.use(
    http.get(supabasePath('/rest/v1/accounts'), ({ request }) => {
      const archived = new URL(request.url).searchParams.get('archived_at') === null
      return HttpResponse.json(archived ? accounts : accounts.filter((a) => !a.archived_at))
    }),
    http.get(supabasePath('/rest/v1/account_balances'), () =>
      HttpResponse.json([
        { account_id: 'a-cash', balance: 150000000 },
        { account_id: 'a-card', balance: -2500000 },
        { account_id: 'a-fund', balance: 0 },
      ]),
    ),
  )
}

function renderPage(role: Role = 'owner') {
  renderWithProviders(
    <HouseholdProvider
      household={{
        id: HOUSEHOLD,
        name: 'Uy',
        role,
        base_currency: 'UZS',
        timezone: 'Asia/Tashkent',
        onboarded: true,
      }}
    >
      <AccountsPage
        householdId={HOUSEHOLD}
        currencies={[
          { code: 'UZS', label: "UZS — O'zbek so'mi" },
          { code: 'USD', label: 'USD — AQSH dollari' },
        ]}
        baseCurrency="UZS"
        timezone="Asia/Tashkent"
      />
      <Toaster />
    </HouseholdProvider>,
  )
  return userEvent.setup()
}

const accountRow = (name: string) => screen.getByRole('row', { name: new RegExp(name) })

describe('AccountsPage (E22-T02)', () => {
  beforeEach(() => {
    signInTestUser()
  })

  it("hisoblar joriy qoldiq bilan; fond — tizim belgisi, boshlang'ich qoldiq yashirin", async () => {
    mockList()
    renderPage()

    expect(await screen.findByText('Hamyon')).toBeInTheDocument()
    expect(within(accountRow('Hamyon')).getByText("1 500 000 so'm")).toBeInTheDocument()
    expect(within(accountRow('Uzcard')).getByText("−25 000 so'm")).toHaveClass('text-expense')
    expect(within(accountRow('Shaxsiy fond')).getByText('Tizim')).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: /Boshlang'ich qoldiq/ })).toBeNull()
  })

  it("viewer — faqat o'qish: qo'shish, amallar va tartiblash yo'q", async () => {
    mockList()
    renderPage('viewer')

    await screen.findByText('Hamyon')
    expect(screen.queryByRole('button', { name: "Hisob qo'shish" })).toBeNull()
    expect(screen.queryByRole('button', { name: /amallar/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Tartibni o'zgartirish/ })).toBeNull()
  })

  it("yangi hisob — ro'yxat oxiriga, summa tiyinda", async () => {
    mockList()
    const insert = vi.fn()
    server.use(
      http.post(supabasePath('/rest/v1/accounts'), async ({ request }) => {
        insert(await request.json())
        return new HttpResponse(null, { status: 201 })
      }),
    )
    const user = renderPage()
    await screen.findByText('Hamyon')

    await user.click(screen.getByRole('button', { name: "Hisob qo'shish" }))
    const dialog = await screen.findByRole('dialog', { name: 'Yangi hisob' })
    await user.type(within(dialog).getByLabelText('Nomi'), 'Humo')
    await user.type(within(dialog).getByLabelText("Boshlang'ich qoldiq"), '1 500 000')
    await user.click(within(dialog).getByRole('button', { name: 'Saqlash' }))

    await waitFor(() => {
      expect(insert).toHaveBeenCalledOnce()
    })
    expect(insert.mock.calls[0]?.[0]).toMatchObject({
      household_id: HOUSEHOLD,
      name: 'Humo',
      type: 'card',
      currency: 'UZS',
      opening_balance: 150000000,
      sort_order: 3,
    })
    expect(await screen.findByText('Saqlandi')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Yangi hisob' })).toBeNull()
    })
  })

  it('nom band (23505) — forma ichida tushunarli xato, oyna yopilmaydi', async () => {
    mockList()
    server.use(
      http.post(supabasePath('/rest/v1/accounts'), () =>
        HttpResponse.json(
          {
            code: '23505',
            message: 'duplicate key value violates unique constraint "accounts_name_key"',
          },
          { status: 409 },
        ),
      ),
    )
    const user = renderPage()
    await screen.findByText('Hamyon')

    await user.click(screen.getByRole('button', { name: "Hisob qo'shish" }))
    const dialog = await screen.findByRole('dialog', { name: 'Yangi hisob' })
    await user.type(within(dialog).getByLabelText('Nomi'), 'hamyon')
    await user.click(within(dialog).getByRole('button', { name: 'Saqlash' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Bu nom band — boshqasini tanlang',
    )
  })

  it('arxivlash — qator darhol yo‘qoladi, server xatosida qaytadi', async () => {
    mockList()
    server.use(
      http.patch(supabasePath('/rest/v1/accounts'), () =>
        HttpResponse.json({ code: 'P0001', message: 'account_in_use' }, { status: 400 }),
      ),
    )
    const user = renderPage()
    await screen.findByText('Uzcard')

    await user.click(screen.getByRole('button', { name: 'Uzcard: amallar' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Arxivlash' }))

    expect(
      await screen.findByText(
        'Hisob ishlatilmoqda (fond manbai, doimiy reja yoki tez tugma) — arxivlang',
      ),
    ).toBeInTheDocument()
    expect(await screen.findByText('Uzcard')).toBeInTheDocument()
  })

  it('qidiruv — nom bo‘yicha', async () => {
    mockList()
    const user = renderPage()
    await screen.findByText('Hamyon')

    await user.type(screen.getByRole('searchbox', { name: 'Qidirish…' }), 'uzc')

    expect(screen.getByText('Uzcard')).toBeInTheDocument()
    expect(screen.queryByText('Hamyon')).toBeNull()
  })
})
