import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { useState } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'

import type { Account } from '@/entities/account'
import type { Category } from '@/entities/category'
import type { Role } from '@/entities/household'
import { TEST_HOUSEHOLD_ID, WithHousehold } from '@/entities/household/testing'
import type { TransactionSearch } from '@/features/transactions/model/filters'
import { TransactionsPage } from '@/features/transactions/ui/transactions-page'
import {
  businessError,
  server,
  signInTestUser,
  supabasePath,
  TEST_USER_ID,
} from '@/shared/test/msw'
import { renderWithProviders } from '@/shared/test/render'

const CASH = '0198f000-0000-7000-8000-0000000000a1'
const CARD = '0198f000-0000-7000-8000-0000000000a2'
const FOOD = '0198f000-0000-7000-8000-0000000000c1'
const TRANSPORT = '0198f000-0000-7000-8000-0000000000c2'
const TAXI = '0198f000-0000-7000-8000-0000000000c3'
const SALARY = '0198f000-0000-7000-8000-0000000000c4'
const TAG = '0198f000-0000-7000-8000-0000000000e1'
const BOB = '0198f000-0000-7000-8000-000000000002'

const account = (id: string, name: string, type: Account['type']): Account => ({
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
const category = (
  id: string,
  name: string,
  kind: Category['kind'] = 'expense',
  parentId: string | null = null,
  monthShift = 0,
): Category => ({
  id,
  kind,
  name,
  parentId,
  monthShift,
  systemCode: null,
  icon: null,
  color: null,
  sortOrder: 0,
  archivedAt: null,
})

/** `transactions_list` qatori (RPC javobi). */
const row = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  kind: 'expense',
  account_id: CASH,
  to_account_id: null,
  amount: 5000000,
  to_amount: null,
  amount_base: 5000000,
  category_id: FOOD,
  payee: 'Korzinka',
  occurred_on: '2026-09-03',
  budget_month: '2026-09-01',
  budget_month_source: 'auto',
  planned_item_id: null,
  debt_id: null,
  note: null,
  source: 'app',
  created_by: TEST_USER_ID,
  tag_ids: [],
  has_receipt: false,
  ...overrides,
})

const DEBT = '0198f000-0000-7000-8000-0000000000d1'
const DEBTS = [{ id: DEBT, name: 'Mashina krediti', direction: 'i_owe' as const, archived: false }]

const SUMMARY = { count: 3, income: 800000000, expense: 5000000, transfer: 100000000 }

/** URL o'rnida — holat: filtr o'zgarsa sahifa yangi so'rov yuboradi. */
function Harness({
  initial = {},
  memberRole = 'owner',
}: {
  initial?: TransactionSearch
  memberRole?: Role
}) {
  const [search, setSearch] = useState<TransactionSearch>(initial)
  return (
    <WithHousehold memberRole={memberRole}>
      <TransactionsPage
        householdId={TEST_HOUSEHOLD_ID}
        search={search}
        onSearchChange={setSearch}
        currentMonth="2026-09"
        today="2026-09-22"
        baseCurrency="UZS"
        accounts={[account(CASH, 'Naqd', 'cash'), account(CARD, 'Karta', 'card')]}
        categories={[
          category(FOOD, 'Oziq-ovqat'),
          category(TRANSPORT, 'Transport'),
          category(TAXI, 'Taksi', 'expense', TRANSPORT),
          category(SALARY, 'Oylik', 'income', null, -1),
        ]}
        tags={[{ id: TAG, name: "Ta'til", color: null }]}
        members={[
          { value: TEST_USER_ID, label: 'Ali' },
          { value: BOB, label: 'Vali' },
        ]}
        debts={DEBTS}
      />
    </WithHousehold>
  )
}

/** RPC so'rovlari tanasi — filtr va kursor tekshiruvi uchun. */
function mockRpc(pages: (body: Record<string, unknown>) => unknown[], summary = SUMMARY) {
  const calls: Record<string, unknown>[] = []
  server.use(
    http.post(supabasePath('/rest/v1/rpc/transactions_list'), async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>
      calls.push(body)
      return HttpResponse.json(pages(body))
    }),
    http.post(supabasePath('/rest/v1/rpc/transactions_summary'), () => HttpResponse.json(summary)),
  )
  return calls
}

describe('TransactionsPage (E23-T01)', () => {
  beforeEach(() => {
    signInTestUser()
  })

  it('jadval: nomlar spravochnikdan, belgilar va jami; standart — joriy oy', async () => {
    const calls = mockRpc(() => [
      row('t1', { tag_ids: [TAG], has_receipt: true, note: 'haftalik xarid' }),
      row('t2', {
        kind: 'income',
        account_id: CARD,
        amount: 800000000,
        amount_base: 800000000,
        category_id: SALARY,
        payee: 'Ish joyi',
        occurred_on: '2026-10-02',
        budget_month: '2026-09-01',
        created_by: BOB,
      }),
      row('t3', {
        kind: 'transfer',
        account_id: CARD,
        to_account_id: CASH,
        amount: 100000000,
        amount_base: 100000000,
        category_id: null,
        payee: null,
      }),
    ])
    renderWithProviders(<Harness />)

    const table = await screen.findByRole('table', { name: 'Amallar' })
    const expense = within(table).getByRole('row', { name: /Korzinka/ })
    const income = within(table).getByRole('row', { name: /Ish joyi/ })
    const transfer = within(table).getByRole('row', { name: /O'tkazma/ })
    expect(expense).toHaveTextContent('Oziq-ovqat')
    expect(expense).toHaveTextContent('haftalik xarid')
    expect(expense).toHaveTextContent('Ali')
    expect(expense).toHaveTextContent("−50 000 so'm")
    expect(within(expense).getByText("Ta'til")).toBeInTheDocument()
    expect(within(expense).getByRole('img', { name: 'Chek biriktirilgan' })).toBeInTheDocument()
    // BR-040: oktabr boshidagi oylik — sentabr byudjetiga.
    expect(income).toHaveTextContent('Tegishli oy: Sentabr 2026')
    expect(income).toHaveTextContent("+8 000 000 so'm")
    expect(income).toHaveTextContent('Vali')
    expect(transfer).toHaveTextContent("O'tkazma")
    expect(transfer).toHaveTextContent('Karta')
    expect(transfer).toHaveTextContent('Naqd')

    const summary = screen.getByRole('region', { name: "Filtr bo'yicha jami" })
    expect(summary).toHaveTextContent("8 000 000 so'm")
    expect(summary).toHaveTextContent("50 000 so'm")
    expect(screen.getByText("Ko'rsatilgan: 3 / 3")).toBeInTheDocument()
    expect(calls[0]).toEqual({
      p_household: TEST_HOUSEHOLD_ID,
      p_filters: { month: '2026-09-01' },
      p_limit: 50,
    })
  })

  it('yana yuklash — keyingi sahifa oxirgi qator (sana, id) kursori bilan', async () => {
    const first = Array.from({ length: 50 }, (_, i) =>
      row(`p1-${String(i).padStart(2, '0')}`, { occurred_on: '2026-09-20' }),
    )
    const calls = mockRpc(
      (body) =>
        body.p_after_id === undefined ? first : [row('p2-00', { occurred_on: '2026-09-01' })],
      { ...SUMMARY, count: 51 },
    )
    const user = userEvent.setup()
    renderWithProviders(<Harness />)

    await user.click(await screen.findByRole('button', { name: 'Yana yuklash' }))
    expect(await screen.findByText("Ko'rsatilgan: 51 / 51")).toBeInTheDocument()
    expect(calls[1]).toMatchObject({ p_after_date: '2026-09-20', p_after_id: 'p1-49' })
    // Oxirgi sahifa to'lmagan — boshqa sahifa yo'q.
    expect(screen.queryByRole('button', { name: 'Yana yuklash' })).toBeNull()
  })

  it('filtrlar: tur, kategoriya va qidiruv RPC filtriga o‘tadi', async () => {
    const calls = mockRpc(() => [row('t1')])
    const user = userEvent.setup()
    renderWithProviders(<Harness />)
    await screen.findByRole('table', { name: 'Amallar' })

    await user.click(screen.getByRole('button', { name: 'Xarajat' }))
    await user.click(screen.getByRole('button', { name: 'Kategoriya' }))
    await user.click(await screen.findByRole('option', { name: 'Transport' }))
    await user.type(
      screen.getByRole('searchbox', { name: "Joy yoki izoh bo'yicha qidirish" }),
      'korz',
    )

    await waitFor(() => {
      expect(calls.at(-1)?.p_filters).toEqual({
        month: '2026-09-01',
        kinds: ['expense'],
        categories: [TRANSPORT],
        q: 'korz',
      })
    })
    expect(screen.getByRole('button', { name: 'Xarajat' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('qidiruvda pauza — so‘z oxiridagi probel o‘chmaydi', async () => {
    const calls = mockRpc(() => [row('t1')])
    const user = userEvent.setup()
    renderWithProviders(<Harness />)
    await screen.findByRole('table', { name: 'Amallar' })
    const box = screen.getByRole('searchbox', { name: "Joy yoki izoh bo'yicha qidirish" })

    await user.type(box, 'yandex ')
    await waitFor(() => {
      expect(calls.at(-1)?.p_filters).toMatchObject({ q: 'yandex' })
    })
    await user.type(box, 'go')
    expect(box).toHaveValue('yandex go')
    await waitFor(() => {
      expect(calls.at(-1)?.p_filters).toMatchObject({ q: 'yandex go' })
    })
  })

  it('summa oralig‘i — asosiy valyutaning eng kichik birligida', async () => {
    const calls = mockRpc(() => [row('t1')])
    const user = userEvent.setup()
    renderWithProviders(<Harness />)
    await screen.findByRole('table', { name: 'Amallar' })

    await user.click(screen.getByRole('button', { name: 'Summa' }))
    await user.type(await screen.findByLabelText('Kamida'), 'abc')
    await user.click(screen.getByRole('button', { name: "Qo'llash" }))
    expect(await screen.findByRole('alert')).toHaveTextContent("Summani to'g'ri kiriting")

    await user.clear(screen.getByLabelText('Kamida'))
    await user.type(screen.getByLabelText('Kamida'), '100 000')
    await user.click(screen.getByRole('button', { name: "Qo'llash" }))
    await waitFor(() => {
      expect(calls.at(-1)?.p_filters).toEqual({ month: '2026-09-01', min: 10000000 })
    })
  })

  it('filtr bo‘yicha bo‘sh — tozalash tugmasi davrni saqlab filtrlarni olib tashlaydi', async () => {
    const calls = mockRpc((body) => ((body.p_filters as { q?: string }).q ? [] : [row('t1')]), {
      ...SUMMARY,
      count: 0,
    })
    const user = userEvent.setup()
    renderWithProviders(<Harness initial={{ month: '2026-08', q: 'topilmaydi' }} />)

    expect(await screen.findByText("Filtr bo'yicha amal topilmadi")).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Filtrlarni tozalash' }))

    expect(await screen.findByRole('table', { name: 'Amallar' })).toBeInTheDocument()
    expect(calls.at(-1)?.p_filters).toEqual({ month: '2026-08-01' })
    expect(screen.getByRole('searchbox', { name: "Joy yoki izoh bo'yicha qidirish" })).toHaveValue(
      '',
    )
  })
})

const SAVED_ID = '0198f000-0000-7000-8000-0000000000f1'

/** Forma so'rovlari: rejalar, oy holati, joy takliflari, saqlash. */
function mockForm({
  closed = false,
  suggestions = [],
  saveError,
}: {
  closed?: boolean
  suggestions?: object[]
  saveError?: string
} = {}) {
  const saved: Record<string, unknown>[] = []
  server.use(
    http.get(supabasePath('/rest/v1/planned_items'), () => HttpResponse.json([])),
    http.get(supabasePath('/rest/v1/months'), () =>
      HttpResponse.json(closed ? [{ closed_at: '2026-10-01T00:00:00Z' }] : []),
    ),
    http.post(supabasePath('/rest/v1/rpc/payee_suggestions'), () => HttpResponse.json(suggestions)),
    http.post(supabasePath('/rest/v1/rpc/save_transaction'), async ({ request }) => {
      saved.push((await request.json()) as Record<string, unknown>)
      return saveError
        ? HttpResponse.json(businessError(saveError), { status: 400 })
        : HttpResponse.json(SAVED_ID)
    }),
  )
  return saved
}

async function chooseOption(
  user: ReturnType<typeof userEvent.setup>,
  scope: HTMLElement,
  field: string,
  option: string,
) {
  await user.click(within(scope).getByRole('combobox', { name: field }))
  await user.click(await screen.findByRole('option', { name: option }))
}

describe('TransactionForm (E23-T02)', () => {
  beforeEach(() => {
    signInTestUser()
  })

  it('yangi xarajat: tegishli oy jonli, RPC ga aniq parametrlar, ro‘yxat yangilanadi', async () => {
    const calls = mockRpc(() => [])
    const saved = mockForm()
    const user = userEvent.setup()
    renderWithProviders(<Harness />)

    await user.click(await screen.findByRole('button', { name: "Amal qo'shish" }))
    const dialog = await screen.findByRole('dialog', { name: 'Yangi amal' })
    expect(within(dialog).getByText('Sentabr 2026')).toBeInTheDocument()

    await user.type(within(dialog).getByLabelText('Summa (UZS)'), '50 000')
    await chooseOption(user, dialog, 'Hisob', 'Naqd')
    await chooseOption(user, dialog, 'Kategoriya', 'Oziq-ovqat')
    await user.type(within(dialog).getByLabelText('Joy / nomi'), 'Korzinka')
    await user.click(within(dialog).getByRole('button', { name: 'Saqlash' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Yangi amal' })).toBeNull()
    })
    expect(saved).toEqual([
      {
        p_household: TEST_HOUSEHOLD_ID,
        p_kind: 'expense',
        p_account_id: CASH,
        p_amount: 5000000,
        p_occurred_on: '2026-09-22',
        p_category_id: FOOD,
        p_payee: 'Korzinka',
        p_tag_ids: [],
      },
    ])
    await waitFor(() => {
      expect(calls.length).toBeGreaterThan(1)
    })
  })

  it('BR-040/045: daromad oyi kategoriya siljishi bilan jonli; BR-042: qo‘lda oy', async () => {
    mockRpc(() => [])
    const saved = mockForm()
    const user = userEvent.setup()
    renderWithProviders(<Harness />)

    await user.click(await screen.findByRole('button', { name: "Amal qo'shish" }))
    const dialog = await screen.findByRole('dialog', { name: 'Yangi amal' })
    await user.click(within(dialog).getByRole('button', { name: 'Daromad' }))
    await user.type(within(dialog).getByLabelText('Summa (UZS)'), '9 000 000')
    await chooseOption(user, dialog, 'Hisob', 'Karta')
    await chooseOption(user, dialog, 'Kategoriya', 'Oylik')
    // 22-sentabr, siljish −1 → avgust.
    expect(within(dialog).getByText('Avgust 2026')).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: "Oyni o'zgartirish" }))
    await chooseOption(user, dialog, 'Tegishli oy', 'Iyul 2026')
    await user.click(within(dialog).getByRole('button', { name: 'Saqlash' }))

    await waitFor(() => {
      expect(saved[0]).toMatchObject({
        p_kind: 'income',
        p_account_id: CARD,
        p_category_id: SALARY,
        p_budget_month: '2026-07-01',
      })
    })
  })

  it('BR-056: tarixdagi joy nomi tanlansa — oxirgi kategoriya va hisob to‘ldiriladi', async () => {
    mockRpc(() => [])
    mockForm({
      suggestions: [
        { payee: 'Korzinka', category_id: FOOD, account_id: CASH, last_used: '2026-09-01' },
      ],
    })
    const user = userEvent.setup()
    const { container } = renderWithProviders(<Harness />)

    await user.click(await screen.findByRole('button', { name: "Amal qo'shish" }))
    const dialog = await screen.findByRole('dialog', { name: 'Yangi amal' })
    const payee = within(dialog).getByLabelText('Joy / nomi')
    await user.type(payee, 'Kor')
    await waitFor(() => {
      expect(
        container.ownerDocument.querySelector('#tx-payee-suggestions option[value="Korzinka"]'),
      ).not.toBeNull()
    })
    await user.type(payee, 'zinka')

    expect(within(dialog).getByRole('combobox', { name: 'Kategoriya' })).toHaveTextContent(
      'Oziq-ovqat',
    )
    expect(within(dialog).getByRole('combobox', { name: 'Hisob' })).toHaveTextContent('Naqd')
  })

  it('tahrirlash — mavjud qiymatlar va id bilan; o‘chirish — tasdiq bilan', async () => {
    mockRpc(() => [row('t1', { tag_ids: [TAG], note: 'eski' })])
    const saved = mockForm()
    const removed: Record<string, unknown>[] = []
    server.use(
      http.patch(supabasePath('/rest/v1/transactions'), async ({ request }) => {
        removed.push({
          query: new URL(request.url).searchParams.get('id'),
          ...((await request.json()) as object),
        })
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const user = userEvent.setup()
    renderWithProviders(<Harness />)

    await user.click(await screen.findByRole('button', { name: 'Korzinka: amallar' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Tahrirlash' }))
    const dialog = await screen.findByRole('dialog', { name: 'Amalni tahrirlash' })
    // Guruhlash — bo'linmas probel (formatMoneyInput).
    expect(within(dialog).getByLabelText('Summa (UZS)')).toHaveValue('50\u00a0000')
    const note = within(dialog).getByLabelText('Izoh')
    await user.clear(note)
    await user.type(note, 'yangi izoh')
    await user.click(within(dialog).getByRole('button', { name: 'Saqlash' }))
    await waitFor(() => {
      expect(saved[0]).toMatchObject({ p_id: 't1', p_note: 'yangi izoh', p_tag_ids: [TAG] })
    })

    await user.click(await screen.findByRole('button', { name: 'Korzinka: amallar' }))
    await user.click(await screen.findByRole('menuitem', { name: "O'chirish" }))
    const confirm = await screen.findByRole('dialog', { name: "Amal o'chirilsinmi?" })
    await user.click(within(confirm).getByRole('button', { name: "O'chirish" }))
    await waitFor(() => {
      expect(removed[0]?.query).toBe('eq.t1')
    })
    expect(typeof removed[0]?.deleted_at).toBe('string')
  })

  it('viewer: qo‘shish tugmasi va qator amallari yo‘q', async () => {
    mockRpc(() => [row('t1')])
    renderWithProviders(<Harness memberRole="viewer" />)
    await screen.findByRole('table', { name: 'Amallar' })
    expect(screen.queryByRole('button', { name: "Amal qo'shish" })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Korzinka: amallar' })).toBeNull()
  })

  it('BR-055: yopilgan oy — ogohlantirish; qattiq qulf xatosi formada', async () => {
    mockRpc(() => [])
    mockForm({ closed: true, saveError: 'month_closed' })
    const user = userEvent.setup()
    renderWithProviders(<Harness />)

    await user.click(await screen.findByRole('button', { name: "Amal qo'shish" }))
    const dialog = await screen.findByRole('dialog', { name: 'Yangi amal' })
    expect(await within(dialog).findByRole('status')).toHaveTextContent('Bu oy yopilgan')

    await user.type(within(dialog).getByLabelText('Summa (UZS)'), '1 000')
    await chooseOption(user, dialog, 'Hisob', 'Naqd')
    await chooseOption(user, dialog, 'Kategoriya', 'Oziq-ovqat')
    await user.click(within(dialog).getByRole('button', { name: 'Saqlash' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Oy yopilgan (qattiq qulf) — avval oyni qayta oching',
    )
  })
})
