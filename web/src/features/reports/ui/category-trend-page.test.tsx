import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Category } from '@/entities/category'
import { TEST_HOUSEHOLD_ID, WithHousehold } from '@/entities/household/testing'
import { CategoryTrendPage } from '@/features/reports/ui/category-trend-page'
import { server, signInTestUser, supabasePath } from '@/shared/test/msw'
import { renderWithProviders } from '@/shared/test/render'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children?: ReactNode }) => <a href="/">{children}</a>,
}))

const CATEGORIES = [
  { id: 'c-food', name: 'Oziq-ovqat', kind: 'expense' } as Category,
  { id: 'c-transport', name: 'Transport', kind: 'expense' } as Category,
]

const TREND = {
  series: [
    { month: '2026-08-01', category_id: 'c-food', actual: 30000000 },
    { month: '2026-09-01', category_id: 'c-food', actual: 20000000 },
    { month: '2026-09-01', category_id: 'c-transport', actual: 10000000 },
  ],
  compare: [
    {
      category_id: 'c-food',
      actual: 20000000,
      prev: 30000000,
      avg3: 25000000,
      vs_prev: -0.3333,
      vs_avg3: -0.2,
    },
    {
      category_id: 'c-transport',
      actual: 10000000,
      prev: 0,
      avg3: 0,
      vs_prev: null,
      vs_avg3: null,
    },
  ],
}

function renderPage(categoryId: string | null = null) {
  server.use(
    http.post(supabasePath('/rest/v1/rpc/report_category_trend'), () => HttpResponse.json(TREND)),
  )
  const onCategoryChange = vi.fn()
  const onRangeChange = vi.fn()
  renderWithProviders(
    <WithHousehold>
      <CategoryTrendPage
        householdId={TEST_HOUSEHOLD_ID}
        from="2026-04"
        to="2026-09"
        categoryId={categoryId}
        onRangeChange={onRangeChange}
        onCategoryChange={onCategoryChange}
        currentMonth="2026-09"
        baseCurrency="UZS"
        categories={CATEGORIES}
      />
    </WithHousehold>,
  )
  return { onCategoryChange, onRangeChange, user: userEvent.setup() }
}

describe('CategoryTrendPage (E24-T05)', () => {
  beforeEach(() => {
    signInTestUser()
  })

  it('solishtirish jadvali: kamayish bo‘yicha, o‘sish/kamayish foizi (BR-095)', async () => {
    renderPage()
    const table = await screen.findByRole('table', { name: 'Kategoriya tahlili' })
    const rows = within(table).getAllByRole('row')
    expect(rows[1]).toHaveTextContent('Oziq-ovqat')
    expect(rows[1]).toHaveTextContent('-33%')
    expect(rows[1]).toHaveTextContent('-20%')
    // Baza nol bo'lsa — chiziqcha.
    expect(rows[2]).toHaveTextContent('Transport')
    expect(rows[2]).toHaveTextContent('—')
  })

  it('kategoriyani tanlash — trend faqat o‘shaniki va amallarga havola', async () => {
    const { onCategoryChange, user } = renderPage()
    const table = await screen.findByRole('table', { name: 'Kategoriya tahlili' })
    await user.click(within(table).getByRole('button', { name: 'Oziq-ovqat' }))
    expect(onCategoryChange).toHaveBeenCalledWith('c-food')
  })

  it('tanlangan kategoriyada sarlavha va amallar havolasi ko‘rinadi', async () => {
    renderPage('c-food')
    const figure = await screen.findByRole('figure', { name: 'Oyma-oy xarajat' })
    expect(figure).toHaveTextContent('Oziq-ovqat')
    expect(screen.getByRole('link', { name: 'Amallarni ko‘rish' })).toBeInTheDocument()
  })
})
