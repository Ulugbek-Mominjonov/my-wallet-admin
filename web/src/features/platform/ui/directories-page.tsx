import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  cardTemplatesQuery,
  categoryTemplatesQuery,
  currenciesQuery,
  deleteCardTemplate,
  deleteCategoryTemplate,
  deleteCurrency,
  platformKey,
  saveCardTemplate,
  saveCategoryTemplate,
  saveCurrency,
  type CardTemplate,
  type CardTemplateInput,
  type CategoryTemplate,
  type CategoryTemplateInput,
  type Currency,
  type CurrencyInput,
} from '@/features/platform/api/platform-api'
import { CardTemplateForm } from '@/features/platform/ui/card-template-form'
import { CategoryTemplateForm } from '@/features/platform/ui/category-template-form'
import { CurrencyForm } from '@/features/platform/ui/currency-form'
import { useAppLocale } from '@/shared/i18n'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { DirectoryPage } from '@/shared/ui/directory-page'
import { DirectoryRowActions } from '@/shared/ui/directory-row-actions'
import { EntityIconTile } from '@/shared/ui/entity-icon'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'

type Tab = 'currencies' | 'templates' | 'cards'

/** Tahrirlanayotgan yozuv (yangi — `null` qiymat bilan). */
type Editing =
  | { tab: 'currencies'; row: Currency | null }
  | { tab: 'templates'; row: CategoryTemplate | null }
  | { tab: 'cards'; row: CardTemplate | null }
  | null

/** Saqlashga yuboriladigan yozuv — har spravochnik o'z tipida. */
type SaveInput =
  | { tab: 'currencies'; row: CurrencyInput }
  | { tab: 'templates'; id: string | null; row: CategoryTemplateInput }
  | { tab: 'cards'; id: string | null; row: CardTemplateInput }

/**
 * E26-T01 (BR-213): tizim spravochniklari — valyutalar (BR-190), kategoriya
 * shablonlari (BR-031/032) va karta xabar shablonlari (BR-222). Yozish —
 * faqat platforma admini (2FA bilan), server RLS ham shuni talab qiladi.
 */
export function PlatformDirectoriesPage() {
  const { t } = useTranslation()
  const locale = useAppLocale()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>('currencies')
  const [editing, setEditing] = useState<Editing>(null)
  const [deleting, setDeleting] = useState<{ tab: Tab; id: string; name: string } | null>(null)

  const currencies = useQuery(currenciesQuery)
  const templates = useQuery(categoryTemplatesQuery)
  const cards = useQuery(cardTemplatesQuery)
  const active = { currencies, templates, cards }[tab]

  const refresh = (name: string) => queryClient.invalidateQueries({ queryKey: platformKey(name) })

  const save = useMutation({
    mutationFn: (input: SaveInput) => {
      if (input.tab === 'currencies') return saveCurrency(input.row)
      if (input.tab === 'templates') return saveCategoryTemplate(input.id, input.row)
      return saveCardTemplate(input.id, input.row)
    },
    onSuccess: async (_result, input) => {
      setEditing(null)
      toast.success(t('directories.saved'))
      await refresh(KEY[input.tab])
    },
    meta: { silent: true },
  })

  const remove = useMutation({
    mutationFn: ({ tab: which, id }: { tab: Tab; id: string }) => {
      if (which === 'currencies') return deleteCurrency(id)
      if (which === 'templates') return deleteCategoryTemplate(id)
      return deleteCardTemplate(id)
    },
    onSuccess: async (_result, { tab: which }) => {
      setDeleting(null)
      toast.success(t('directories.deleted'))
      await refresh(KEY[which])
    },
  })

  return (
    <DirectoryPage
      title={t('platform.directories.title')}
      description={t('platform.directories.description')}
      actions={
        <Button
          onClick={() => {
            setEditing({ tab, row: null })
          }}
        >
          <Plus aria-hidden />
          {t('platform.directories.add')}
        </Button>
      }
      status={{
        isPending: active.isPending,
        error: active.error,
        onRetry: () => {
          void active.refetch()
        },
      }}
      form={{
        open: editing !== null,
        title: t(`platform.directories.form.${editing?.tab ?? 'currencies'}`),
        onClose: () => {
          setEditing(null)
          save.reset()
        },
        content: editing && (
          <FormFor
            editing={editing}
            currencies={currencies.data ?? []}
            pending={save.isPending}
            error={save.error}
            onSave={(input) => {
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
          if (deleting) remove.mutate({ tab: deleting.tab, id: deleting.id })
        },
      }}
    >
      <Tabs
        value={tab}
        onValueChange={(value: Tab) => {
          setTab(value)
        }}
      >
        <TabsList>
          <TabsTrigger value="currencies">{t('platform.directories.currencies')}</TabsTrigger>
          <TabsTrigger value="templates">{t('platform.directories.templates')}</TabsTrigger>
          <TabsTrigger value="cards">{t('platform.directories.cards')}</TabsTrigger>
        </TabsList>

        <TabsContent value="currencies">
          <Table aria-label={t('platform.directories.currencies')}>
            <TableHeader>
              <TableRow>
                <TableHead>{t('platform.fields.code')}</TableHead>
                <TableHead>{t('platform.fields.name')}</TableHead>
                <TableHead>{t('platform.fields.symbol')}</TableHead>
                <TableHead className="text-right">{t('platform.fields.exponent')}</TableHead>
                <TableHead>{t('platform.fields.active')}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(currencies.data ?? []).map((row) => (
                <TableRow key={row.code}>
                  <TableCell className="font-medium">{row.code}</TableCell>
                  <TableCell>{row.name_i18n[locale]}</TableCell>
                  <TableCell>{row.symbol}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.exponent}</TableCell>
                  <TableCell>
                    {row.active ? (
                      <Badge variant="outline">{t('platform.yes')}</Badge>
                    ) : (
                      <Badge variant="secondary">{t('platform.no')}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <DirectoryRowActions
                      name={row.code}
                      archived={false}
                      onEdit={() => {
                        setEditing({ tab: 'currencies', row })
                      }}
                      onDelete={() => {
                        setDeleting({ tab: 'currencies', id: row.code, name: row.code })
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="templates">
          <Table aria-label={t('platform.directories.templates')}>
            <TableHeader>
              <TableRow>
                <TableHead>{t('platform.fields.name')}</TableHead>
                <TableHead>{t('platform.fields.kind')}</TableHead>
                <TableHead>{t('platform.fields.monthShift')}</TableHead>
                <TableHead className="text-right">{t('platform.fields.order')}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(templates.data ?? []).map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="flex items-center gap-2 font-medium">
                    <EntityIconTile name={row.icon} color={row.color} />
                    {row.name_i18n[locale]}
                    {row.system_code !== null && (
                      <Badge variant="secondary">{t('directories.system')}</Badge>
                    )}
                  </TableCell>
                  <TableCell>{t(`platform.kinds.${row.kind}`)}</TableCell>
                  <TableCell>
                    {row.month_shift === -1 ? t('categories.shift-1') : t('categories.shift0')}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{row.sort_order}</TableCell>
                  <TableCell>
                    <DirectoryRowActions
                      name={row.name_i18n[locale]}
                      archived={false}
                      onEdit={() => {
                        setEditing({ tab: 'templates', row })
                      }}
                      onDelete={
                        row.system_code === null
                          ? () => {
                              setDeleting({
                                tab: 'templates',
                                id: row.id,
                                name: row.name_i18n[locale],
                              })
                            }
                          : undefined
                      }
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="cards">
          <Table aria-label={t('platform.directories.cards')}>
            <TableHeader>
              <TableRow>
                <TableHead>{t('platform.fields.bank')}</TableHead>
                <TableHead>{t('platform.fields.pattern')}</TableHead>
                <TableHead>{t('platform.fields.kind')}</TableHead>
                <TableHead>{t('platform.fields.active')}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(cards.data ?? []).map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.bank}</TableCell>
                  <TableCell className="max-w-72 truncate font-mono text-xs">
                    {row.pattern}
                  </TableCell>
                  <TableCell>{t(`platform.kinds.${row.kind}`)}</TableCell>
                  <TableCell>
                    {row.active ? (
                      <Badge variant="outline">{t('platform.yes')}</Badge>
                    ) : (
                      <Badge variant="secondary">{t('platform.no')}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <DirectoryRowActions
                      name={row.bank}
                      archived={false}
                      onEdit={() => {
                        setEditing({ tab: 'cards', row })
                      }}
                      onDelete={() => {
                        setDeleting({ tab: 'cards', id: row.id, name: row.bank })
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>
    </DirectoryPage>
  )
}

/** Tab → kesh kaliti bo'lagi. */
const KEY: Record<Tab, string> = {
  currencies: 'currencies',
  templates: 'category-templates',
  cards: 'card-templates',
}

function FormFor({
  editing,
  currencies,
  pending,
  error,
  onSave,
  onCancel,
}: {
  editing: NonNullable<Editing>
  currencies: readonly Currency[]
  pending: boolean
  error: Error | null
  onSave: (input: SaveInput) => void
  onCancel: () => void
}) {
  if (editing.tab === 'currencies') {
    return (
      <CurrencyForm
        currency={editing.row ?? undefined}
        pending={pending}
        error={error}
        onSubmit={(row) => {
          onSave({ tab: 'currencies', row })
        }}
        onCancel={onCancel}
      />
    )
  }
  if (editing.tab === 'templates') {
    return (
      <CategoryTemplateForm
        template={editing.row ?? undefined}
        pending={pending}
        error={error}
        onSubmit={(row) => {
          onSave({ tab: 'templates', id: editing.row?.id ?? null, row })
        }}
        onCancel={onCancel}
      />
    )
  }
  return (
    <CardTemplateForm
      template={editing.row ?? undefined}
      currencies={currencies}
      pending={pending}
      error={error}
      onSubmit={(row) => {
        onSave({ tab: 'cards', id: editing.row?.id ?? null, row })
      }}
      onCancel={onCancel}
    />
  )
}
