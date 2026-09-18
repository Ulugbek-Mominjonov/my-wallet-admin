// E11-T08: chek fayllarini tozalash (BR-201, BR-015) — ro'yxat bazadan
// (`receipt_files_to_delete`), o'chirish Storage API orqali.

export interface PurgeDeps {
  list(limit: number): Promise<string[]>
  /** O'chirilgan fayllar soni. */
  remove(paths: string[]): Promise<number>
}

export interface PurgeOptions {
  batchSize: number
  budgetMs: number
  now?: () => number
}

export async function purgeFiles(
  deps: PurgeDeps,
  options: PurgeOptions,
): Promise<{ deleted: number; batches: number }> {
  const now = options.now ?? Date.now
  const deadline = now() + options.budgetMs
  const summary = { deleted: 0, batches: 0 }
  while (now() < deadline) {
    const paths = await deps.list(options.batchSize)
    if (paths.length === 0) break
    const removed = await deps.remove(paths)
    summary.deleted += removed
    summary.batches += 1
    // Hech narsa o'chmadi — qayta urinish shu ishda befoyda (ertaga yana).
    if (removed === 0 || paths.length < options.batchSize) break
  }
  return summary
}
