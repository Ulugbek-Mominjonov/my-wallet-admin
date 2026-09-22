import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { TwoFactorSettings } from '@/features/auth/ui/two-factor-settings'
import { server, signInTestUser, supabasePath, testUser } from '@/shared/test/msw'
import { renderWithProviders } from '@/shared/test/render'

const FACTOR_ID = '0198f000-0000-7000-8000-0000000000f1'
/** GoTrue xom SVG qaytaradi; supabase-js uni data URI ga aylantiradi. */
const QR_SVG = '<svg xmlns="http://www.w3.org/2000/svg"/>'

const verifiedFactor = {
  id: FACTOR_ID,
  factor_type: 'totp',
  status: 'verified',
  created_at: '2026-09-20T08:00:00Z',
  updated_at: '2026-09-20T08:00:00Z',
}

/** `/user` — har chaqiruvda joriy omillar ro'yxati (yoqilgandan keyin o'zgaradi). */
function mockUser(factors: () => object[]) {
  server.use(http.get(supabasePath('/auth/v1/user'), () => HttpResponse.json(testUser(factors()))))
}

describe('TwoFactorSettings', () => {
  beforeEach(() => {
    signInTestUser()
  })

  it("o'chiq → QR va kalit → kod bilan tasdiqlash → yoqilgan", async () => {
    let factors: object[] = []
    mockUser(() => factors)
    const verify = vi.fn()
    server.use(
      http.post(supabasePath('/auth/v1/factors'), () =>
        HttpResponse.json({
          id: FACTOR_ID,
          type: 'totp',
          totp: { qr_code: QR_SVG, secret: 'JBSWY3DPEHPK3PXP', uri: 'otpauth://totp/x' },
        }),
      ),
      http.post(supabasePath(`/auth/v1/factors/${FACTOR_ID}/challenge`), () =>
        HttpResponse.json({ id: 'challenge-1', type: 'totp', expires_at: 9_999_999_999 }),
      ),
      http.post(supabasePath(`/auth/v1/factors/${FACTOR_ID}/verify`), async ({ request }) => {
        verify(await request.json())
        factors = [verifiedFactor]
        const session = signInTestUser({ aal: 'aal2' })
        return HttpResponse.json(session)
      }),
    )
    const user = userEvent.setup()
    renderWithProviders(<TwoFactorSettings />)

    await user.click(await screen.findByRole('button', { name: 'Yoqish' }))
    expect(await screen.findByRole('img', { name: '2FA sozlash uchun QR kod' })).toHaveAttribute(
      'src',
      `data:image/svg+xml;utf-8,${QR_SVG}`,
    )
    expect(screen.getByText('JBSWY3DPEHPK3PXP')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Tasdiqlash kodi'), '123456')
    await user.click(screen.getByRole('button', { name: 'Tasdiqlash' }))

    expect(await screen.findByText(/dan beri yoqilgan/)).toBeInTheDocument()
    expect(verify).toHaveBeenCalledWith(
      expect.objectContaining({ challenge_id: 'challenge-1', code: '123456' }),
    )
  })

  it("noto'g'ri kod — tushunarli xato, sozlash davom etadi", async () => {
    mockUser(() => [])
    server.use(
      http.post(supabasePath('/auth/v1/factors'), () =>
        HttpResponse.json({
          id: FACTOR_ID,
          type: 'totp',
          totp: { qr_code: QR_SVG, secret: 'JBSWY3DPEHPK3PXP', uri: 'otpauth://totp/x' },
        }),
      ),
      http.post(supabasePath(`/auth/v1/factors/${FACTOR_ID}/challenge`), () =>
        HttpResponse.json({ id: 'challenge-1', type: 'totp', expires_at: 9_999_999_999 }),
      ),
      http.post(supabasePath(`/auth/v1/factors/${FACTOR_ID}/verify`), () =>
        HttpResponse.json(
          { code: 422, error_code: 'mfa_verification_failed', msg: 'Invalid TOTP code' },
          { status: 422 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderWithProviders(<TwoFactorSettings />)

    await user.click(await screen.findByRole('button', { name: 'Yoqish' }))
    await user.type(await screen.findByLabelText('Tasdiqlash kodi'), '000000')
    await user.click(screen.getByRole('button', { name: 'Tasdiqlash' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Kod noto'g'ri — ilovadagi yangi kodni kiriting",
    )
    expect(screen.getByRole('img', { name: '2FA sozlash uchun QR kod' })).toBeInTheDocument()
  })

  it("yoqilgan → tasdiqdan keyin o'chiriladi", async () => {
    let factors: object[] = [verifiedFactor]
    mockUser(() => factors)
    server.use(
      http.delete(supabasePath(`/auth/v1/factors/${FACTOR_ID}`), () => {
        factors = []
        return HttpResponse.json({ id: FACTOR_ID })
      }),
    )
    const user = userEvent.setup()
    renderWithProviders(<TwoFactorSettings />)

    await user.click(await screen.findByRole('button', { name: "O'chirish" }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent("2FA o'chirilsinmi?")
    await user.click(within(dialog).getByRole('button', { name: "O'chirish" }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Yoqish' })).toBeInTheDocument()
    })
  })
})
