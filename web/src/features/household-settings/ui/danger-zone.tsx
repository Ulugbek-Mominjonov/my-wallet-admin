import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { deleteHousehold } from '@/features/household-settings/api/settings-api'
import { toAppError } from '@/shared/api/errors'
import { qk } from '@/shared/api/query-keys'
import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { SectionCard } from '@/shared/ui/section-card'

/**
 * E22-T07: xavfli zona (BR-014) — byudjetni o'chirish. Tasdiq: nomni qayta
 * yozish (server ham tekshiradi — `confirm_mismatch`). Faqat owner ko'radi.
 */
export function DangerZone({ householdId, name }: { householdId: string; name: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const matches = typed.trim().toLowerCase() === name.trim().toLowerCase()
  const remove = useMutation({
    mutationFn: () => deleteHousehold(householdId, typed),
    onSuccess: async () => {
      setOpen(false)
      toast.success(t('settings.danger.deleted'))
      queryClient.removeQueries({ queryKey: qk.household(householdId) })
      await queryClient.invalidateQueries({ queryKey: qk.bootstrap() })
      await navigate({ to: '/' })
    },
    meta: { silent: true },
  })

  return (
    <SectionCard title={t('settings.danger.title')} className="border-destructive/50">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="max-w-xl space-y-1">
          <p className="font-medium">{t('settings.danger.deleteTitle')}</p>
          <p className="text-sm text-muted-foreground">{t('settings.danger.deleteText')}</p>
        </div>
        <Button
          variant="destructive"
          onClick={() => {
            setTyped('')
            remove.reset()
            setOpen(true)
          }}
        >
          <Trash2 aria-hidden />
          {t('settings.danger.delete')}
        </Button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{t('settings.danger.deleteTitle')}</DialogTitle>
            <DialogDescription>{t('settings.danger.deleteText')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="delete-confirm">{t('settings.danger.confirmLabel', { name })}</Label>
            <Input
              id="delete-confirm"
              autoComplete="off"
              value={typed}
              onChange={(event) => {
                setTyped(event.target.value)
              }}
            />
          </div>
          {remove.error && (
            <p role="alert" className="text-sm text-destructive">
              {toAppError(remove.error).message}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setOpen(false)
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              disabled={!matches || remove.isPending}
              onClick={() => {
                remove.mutate()
              }}
            >
              {t('settings.danger.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionCard>
  )
}
