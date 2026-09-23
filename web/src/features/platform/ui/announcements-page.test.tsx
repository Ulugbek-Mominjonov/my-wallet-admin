import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'

import { PlatformAnnouncementsPage } from '@/features/platform/ui/announcements-page'
import { server, signInTestUser, supabasePath } from '@/shared/test/msw'
import { renderWithProviders } from '@/shared/test/render'
import { Toaster } from '@/shared/ui/sonner'

const LOG = {
  items: [
    {
      batch: '0198f000-0000-7000-8000-0000000000f1',
      created_at: '2026-09-22T09:00:00Z',
      users: 12,
      total: 18,
      sent: 16,
      failed: 1,
      pending: 1,
      message: 'Yangi versiya chiqdi',
    },
  ],
}

const calls: { name: string; body: Record<string, unknown> }[] = []

function renderPage() {
  server.use(
    http.post(supabasePath('/rest/v1/rpc/:name'), async ({ request, params }) => {
      const name = String(params.name)
      calls.push({ name, body: (await request.json()) as Record<string, unknown> })
      if (name === 'announcement_log') return HttpResponse.json(LOG)
      if (name === 'platform_users') return HttpResponse.json({ total: 0, users: [] })
      return HttpResponse.json({ batch: 'b1', queued: 24, users: 12 })
    }),
  )
  renderWithProviders(
    <>
      <PlatformAnnouncementsPage />
      <Toaster />
    </>,
  )
  return userEvent.setup()
}

describe('PlatformAnnouncementsPage (E26-T03)', () => {
  beforeEach(() => {
    signInTestUser()
    calls.length = 0
  })

  it('jurnal: paket holati', async () => {
    renderPage()
    const table = await screen.findByRole('table', { name: "Yuborilgan e'lonlar" })
    expect(table).toHaveTextContent('Yangi versiya chiqdi')
    expect(table).toHaveTextContent('Yuborildi: 16')
    expect(table).toHaveTextContent('Xato: 1')
  })

  it('uch til to‘lmaguncha yuborilmaydi', async () => {
    const user = renderPage()
    const send = await screen.findByRole('button', { name: 'Yuborish' })
    expect(send).toBeDisabled()

    await user.type(screen.getByLabelText("Nomi (o'zbekcha)"), 'Salom')
    expect(send).toBeDisabled()
    await user.type(screen.getByLabelText('Nomi (ruscha)'), 'Привет')
    await user.type(screen.getByLabelText('Nomi (inglizcha)'), 'Hello')
    expect(send).toBeEnabled()
  })

  it('tasdiqdan keyin navbatga qo‘yiladi', async () => {
    const user = renderPage()
    await user.type(await screen.findByLabelText("Nomi (o'zbekcha)"), 'Salom')
    await user.type(screen.getByLabelText('Nomi (ruscha)'), 'Привет')
    await user.type(screen.getByLabelText('Nomi (inglizcha)'), 'Hello')
    await user.click(screen.getByRole('button', { name: 'Yuborish' }))

    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Yuborish' }))

    expect(
      await screen.findByText("24 ta xabar navbatga qo'yildi (12 ta foydalanuvchi)"),
    ).toBeInTheDocument()
    expect(calls.filter((call) => call.name === 'send_announcement')).toEqual([
      {
        name: 'send_announcement',
        body: {
          p_message: { uz: 'Salom', ru: 'Привет', en: 'Hello' },
          p_title: null,
          p_channels: ['push', 'telegram'],
        },
      },
    ])
  })
})
