import {
  type ColumnDef,
  type RowData,
  columnFilteringFeature,
  columnVisibilityFeature,
  createColumnHelper,
  createFilteredRowModel,
  createSortedRowModel,
  filterFn_includesString,
  globalFilteringFeature,
  metaHelper,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_text,
  tableFeatures,
} from '@tanstack/react-table'

export interface DataTableColumnMeta {
  /** Ustunlar menyusidagi nom (sarlavha matn bo'lmasa ham). */
  label?: string
  align?: 'start' | 'end'
}

/**
 * Spravochnik jadvallari uchun umumiy imkoniyatlar (E22-T01): saralash,
 * qidiruv (global filtr), ustunlarni yashirish. Faqat shular bundle'ga kiradi.
 */
export const dataTableFeatures = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, text: sortFn_text, basic: sortFn_basic },
  columnFilteringFeature,
  globalFilteringFeature,
  filteredRowModel: createFilteredRowModel(),
  filterFns: { includesString: filterFn_includesString },
  columnVisibilityFeature,
  columnMeta: metaHelper<DataTableColumnMeta>(),
})

export type DataTableFeatures = typeof dataTableFeatures

/** Qator turi uchun ustun yordamchisi (`helper.columns([...])`). */
export const createDataTableColumns = <TData extends RowData>() =>
  createColumnHelper<DataTableFeatures, TData>()

/**
 * `helper.columns([...])` natijasi. Kutubxona har ustun qiymat turini `any`
 * bilan umumlashtiradi (heterogen ustunlar) — shu yerda bir marta.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DataTableColumns<TData extends RowData> = ColumnDef<DataTableFeatures, TData, any>[]
