import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  useTable,
  type Row,
  type SortingState,
  type ColumnVisibilityState,
} from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ArrowUpDown, Columns3, GripVertical, Search } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import {
  dataTableFeatures,
  type DataTableColumns,
  type DataTableFeatures,
} from '@/shared/ui/data-table/features'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/shared/ui/input-group'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'

interface DataTableProps<TData extends { id: string }> {
  data: TData[]
  columns: DataTableColumns<TData>
  /** Qator nomi — ekran o'quvchi uchun (masalan tartib tugmasi yorlig'i). */
  rowLabel: (row: TData) => string
  /** Berilsa — qatorlarni sudrab tartiblash (qidiruv/saralash yo'q paytda). */
  onReorder?: (ids: string[]) => void
  /** Ma'lumot umuman yo'q (qidiruvdan oldin) — bo'sh holat. */
  empty: ReactNode
  /** Qidiruv yonidagi qo'shimcha boshqaruvlar (masalan "Arxivdagilar"). */
  toolbar?: ReactNode
  initialSorting?: SortingState
  initialVisibility?: ColumnVisibilityState
}

/**
 * E22-T01: spravochnik jadvali — saralash, qidiruv, ustunlarni yashirish va
 * (ixtiyoriy) sudrab tartiblash. Tartib faqat qidiruv va saralash yo'q
 * paytda: ko'rinayotgan ketma-ketlik `sort_order` bilan bir xil bo'lishi shart.
 */
export function DataTable<TData extends { id: string }>({
  data,
  columns,
  rowLabel,
  onReorder,
  empty,
  toolbar,
  initialSorting = [],
  initialVisibility = {},
}: DataTableProps<TData>) {
  const { t } = useTranslation()
  const table = useTable({
    features: dataTableFeatures,
    columns,
    data,
    getRowId: (row) => row.id,
    globalFilterFn: 'includesString',
    initialState: { sorting: initialSorting, columnVisibility: initialVisibility },
  })
  const { sorting } = table.state
  const globalFilter: unknown = table.state.globalFilter
  const rows = table.getRowModel().rows
  const canReorder = onReorder !== undefined && sorting.length === 0 && !globalFilter
  const hideable = table.getAllLeafColumns().filter((column) => column.getCanHide())

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <InputGroup className="w-full sm:w-64">
          <InputGroupAddon>
            <Search aria-hidden />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            aria-label={t('table.search')}
            placeholder={t('table.search')}
            value={typeof globalFilter === 'string' ? globalFilter : ''}
            onChange={(event) => {
              table.setGlobalFilter(event.target.value)
            }}
          />
        </InputGroup>
        {toolbar}
        {hideable.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" className="ml-auto" />}>
              <Columns3 aria-hidden />
              {t('table.columns')}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44">
              <DropdownMenuGroup>
                <DropdownMenuLabel>{t('table.columns')}</DropdownMenuLabel>
                {hideable.map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    checked={column.getIsVisible()}
                    onCheckedChange={(checked) => {
                      column.toggleVisibility(checked)
                    }}
                  >
                    {column.columnDef.meta?.label ?? column.id}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {onReorder && !canReorder && data.length > 1 && (
        <p className="text-xs text-muted-foreground">{t('table.reorderHint')}</p>
      )}
      {data.length === 0 ? (
        empty
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((group) => (
                <TableRow key={group.id}>
                  {canReorder && <TableHead className="w-10" />}
                  {group.headers.map((header) => {
                    const sorted = header.column.getIsSorted()
                    return (
                      <TableHead
                        key={header.id}
                        aria-sort={
                          sorted === 'asc'
                            ? 'ascending'
                            : sorted === 'desc'
                              ? 'descending'
                              : undefined
                        }
                        className={cn(
                          header.column.columnDef.meta?.align === 'end' && 'text-right',
                        )}
                      >
                        {header.isPlaceholder ? null : header.column.getCanSort() ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="-ml-2"
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            <table.FlexRender header={header} />
                            <SortIcon sorted={sorted} />
                          </Button>
                        ) : (
                          <table.FlexRender header={header} />
                        )}
                      </TableHead>
                    )
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={table.getVisibleLeafColumns().length + (canReorder ? 1 : 0)}
                    className="h-20 text-center text-muted-foreground"
                  >
                    {t('table.noResults')}
                  </TableCell>
                </TableRow>
              ) : canReorder ? (
                <SortableRows rows={rows} rowLabel={rowLabel} onReorder={onReorder}>
                  {(row) => <Cells row={row} table={table} />}
                </SortableRows>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id}>
                    <Cells row={row} table={table} />
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

function SortIcon({ sorted }: { sorted: false | 'asc' | 'desc' }) {
  const { t } = useTranslation()
  if (sorted === 'asc') {
    return <ArrowUp aria-label={t('table.sortAsc')} />
  }
  if (sorted === 'desc') {
    return <ArrowDown aria-label={t('table.sortDesc')} />
  }
  return <ArrowUpDown aria-hidden className="opacity-40" />
}

function Cells<TData extends { id: string }>({
  row,
  table,
}: {
  row: Row<DataTableFeatures, TData>
  table: ReturnType<typeof useTable<DataTableFeatures, TData>>
}) {
  return row.getVisibleCells().map((cell) => (
    <TableCell
      key={cell.id}
      className={cn(cell.column.columnDef.meta?.align === 'end' && 'text-right')}
    >
      <table.FlexRender cell={cell} />
    </TableCell>
  ))
}

function SortableRows<TData extends { id: string }>({
  rows,
  rowLabel,
  onReorder,
  children,
}: {
  rows: Row<DataTableFeatures, TData>[]
  rowLabel: (row: TData) => string
  onReorder: (ids: string[]) => void
  children: (row: Row<DataTableFeatures, TData>) => ReactNode
}) {
  const { t } = useTranslation()
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const ids = rows.map((row) => row.id)
  const labelOf = (id: UniqueIdentifier) => {
    const row = rows.find((r) => r.id === id)
    return row ? rowLabel(row.original) : ''
  }
  // Ekran o'quvchi e'lonlari UI tilida (dnd-kit standarti — inglizcha).
  const announcements: Announcements = {
    onDragStart: ({ active }) => t('table.dnd.picked', { name: labelOf(active.id) }),
    // O'z o'rnida (olingan zahoti ham keladi) — "olindi" e'lonini bosmaydi.
    onDragOver: ({ active, over }) =>
      over && over.id !== active.id
        ? t('table.dnd.over', { name: labelOf(active.id), over: labelOf(over.id) })
        : undefined,
    onDragEnd: ({ active }) => t('table.dnd.dropped', { name: labelOf(active.id) }),
    onDragCancel: ({ active }) => t('table.dnd.cancelled', { name: labelOf(active.id) }),
  }

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const from = ids.indexOf(String(active.id))
    const to = ids.indexOf(String(over.id))
    onReorder(arrayMove(ids, from, to))
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={{
        announcements,
        screenReaderInstructions: { draggable: t('table.dnd.instructions') },
      }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {rows.map((row) => (
          <SortableRow key={row.id} id={row.id} label={rowLabel(row.original)}>
            {children(row)}
          </SortableRow>
        ))}
      </SortableContext>
    </DndContext>
  )
}

function SortableRow({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  const { t } = useTranslation()
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  return (
    <TableRow
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(isDragging && 'relative z-10 bg-muted shadow-sm')}
    >
      <TableCell className="w-10">
        <Button
          ref={setActivatorNodeRef}
          variant="ghost"
          size="icon-sm"
          className="cursor-grab touch-none"
          aria-label={t('table.reorder', { name: label })}
          {...attributes}
          {...listeners}
        >
          <GripVertical aria-hidden />
        </Button>
      </TableCell>
      {children}
    </TableRow>
  )
}
