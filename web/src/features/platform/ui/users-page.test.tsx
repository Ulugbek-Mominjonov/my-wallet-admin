import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'

import { PlatformUsersPage } from '@/features/platform/ui/users-page'
import { server, signInTestUser, supabasePath } from '@/shared/test/msw'
import { renderWithProviders } from '@/shared/test/render'
import { Toaster } from '@/shared/ui/sonner'

const USERS = {
  total: 2,
  users: [
    {
      user_id: '0198f000-0000-7000-8000-000000000001',
      email: 'ali@misol.uz',
      display_name: 'Ali',
      locale: 'uz',
      created_at: '2026-09-01T10:00:00Z',
      last_sign_in_at: '2026-09-23T06:00:00Z',
      blocked: false,
      households: 2,
      is_admin: false,
    },
    {
      user_id: '0198f000-0000-7000-8000-000000000002',
      email: 'root@misol.uz',
      display_name: 'Root',
      locale: 'uz',
      created_at: '2026-08-01T10:00:00Z',
      last_sign_in_at: null,
      blocked: false,
      households: 1,
      is_admin: true,
    },
  ],
}

const calls: { name: string; body: Record<string, unknown> }[] = []

function renderPage() {
  server.use(
    http.post(supabasePath('/rest/v1/rpc/:name'), async ({ request, params }) => {
      const name = String(params.name)
      calls.push({ name, body: (await request.json()) as Record<string, unknown> })
      if (name === 'platform_users') return HttpResponse.json(USERS)
      return HttpResponse.json({ user_id: 'x', blocked: true })
    }),
  )
  renderWithProviders(
    <>
      <PlatformUsersPage />
      <Toaster />
    </>,
  )
  return userEvent.setup()
}

describe('PlatformUsersPage (E26-T04)', () => {
  beforeEach(() => {
    signInTestUser()
    calls.length = 0
  })

  it('agregat ro‘yxat: byudjetlar soni va oxirgi kirish', async () => {
    renderPage()
    const table = await screen.findByRole('table', { name: 'Foydalanuvchilar' })
    expect(table).toHaveTextContent('ali@misol.uz')
    expect(table).toHaveTextContent('2')
    // Hech qachon kirmagan — chiziqcha.
    expect(table).toHaveTextContent('—')
    expect(screen.getByText('Jami: 2')).toBeInTheDocument()
  })

  it('platforma adminini bloklab bo‘lmaydi', async () => {
    renderPage()
    await screen.findByRole('table', { name: 'Foydalanuvchilar' })
    expect(screen.getAllByRole('button', { name: 'Bloklash' })).toHaveLength(1)
  })

  it('bloklash tasdiqdan keyin', async () => {
    const user = renderPage()
    await screen.findByRole('table', { name: 'Foydalanuvchilar' })
    await user.click(screen.getByRole('button', { name: 'Bloklash' }))

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('ali@misol.uz')
    await user.click(within(dialog).getByRole('button', { name: 'Bloklash' }))

    expect(await screen.findByText('Foydalanuvchi bloklandi')).toBeInTheDocument()
    expect(calls.filter((call) => call.name === 'platform_set_blocked')).toEqual([
      { name: 'platform_set_blocked', body: { p_user: USERS.users[0]?.user_id, p_blocked: true } },
    ])
  })

  it('qidiruv serverga boradi', async () => {
    const user = renderPage()
    await screen.findByRole('table', { name: 'Foydalanuvchilar' })
    await user.type(screen.getByLabelText('Email yoki ism'), 'ali')
    await user.click(screen.getByRole('button', { name: 'Qidirish' }))
    expect(calls.at(-1)?.body).toMatchObject({ p_query: 'ali' })
  })
})
