import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { TEST_HOUSEHOLD_ID, WithHousehold } from '@/entities/household/testing'
import type { Insights } from '@/features/reports/api/reports-api'
import { INSIGHTS } from '@/features/reports/testing'
import { InsightsPage } from '@/features/reports/ui/insights-page'
import { formatDate } from '@/shared/lib/date'
import { server, signInTestUser, supabasePath } from '@/shared/test/msw'
import { renderWithProviders } from '@/shared/test/render'

function mockInsights(data: Insights = INSIGHTS) {
  server.use(http.post(supabasePath('/rest/v1/rpc/report_insights'), () => HttpResponse.json(data)))
}

function renderPage() {
  const onMonthChange = vi.fn()
  renderWithProviders(
    <WithHousehold>
      <InsightsPage
        householdId={TEST_HOUSEHOLD_ID}
        month="2026-09"
        currentMonth="2026-09"
        onMonthChange={onMonthChange}
        baseCurrency="UZS"
      />
    </WithHousehold>,
  )
  return { onMonthChange, user: userEvent.setup() }
}

const cardOf = async (title: string): Promise<HTMLElement> => {
  const heading = await screen.findByRole('heading', { name: title })
  const card = heading.closest('[data-slot="card"]')
  if (!card) throw new Error(`Karta topilmadi: ${title}`)
  return card as HTMLElement
}

describe('InsightsPage (E32-T02)', () => {
  beforeEach(() => {
    signInTestUser()
  })

  it('sakragan kategoriya: summa, foiz va o‘rtacha', async () => {
    mockInsights()
    renderPage()

    const card = await cardOf('Sakragan kategoriyalar')
    expect(within(card).getByText('Oziq-ovqat')).toBeInTheDocument()
    expect(within(card).getByText('+100%')).toBeInTheDocument()
    expect(within(card).getByText("o'rtacha 100 000 so'm")).toBeInTheDocument()
  })

  it('obunalar: jadval va oylik/yillik jami', async () => {
    mockInsights()
    renderPage()

    const table = await screen.findByRole('table', { name: 'Obunalar' })
    expect(within(table).getByText('Netflix')).toBeInTheDocument()
    // Sana ko'rinishi brauzer ICU'siga bog'liq — kutilgani shu funksiyadan.
    expect(within(table).getByText(formatDate('2026-09-03', 'uz'))).toBeInTheDocument()
    expect(screen.getByText("Oyiga 50 000 so'm · yiliga 600 000 so'm")).toBeInTheDocument()
  })

  it('eng katta xarajatlar: joy nomsiz qatorda kategoriya ko‘rinadi', async () => {
    mockInsights()
    renderPage()

    const table = await screen.findByRole('table', { name: 'Eng katta xarajatlar' })
    const rows = within(table).getAllByRole('row')
    expect(rows[1]).toHaveTextContent('Korzinka')
    expect(rows[2]).toHaveTextContent('Kommunal')
  })

  it('hafta kunlari — yettovi ham, ulush foizi bilan', async () => {
    mockInsights()
    renderPage()

    const card = await cardOf('Hafta kunlari')
    expect(within(card).getAllByRole('listitem')).toHaveLength(7)
    // 250 000 / 300 000 = 83%.
    expect(within(card).getByText("250 000 so'm · 83%")).toBeInTheDocument()
    expect(within(card).getByText('Shanba')).toBeInTheDocument()
  })

  it('yozuv bo‘lmasa — bo‘sh holat', async () => {
    mockInsights({ ...INSIGHTS, expense: 0, spikes: [], subscriptions: [], top_expenses: [] })
    renderPage()

    expect(await screen.findByText('Tahlil uchun yozuv yo‘q')).toBeInTheDocument()
  })

  it('sakrash bo‘lmasa — bo‘limda izoh', async () => {
    mockInsights({ ...INSIGHTS, spikes: [] })
    renderPage()

    const card = await cardOf('Sakragan kategoriyalar')
    expect(within(card).getByText("Sezilarli o'sish yo'q")).toBeInTheDocument()
  })

  it('oy almashtirish', async () => {
    mockInsights()
    const { onMonthChange, user } = renderPage()

    await cardOf('Obunalar')
    await user.click(screen.getByRole('button', { name: 'Oldingi oy' }))
    expect(onMonthChange).toHaveBeenCalledWith('2026-08')
  })
})
