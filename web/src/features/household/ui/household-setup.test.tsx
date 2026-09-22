import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'

import { HouseholdSetup } from '@/features/household/ui/household-setup'
import { businessError, server, supabasePath } from '@/shared/test/msw'
import { renderWithProviders } from '@/shared/test/render'

const NEW_ID = '0198f000-0000-7000-8000-0000000000cc'

function renderSetup() {
  const onReady = vi.fn()
  renderWithProviders(<HouseholdSetup onReady={onReady} />)
  return { onReady, user: userEvent.setup() }
}

describe('HouseholdSetup', () => {
  it('yangi byudjet — nom bilan yaratiladi, ID qaytadi', async () => {
    const rpc = vi.fn()
    server.use(
      http.post(supabasePath('/rest/v1/rpc/create_household'), async ({ request }) => {
        rpc(await request.json())
        return HttpResponse.json(NEW_ID)
      }),
    )
    const { user, onReady } = renderSetup()

    const name = screen.getByLabelText('Byudjet nomi')
    expect(name).toHaveValue('Mening byudjetim')
    await user.clear(name)
    await user.type(name, '  Oila  ')
    await user.click(screen.getByRole('button', { name: 'Yaratish' }))

    await waitFor(() => {
      expect(onReady).toHaveBeenCalledWith(NEW_ID)
    })
    expect(rpc).toHaveBeenCalledWith({ p_name: 'Oila' })
  })

  it("bo'sh nom — serverga yuborilmaydi", async () => {
    const { user } = renderSetup()
    await user.clear(screen.getByLabelText('Byudjet nomi'))
    await user.click(screen.getByRole('button', { name: 'Yaratish' }))

    expect(await screen.findByText('Byudjet nomini kiriting (80 belgigacha)')).toBeInTheDocument()
  })

  it('taklif kodi — registrsiz kiritiladi, katta harf bilan yuboriladi', async () => {
    const rpc = vi.fn()
    server.use(
      http.post(supabasePath('/rest/v1/rpc/accept_invite'), async ({ request }) => {
        rpc(await request.json())
        return HttpResponse.json(NEW_ID)
      }),
    )
    const { user, onReady } = renderSetup()

    await user.type(screen.getByLabelText('Taklif kodi'), 'abcd2345')
    await user.click(screen.getByRole('button', { name: "Qo'shilish" }))

    await waitFor(() => {
      expect(onReady).toHaveBeenCalledWith(NEW_ID)
    })
    expect(rpc).toHaveBeenCalledWith({ p_code: 'ABCD2345' })
  })

  it('adashtiradigan belgili (O, 0) yoki qisqa kod — format xatosi', async () => {
    const { user } = renderSetup()
    await user.type(screen.getByLabelText('Taklif kodi'), 'ABCD0O12')
    await user.click(screen.getByRole('button', { name: "Qo'shilish" }))

    expect(await screen.findByText('Kod 8 belgidan iborat')).toBeInTheDocument()
  })

  it.each([
    ['invite_expired', 'Kod muddati tugagan (7 kun)'],
    ['invite_used', 'Kod allaqachon ishlatilgan'],
    ['already_member', "Siz allaqachon bu byudjet a'zosisiz"],
  ])('server rad etdi (%s) — tushunarli matn', async (code, text) => {
    server.use(
      http.post(supabasePath('/rest/v1/rpc/accept_invite'), () =>
        HttpResponse.json(businessError(code), { status: 400 }),
      ),
    )
    const { user, onReady } = renderSetup()

    await user.type(screen.getByLabelText('Taklif kodi'), 'ABCD2345')
    await user.click(screen.getByRole('button', { name: "Qo'shilish" }))

    expect(await screen.findByRole('alert')).toHaveTextContent(text)
    expect(onReady).not.toHaveBeenCalled()
  })
})
