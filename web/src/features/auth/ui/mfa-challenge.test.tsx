import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { MfaChallenge } from '@/features/auth/ui/mfa-challenge'
import { server, signInTestUser, supabasePath, testUser } from '@/shared/test/msw'
import { renderWithProviders } from '@/shared/test/render'

const FACTOR_ID = '0198f000-0000-7000-8000-0000000000f1'

describe('MfaChallenge', () => {
  beforeEach(() => {
    signInTestUser()
    server.use(
      http.get(supabasePath('/auth/v1/user'), () =>
        HttpResponse.json(
          testUser([
            {
              id: FACTOR_ID,
              factor_type: 'totp',
              status: 'verified',
              created_at: '2026-09-20T08:00:00Z',
              updated_at: '2026-09-20T08:00:00Z',
            },
          ]),
        ),
      ),
      http.post(supabasePath(`/auth/v1/factors/${FACTOR_ID}/challenge`), () =>
        HttpResponse.json({ id: 'challenge-1', type: 'totp', expires_at: 9_999_999_999 }),
      ),
    )
  })

  it("to'g'ri kod — sessiya aal2, davom etiladi", async () => {
    server.use(
      http.post(supabasePath(`/auth/v1/factors/${FACTOR_ID}/verify`), () =>
        HttpResponse.json(signInTestUser({ aal: 'aal2' })),
      ),
    )
    const onVerified = vi.fn()
    const user = userEvent.setup()
    renderWithProviders(<MfaChallenge onVerified={onVerified} />)

    await user.type(await screen.findByLabelText('Tasdiqlash kodi'), '123456')
    await user.click(screen.getByRole('button', { name: 'Tasdiqlash' }))

    await waitFor(() => {
      expect(onVerified).toHaveBeenCalledOnce()
    })
  })

  it("format noto'g'ri — serverga yuborilmaydi", async () => {
    const user = userEvent.setup()
    renderWithProviders(<MfaChallenge onVerified={vi.fn()} />)

    await user.type(await screen.findByLabelText('Tasdiqlash kodi'), '12')
    await user.click(screen.getByRole('button', { name: 'Tasdiqlash' }))

    expect(await screen.findByText('6 xonali kodni kiriting')).toBeInTheDocument()
  })
})
