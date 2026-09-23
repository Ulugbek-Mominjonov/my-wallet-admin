import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'

import { PlatformDirectoriesPage } from '@/features/platform/ui/directories-page'
import { Toaster } from '@/shared/ui/sonner'
import { server, signInTestUser, supabasePath } from '@/shared/test/msw'
import { renderWithProviders } from '@/shared/test/render'

const CURRENCIES = [
  {
    code: 'UZS',
    name_i18n: { uz: "O'zbek so'mi", ru: 'Узбекский сум', en: 'Uzbek som' },
    symbol: "so'm",
    exponent: 2,
    active: true,
    sort_order: 1,
  },
]

const TEMPLATES = [
  {
    id: '0198f000-0000-7000-8000-0000000000c1',
    kind: 'expense',
    name_i18n: { uz: 'Oziq-ovqat', ru: 'Продукты', en: 'Groceries' },
    icon: 'cart',
    color: '#22C55E',
    month_shift: 0,
    system_code: null,
    sort_order: 13,
  },
  {
    id: '0198f000-0000-7000-8000-0000000000c2',
    kind: 'expense',
    name_i18n: { uz: "O'zim uchun", ru: 'Для себя', en: 'For myself' },
    icon: 'user',
    color: '#8B5CF6',
    month_shift: 0,
    system_code: 'personal_allocation',
    sort_order: 22,
  },
]

const CARDS = [
  {
    id: '0198f000-0000-7000-8000-0000000000d1',
    bank: 'Kapitalbank',
    pattern: '(?<amount>[0-9 ]+) UZS (?<payee>.+)',
    kind: 'expense',
    amount_unit: 'major',
    currency: 'UZS',
    sample: '25 000 UZS KORZINKA',
    active: true,
    sort_order: 1,
  },
]

const writes: { method: string; path: string; body: unknown }[] = []

function renderPage() {
  server.use(
    http.get(supabasePath('/rest/v1/currencies'), () => HttpResponse.json(CURRENCIES)),
    http.get(supabasePath('/rest/v1/category_templates'), () => HttpResponse.json(TEMPLATES)),
    http.get(supabasePath('/rest/v1/card_message_templates'), () => HttpResponse.json(CARDS)),
    http.post(supabasePath('/rest/v1/:table'), async ({ request, params }) => {
      writes.push({
        method: 'POST',
        path: String(params.table),
        body: await request.json(),
      })
      return new HttpResponse(null, { status: 201 })
    }),
  )
  renderWithProviders(
    <>
      <PlatformDirectoriesPage />
      <Toaster />
    </>,
  )
  return userEvent.setup()
}

describe('PlatformDirectoriesPage (E26-T01)', () => {
  beforeEach(() => {
    signInTestUser()
    writes.length = 0
  })

  it('uch spravochnik: valyuta, shablon va karta naqshi', async () => {
    const user = renderPage()
    const currencies = await screen.findByRole('table', { name: 'Valyutalar' })
    expect(currencies).toHaveTextContent('UZS')
    expect(currencies).toHaveTextContent("O'zbek so'mi")

    await user.click(screen.getByRole('tab', { name: 'Karta shablonlari' }))
    const cards = await screen.findByRole('table', { name: 'Karta shablonlari' })
    expect(cards).toHaveTextContent('Kapitalbank')
    expect(cards).toHaveTextContent('(?<amount>')
  })

  it('tizim shabloni o‘chirilmaydi', async () => {
    const user = renderPage()
    await screen.findByRole('table', { name: 'Valyutalar' })
    await user.click(screen.getByRole('tab', { name: 'Kategoriya shablonlari' }))
    await screen.findByRole('table', { name: 'Kategoriya shablonlari' })

    await user.click(screen.getByRole('button', { name: /O'zim uchun/ }))
    expect(screen.queryByRole('menuitem', { name: "O'chirish" })).toBeNull()
  })

  it('yangi valyuta qo‘shiladi (kod katta harfda)', async () => {
    const user = renderPage()
    await screen.findByRole('table', { name: 'Valyutalar' })
    await user.click(screen.getByRole('button', { name: "Qo'shish" }))

    const form = await screen.findByRole('dialog', { name: 'Valyuta' })
    await user.type(within(form).getByLabelText('Kod'), 'kzt')
    await user.type(within(form).getByLabelText("Nomi (o'zbekcha)"), 'Tenge')
    await user.type(within(form).getByLabelText('Nomi (ruscha)'), 'Тенге')
    await user.type(within(form).getByLabelText('Nomi (inglizcha)'), 'Tenge')
    await user.type(within(form).getByLabelText('Belgi'), '₸')
    await user.click(within(form).getByRole('button', { name: 'Saqlash' }))

    expect(await screen.findByText('Saqlandi')).toBeInTheDocument()
    expect(writes).toEqual([
      {
        method: 'POST',
        path: 'currencies',
        body: {
          code: 'KZT',
          name_i18n: { uz: 'Tenge', ru: 'Тенге', en: 'Tenge' },
          symbol: '₸',
          exponent: 2,
          active: true,
          sort_order: 0,
        },
      },
    ])
  })

  it('karta naqshi namunaga darhol qo‘llanadi', async () => {
    const user = renderPage()
    await screen.findByRole('table', { name: 'Valyutalar' })
    await user.click(screen.getByRole('tab', { name: 'Karta shablonlari' }))
    await screen.findByRole('table', { name: 'Karta shablonlari' })
    await user.click(screen.getByRole('button', { name: /Kapitalbank/ }))
    await user.click(await screen.findByRole('menuitem', { name: 'Tahrirlash' }))

    const form = await screen.findByRole('dialog', { name: 'Karta xabar shabloni' })
    expect(within(form).getByText('amount')).toBeInTheDocument()
    expect(within(form).getByText('25 000')).toBeInTheDocument()
    expect(within(form).getByText('KORZINKA')).toBeInTheDocument()
  })
})
