import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'

import { TEST_HOUSEHOLD_ID, WithHousehold } from '@/entities/household/testing'
import { NotificationsPage } from '@/features/notifications/ui/notifications-page'
import { server, signInTestUser, supabasePath } from '@/shared/test/msw'
import { renderWithProviders } from '@/shared/test/render'

const PREFS = {
  push: true,
  telegram: false,
  email: false,
  reminder_hour: 9,
  days_ahead: 3,
  monthly_report: true,
  report_day: 21,
  limit_alerts: true,
  income_missing: true,
}

const OUTBOX = [
  {
    id: 7,
    channel: 'push',
    type: 'daily_reminder',
    status: 'sent',
    error: null,
    created_at: '2026-09-22T04:00:00Z',
    sent_at: '2026-09-22T04:00:03Z',
  },
  {
    id: 6,
    channel: 'telegram',
    type: 'test',
    status: 'skipped',
    error: 'not_linked',
    created_at: '2026-09-21T10:00:00Z',
    sent_at: null,
  },
]

const ARCHIVE = [
  {
    month: '2026-08-01',
    generated_at: '2026-09-21T03:00:00Z',
    payload: { income: 900000000, expense: 600000000, saved: 300000000, saved_ratio: 0.33 },
  },
]

const patches: Record<string, unknown>[] = []
const rpc: { name: string; body: Record<string, unknown> }[] = []

function renderPage({ linked = false }: { linked?: boolean } = {}) {
  server.use(
    http.get(supabasePath('/rest/v1/notification_prefs'), () => HttpResponse.json(PREFS)),
    http.patch(supabasePath('/rest/v1/notification_prefs'), async ({ request }) => {
      patches.push((await request.json()) as Record<string, unknown>)
      return new HttpResponse(null, { status: 204 })
    }),
    http.get(supabasePath('/rest/v1/telegram_links'), () =>
      HttpResponse.json(linked ? [{ linked_at: '2026-09-01T12:00:00Z' }] : []),
    ),
    http.get(supabasePath('/rest/v1/notification_outbox'), () => HttpResponse.json(OUTBOX)),
    http.get(supabasePath('/rest/v1/monthly_reports'), () => HttpResponse.json(ARCHIVE)),
    http.post(supabasePath('/rest/v1/rpc/:name'), async ({ request, params }) => {
      const name = String(params.name)
      rpc.push({ name, body: (await request.json()) as Record<string, unknown> })
      if (name === 'telegram_link_token') {
        return HttpResponse.json({ token: 'a'.repeat(32), expires_at: '2026-09-23T12:15:00Z' })
      }
      if (name === 'test_notification') {
        return HttpResponse.json([
          { channel: 'push', queued: true, reason: null },
          { channel: 'telegram', queued: false, reason: 'not_linked' },
          { channel: 'email', queued: false, reason: 'not_configured' },
        ])
      }
      return HttpResponse.json({
        report: { income: 900000000, expense: 600000000, saved: 300000000 },
        channels: [{ channel: 'push', queued: true, reason: null }],
      })
    }),
  )
  renderWithProviders(
    <WithHousehold>
      <NotificationsPage
        householdId={TEST_HOUSEHOLD_ID}
        currentMonth="2026-09"
        baseCurrency="UZS"
      />
    </WithHousehold>,
  )
  return userEvent.setup()
}

describe('NotificationsPage (E25-T06)', () => {
  beforeEach(() => {
    signInTestUser()
    patches.length = 0
    rpc.length = 0
  })

  it('sozlama darhol saqlanadi; Telegram ulanmaguncha kanal o‘chiq', async () => {
    const user = renderPage()
    // Base UI switch — ARIA holati (native disabled atributi yo'q).
    const telegram = await screen.findByRole('switch', { name: 'Telegram' })
    expect(telegram).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByText("Avval Telegram'ni ulang")).toBeInTheDocument()

    await user.click(screen.getByRole('switch', { name: 'Ilova (push)' }))
    expect(await screen.findByText('Saqlandi')).toBeInTheDocument()
    expect(patches).toEqual([{ push: false }])
  })

  it('ulash havolasi va QR ko‘rsatiladi', async () => {
    const user = renderPage()
    await user.click(await screen.findByRole('button', { name: 'Ulash' }))

    const url = `https://t.me/mywallet_test_bot?start=${'a'.repeat(32)}`
    expect(await screen.findByRole('link', { name: url })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Telegram botiga ulash havolasi (QR)' })).toBeVisible()
  })

  it('sinov xabari: har kanal uchun natija yoki sabab', async () => {
    const user = renderPage()
    await user.click(await screen.findByRole('button', { name: 'Sinov xabari' }))

    expect(await screen.findByText("Push: navbatga qo'yildi")).toBeInTheDocument()
    expect(screen.getByText('Telegram: ulanmagan')).toBeInTheDocument()
    expect(screen.getByText('Email: server sozlamagan')).toBeInTheDocument()
  })

  it('hisobotni hozir yuborish — tanlangan oy va yakun', async () => {
    const user = renderPage()
    await user.click(await screen.findByRole('button', { name: 'Hisobotni hozir yuborish' }))

    expect(
      await screen.findByText(/Avgust 2026: daromad 9 000 000 so'm, xarajat 6 000 000 so'm/),
    ).toBeInTheDocument()
    expect(rpc.at(-1)).toEqual({
      name: 'send_monthly_report_now',
      body: { p_household: TEST_HOUSEHOLD_ID, p_month: '2026-08-01' },
    })
  })

  it('jurnal va arxiv jadvallari', async () => {
    renderPage()
    const log = await screen.findByRole('table', { name: 'Yuborish jurnali' })
    expect(log).toHaveTextContent('Yuborildi')
    expect(log).toHaveTextContent('ulanmagan')

    const archive = screen.getByRole('table', { name: 'Oylik hisobotlar arxivi' })
    expect(archive).toHaveTextContent('Avgust 2026')
    expect(archive).toHaveTextContent('33%')
  })
})
