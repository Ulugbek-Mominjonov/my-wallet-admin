import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import {
  acceptInvite,
  createHousehold,
  refreshBootstrap,
} from '@/features/household/api/household-api'
import {
  createHouseholdSchema,
  HOUSEHOLD_NAME_MAX,
  INVITE_CODE_LENGTH,
  joinHouseholdSchema,
} from '@/features/household/model/household-forms'
import { toAppError } from '@/shared/api/errors'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'

/**
 * E21-T02: yangi byudjet yaratish yoki taklif kodi bilan qo'shilish.
 * Muvaffaqiyatda bootstrap yangilanadi va [onReady] byudjet ID sini oladi.
 */
export function HouseholdSetup({ onReady }: { onReady: (householdId: string) => void }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <CreateHouseholdCard onReady={onReady} />
      <JoinHouseholdCard onReady={onReady} />
    </div>
  )
}

function CreateHouseholdCard({ onReady }: { onReady: (householdId: string) => void }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const form = useForm({
    resolver: zodResolver(createHouseholdSchema),
    defaultValues: { name: t('household.nameDefault') },
  })
  const create = useMutation({
    mutationFn: async (name: string) => {
      const householdId = await createHousehold(name)
      await refreshBootstrap(queryClient)
      return householdId
    },
    onSuccess: (householdId) => {
      onReady(householdId)
    },
    meta: { silent: true },
  })
  const nameError = form.formState.errors.name

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('household.createTitle')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-3"
          noValidate
          onSubmit={(event) => {
            void form.handleSubmit(({ name }) => {
              create.mutate(name)
            })(event)
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="household-name">{t('household.nameLabel')}</Label>
            <Input
              id="household-name"
              maxLength={HOUSEHOLD_NAME_MAX}
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? 'household-name-error' : undefined}
              {...form.register('name')}
            />
            {nameError && (
              <p id="household-name-error" className="text-sm text-destructive">
                {t('household.errors.name')}
              </p>
            )}
          </div>
          <Button type="submit" disabled={create.isPending}>
            {t('household.create')}
          </Button>
          {create.error && (
            <p role="alert" className="text-sm text-destructive">
              {toAppError(create.error).message}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  )
}

function JoinHouseholdCard({ onReady }: { onReady: (householdId: string) => void }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const form = useForm({ resolver: zodResolver(joinHouseholdSchema), defaultValues: { code: '' } })
  const join = useMutation({
    mutationFn: async (code: string) => {
      const householdId = await acceptInvite(code)
      await refreshBootstrap(queryClient)
      return householdId
    },
    onSuccess: (householdId) => {
      onReady(householdId)
    },
    meta: { silent: true },
  })
  const codeError = form.formState.errors.code

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('household.joinTitle')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-3"
          noValidate
          onSubmit={(event) => {
            void form.handleSubmit(({ code }) => {
              join.mutate(code)
            })(event)
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="invite-code">{t('household.codeLabel')}</Label>
            <Input
              id="invite-code"
              className="font-mono tracking-widest uppercase"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={INVITE_CODE_LENGTH}
              aria-invalid={codeError ? true : undefined}
              aria-describedby={codeError ? 'invite-code-error' : undefined}
              {...form.register('code')}
            />
            {codeError && (
              <p id="invite-code-error" className="text-sm text-destructive">
                {t('household.errors.code')}
              </p>
            )}
          </div>
          <Button type="submit" variant="outline" disabled={join.isPending}>
            {t('household.join')}
          </Button>
          {join.error && (
            <p role="alert" className="text-sm text-destructive">
              {toAppError(join.error).message}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  )
}
