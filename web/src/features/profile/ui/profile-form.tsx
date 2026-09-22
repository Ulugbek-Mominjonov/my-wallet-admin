import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import type { Bootstrap } from '@/entities/household'
import { setCachedProfile, updateProfile } from '@/features/profile/api/profile-api'
import {
  PROFILE_NAME_MAX,
  profileSchema,
  type ProfileValues,
} from '@/features/profile/model/profile-form'
import { APP_LOCALES } from '@/shared/config/locale'
import { LOCALE_NAMES } from '@/shared/config/preferences'
import { setLocale } from '@/shared/i18n'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'

/** E21-T04: ism va til (ilova va bildirishnomalar tili). */
export function ProfileForm({ profile }: { profile: Bootstrap['profile'] }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const form = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: { displayName: profile.display_name, locale: profile.locale },
  })
  const save = useMutation({
    mutationFn: (values: ProfileValues) => updateProfile(profile.user_id, values),
    onSuccess: (_, values) => {
      setCachedProfile(queryClient, values)
      setLocale(values.locale)
      form.reset(values)
      toast.success(t('profile.saved'))
    },
  })
  const nameError = form.formState.errors.displayName

  return (
    <form
      className="grid max-w-md gap-4"
      noValidate
      onSubmit={(event) => {
        void form.handleSubmit((values) => {
          save.mutate(values)
        })(event)
      }}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="profile-name">{t('profile.name')}</Label>
        <Input
          id="profile-name"
          autoComplete="name"
          maxLength={PROFILE_NAME_MAX}
          aria-invalid={nameError ? true : undefined}
          aria-describedby={nameError ? 'profile-name-error' : undefined}
          {...form.register('displayName')}
        />
        {nameError && (
          <p id="profile-name-error" className="text-sm text-destructive">
            {t('profile.nameError')}
          </p>
        )}
      </div>
      <div className="grid gap-1.5">
        <Label id="profile-locale-label">{t('profile.language')}</Label>
        <Controller
          control={form.control}
          name="locale"
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={(value) => {
                if (value) field.onChange(value)
              }}
              items={APP_LOCALES.map((value) => ({ value, label: LOCALE_NAMES[value] }))}
            >
              <SelectTrigger
                className="w-full"
                aria-labelledby="profile-locale-label"
                aria-describedby="profile-locale-hint"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {APP_LOCALES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {LOCALE_NAMES[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <p id="profile-locale-hint" className="text-sm text-muted-foreground">
          {t('profile.languageHint')}
        </p>
      </div>
      <Button
        type="submit"
        className="justify-self-start"
        disabled={save.isPending || !form.formState.isDirty}
      >
        {t('common.save')}
      </Button>
    </form>
  )
}
