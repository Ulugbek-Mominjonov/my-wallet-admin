import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Tags } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { useCan } from '@/entities/household'
import type { Tag } from '@/entities/tag'
import {
  createTag,
  deleteTag,
  tagsKey,
  tagsQuery,
  updateTag,
  type TagInput,
} from '@/features/tags/api/tags-api'
import { NAME_MAX, tagFormDefaults, tagFormSchema } from '@/features/tags/model/tag-form'
import { toAppError } from '@/shared/api/errors'
import { useOptimisticRemove } from '@/shared/api/use-directory-mutations'
import { Button } from '@/shared/ui/button'
import { ColorPicker } from '@/shared/ui/color-picker'
import { DataTable } from '@/shared/ui/data-table/data-table'
import { createDataTableColumns } from '@/shared/ui/data-table/features'
import { DirectoryPage } from '@/shared/ui/directory-page'
import { DirectoryRowActions } from '@/shared/ui/directory-row-actions'
import { EmptyState } from '@/shared/ui/empty-state'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'

const helper = createDataTableColumns<Tag>()

/**
 * E22-T05: teglar (BR-200) — yaratish member'ga ham ochiq (amal kiritishda
 * kerak), tahrirlash va o'chirish — owner/admin (RLS bilan bir xil).
 */
export function TagsPage({ householdId }: { householdId: string }) {
  const { t } = useTranslation()
  const canWrite = useCan('write')
  const canManage = useCan('manage')
  const queryClient = useQueryClient()
  const list = tagsQuery(householdId)
  const query = useQuery(list)
  const [editing, setEditing] = useState<Tag | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Tag | null>(null)

  const save = useMutation({
    mutationFn: (input: TagInput) =>
      editing === null || editing === 'new'
        ? createTag(householdId, input)
        : updateTag(editing.id, input),
    onSuccess: async () => {
      setEditing(null)
      toast.success(t('directories.saved'))
      await queryClient.invalidateQueries({ queryKey: tagsKey(householdId) })
    },
    meta: { silent: true },
  })
  const remove = useOptimisticRemove<Tag>({
    listKey: list.queryKey,
    allKey: list.queryKey,
    remove: deleteTag,
  })

  const columns = useMemo(() => {
    const name = helper.accessor('name', {
      header: t('tags.name'),
      enableHiding: false,
      cell: ({ row }) => {
        const chip = (
          <span className="inline-flex items-center gap-2 font-medium">
            <span
              aria-hidden
              className="size-2.5 rounded-full bg-muted-foreground"
              style={row.original.color ? { backgroundColor: row.original.color } : undefined}
            />
            {row.original.name}
          </span>
        )
        return canManage ? (
          <button
            type="button"
            className="rounded-md hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            onClick={() => {
              setEditing(row.original)
            }}
          >
            {chip}
          </button>
        ) : (
          chip
        )
      },
    })
    if (!canManage) return helper.columns([name])
    return helper.columns([
      name,
      helper.display({
        id: 'actions',
        header: () => <span className="sr-only">{t('directories.actions')}</span>,
        enableHiding: false,
        cell: ({ row }) => (
          <DirectoryRowActions
            name={row.original.name}
            archived={false}
            onEdit={() => {
              setEditing(row.original)
            }}
            onDelete={() => {
              setDeleting(row.original)
            }}
          />
        ),
      }),
    ])
  }, [t, canManage])

  const addButton = canWrite && (
    <Button
      onClick={() => {
        save.reset()
        setEditing('new')
      }}
    >
      <Plus aria-hidden />
      {t('tags.add')}
    </Button>
  )

  return (
    <DirectoryPage
      title={t('tags.title')}
      description={t('tags.description')}
      actions={addButton}
      status={{
        isPending: query.isPending,
        error: query.error,
        onRetry: () => {
          void query.refetch()
        },
      }}
      form={{
        open: editing !== null,
        title: editing === 'new' ? t('tags.newTitle') : t('tags.editTitle'),
        onClose: () => {
          setEditing(null)
        },
        content: editing !== null && (
          <TagForm
            key={editing === 'new' ? 'new' : editing.id}
            tag={editing === 'new' ? undefined : editing}
            pending={save.isPending}
            error={save.error}
            onSubmit={(input) => {
              save.mutate(input)
            }}
            onCancel={() => {
              setEditing(null)
            }}
          />
        ),
      }}
      remove={{
        name: deleting?.name ?? null,
        pending: remove.isPending,
        onClose: () => {
          setDeleting(null)
        },
        onConfirm: () => {
          if (deleting) {
            remove.mutate(deleting.id, {
              onSettled: () => {
                setDeleting(null)
              },
            })
          }
        },
      }}
    >
      <DataTable
        data={query.data ?? []}
        columns={columns}
        rowLabel={(tag) => tag.name}
        empty={
          <EmptyState
            icon={Tags}
            title={t('tags.emptyTitle')}
            description={t('tags.emptyText')}
            action={addButton}
          />
        }
      />
    </DirectoryPage>
  )
}

function TagForm({
  tag,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  tag?: Tag
  pending: boolean
  error: Error | null
  onSubmit: (input: TagInput) => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const form = useForm({
    resolver: zodResolver(tagFormSchema),
    defaultValues: tagFormDefaults(tag),
  })
  const nameError = form.formState.errors.name
  return (
    <form
      className="grid gap-4 px-4"
      noValidate
      onSubmit={(event) => {
        void form.handleSubmit(onSubmit)(event)
      }}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="tag-name">{t('tags.name')}</Label>
        <Input
          id="tag-name"
          maxLength={NAME_MAX}
          aria-invalid={nameError ? true : undefined}
          aria-describedby={nameError ? 'tag-name-error' : undefined}
          {...form.register('name')}
        />
        {nameError && (
          <p id="tag-name-error" className="text-sm text-destructive">
            {t('directories.errors.name')}
          </p>
        )}
      </div>
      <div className="grid gap-1.5">
        <p id="tag-color-label" className="text-sm font-medium">
          {t('directories.color')}
        </p>
        <Controller
          control={form.control}
          name="color"
          render={({ field }) => (
            <ColorPicker
              labelledBy="tag-color-label"
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {toAppError(error).message}
        </p>
      )}
      <div className="flex justify-end gap-2 pb-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={pending}>
          {t('common.save')}
        </Button>
      </div>
    </form>
  )
}
