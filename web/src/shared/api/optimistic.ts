import type { QueryClient, QueryKey } from '@tanstack/react-query'

interface OptimisticContext<TItem> {
  previous?: TItem[]
}

/**
 * Ro'yxat keshini optimistik yangilash (E22-T01): o'zgarish darhol ko'rinadi,
 * xatoda avvalgi holat qaytadi, oxirida serverdan qayta olinadi (server
 * hisoblaydigan maydonlar — qoldiq, tartib — to'g'rilanadi).
 *
 * @example useMutation({ mutationFn, ...optimisticList(qc, key, (items, v) => ...) })
 */
export function optimisticList<TItem, TVariables>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  apply: (items: TItem[], variables: TVariables) => TItem[],
  /** Oxirida qayta olinadigan kalit (masalan barcha filtr variantlari prefiksi). */
  invalidateKey: QueryKey = queryKey,
) {
  return {
    onMutate: async (variables: TVariables): Promise<OptimisticContext<TItem>> => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<TItem[]>(queryKey)
      if (previous) queryClient.setQueryData<TItem[]>(queryKey, apply(previous, variables))
      return { previous }
    },
    onError: (
      _error: Error,
      _variables: TVariables,
      context: OptimisticContext<TItem> | undefined,
    ) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: invalidateKey }),
  }
}
