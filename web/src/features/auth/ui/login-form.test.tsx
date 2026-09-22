import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'

import { LoginForm } from '@/features/auth/ui/login-form'
import { server, supabasePath } from '@/shared/test/msw'
import { renderWithProviders } from '@/shared/test/render'

const EMAIL = 'ali@misol.uz'

/** GoTrue `verify` muvaffaqiyatli javobi (sessiya). */
const SESSION = {
  access_token: 'test-access-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: 'test-refresh-token',
  user: {
    id: '0198f000-0000-7000-8000-000000000001',
    aud: 'authenticated',
    email: EMAIL,
    app_metadata: {},
    user_metadata: {},
    created_at: '2026-09-01T00:00:00Z',
  },
}

function renderForm() {
  const onSignedIn = vi.fn()
  renderWithProviders(<LoginForm redirect="/" onSignedIn={onSignedIn} />)
  return { onSignedIn, user: userEvent.setup() }
}

async function requestCode(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Email'), EMAIL)
  await user.click(screen.getByRole('button', { name: 'Kod olish' }))
  await screen.findByText(`Kod ${EMAIL} manziliga yuborildi`)
}

describe('LoginForm', () => {
  it("noto'g'ri email — so'rov yuborilmaydi, maydon ostida xato", async () => {
    const { user } = renderForm()
    await user.type(screen.getByLabelText('Email'), 'ali@')
    await user.click(screen.getByRole('button', { name: 'Kod olish' }))

    expect(await screen.findByText("Email manzilini to'g'ri kiriting")).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
  })

  it('email → 6 xonali kod → kirildi', async () => {
    const otp = vi.fn()
    server.use(
      http.post(supabasePath('/auth/v1/otp'), async ({ request }) => {
        otp(await request.json())
        return HttpResponse.json({})
      }),
      http.post(supabasePath('/auth/v1/verify'), () => HttpResponse.json(SESSION)),
    )
    const { user, onSignedIn } = renderForm()

    await requestCode(user)
    expect(otp).toHaveBeenCalledWith(expect.objectContaining({ email: EMAIL, create_user: true }))
    expect(screen.getByRole('button', { name: /Qayta yuborish: \d+ s/ })).toBeDisabled()

    await user.type(screen.getByLabelText('Kod'), '123456')
    await user.click(screen.getByRole('button', { name: 'Kirish' }))
    await waitFor(() => {
      expect(onSignedIn).toHaveBeenCalledOnce()
    })
  })

  it("kod formati noto'g'ri — serverga yuborilmaydi", async () => {
    server.use(http.post(supabasePath('/auth/v1/otp'), () => HttpResponse.json({})))
    const { user } = renderForm()

    await requestCode(user)
    await user.type(screen.getByLabelText('Kod'), '12a')
    await user.click(screen.getByRole('button', { name: 'Kirish' }))

    expect(await screen.findByText('6 xonali kodni kiriting')).toBeInTheDocument()
  })

  it('eskirgan kod — GoTrue xatosi tushunarli matnga aylanadi', async () => {
    server.use(
      http.post(supabasePath('/auth/v1/otp'), () => HttpResponse.json({})),
      http.post(supabasePath('/auth/v1/verify'), () =>
        HttpResponse.json(
          { code: 403, error_code: 'otp_expired', msg: 'Token has expired or is invalid' },
          { status: 403 },
        ),
      ),
    )
    const { user, onSignedIn } = renderForm()

    await requestCode(user)
    await user.type(screen.getByLabelText('Kod'), '654321')
    await user.click(screen.getByRole('button', { name: 'Kirish' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Kod noto'g'ri yoki eskirgan — yangisini oling",
    )
    expect(onSignedIn).not.toHaveBeenCalled()
  })

  it("ko'p urinish — kod yuborish cheklovi ko'rsatiladi, qadam o'zgarmaydi", async () => {
    server.use(
      http.post(supabasePath('/auth/v1/otp'), () =>
        HttpResponse.json(
          { code: 429, error_code: 'over_email_send_rate_limit', msg: 'rate limit' },
          { status: 429 },
        ),
      ),
    )
    const { user } = renderForm()

    await user.type(screen.getByLabelText('Email'), EMAIL)
    await user.click(screen.getByRole('button', { name: 'Kod olish' }))

    expect(await screen.findByRole('alert')).toHaveTextContent("Juda ko'p urinish")
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
  })
})
