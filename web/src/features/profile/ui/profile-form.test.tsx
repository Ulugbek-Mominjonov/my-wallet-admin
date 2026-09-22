import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'

import { ProfileForm } from '@/features/profile/ui/profile-form'
import { i18n } from '@/shared/i18n'
import { server, signInTestUser, supabasePath, TEST_USER_ID } from '@/shared/test/msw'
import { renderWithProviders } from '@/shared/test/render'

const PROFILE = {
  user_id: TEST_USER_ID,
  display_name: 'Ali',
  locale: 'uz' as const,
  last_household_id: null,
}

describe('ProfileForm', () => {
  it("ism va til saqlanadi, UI tili darhol o'zgaradi", async () => {
    signInTestUser()
    const patch = vi.fn()
    server.use(
      http.patch(supabasePath('/rest/v1/profiles'), async ({ request }) => {
        patch(new URL(request.url).searchParams.get('user_id'), await request.json())
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const user = userEvent.setup()
    renderWithProviders(<ProfileForm profile={PROFILE} />)

    const save = screen.getByRole('button', { name: 'Saqlash' })
    expect(save).toBeDisabled()

    await user.clear(screen.getByLabelText('Ism'))
    await user.type(screen.getByLabelText('Ism'), '  Ali Valiyev ')
    await user.click(screen.getByRole('combobox', { name: 'Til' }))
    await user.click(await screen.findByRole('option', { name: 'Русский' }))
    await user.click(save)

    await waitFor(() => {
      expect(patch).toHaveBeenCalledWith(`eq.${TEST_USER_ID}`, {
        display_name: 'Ali Valiyev',
        locale: 'ru',
      })
    })
    await waitFor(() => {
      expect(i18n.language).toBe('ru')
    })
  })

  it("bo'sh ism — serverga yuborilmaydi", async () => {
    const user = userEvent.setup()
    renderWithProviders(<ProfileForm profile={PROFILE} />)

    await user.clear(screen.getByLabelText('Ism'))
    await user.click(screen.getByRole('button', { name: 'Saqlash' }))

    expect(await screen.findByText('Ismni kiriting (100 belgigacha)')).toBeInTheDocument()
  })
})
