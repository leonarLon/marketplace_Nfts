import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { toast } from 'sonner'
import { favoritesApi } from '@/api/account'
import { queryKeys } from '@/app/query-keys'
import type { FavoritesResponse } from '@/contracts/account'
import { useCacheScope } from '@/session/use-session'

export function useFavorites() {
  const { scope, canFetch, status } = useCacheScope()
  return useQuery({
    queryKey: queryKeys.favorites(scope ?? 'anonymous'),
    queryFn: ({ signal }) => favoritesApi.list(signal),
    enabled: Boolean(scope) && canFetch && status === 'authenticated',
  })
}

export function useIsFavorite(nftId: string) {
  const { data } = useFavorites()
  return data?.nftIds.includes(nftId) ?? false
}

/**
 * Atualização otimista com rollback: a lista muda imediatamente; se a API falhar, o estado
 * anterior é restaurado e o usuário é avisado. Ao final, a lista é revalidada com a API.
 */
export function useFavoriteMutation() {
  const queryClient = useQueryClient()
  const { scope } = useCacheScope()
  const key = queryKeys.favorites(scope ?? 'anonymous')

  return useMutation({
    mutationKey: ['favorites', scope],
    mutationFn: ({ nftId, add }: { nftId: string; name: string; add: boolean }) =>
      add ? favoritesApi.add(nftId) : favoritesApi.remove(nftId),
    onMutate: async ({ nftId, add }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<FavoritesResponse>(key)
      queryClient.setQueryData<FavoritesResponse>(key, (old) => {
        const ids = new Set(old?.nftIds ?? [])
        if (add) ids.add(nftId)
        else ids.delete(nftId)
        return { nftIds: [...ids] }
      })
      return { previous }
    },
    onError: (_error, { name, add }, context) => {
      queryClient.setQueryData(key, context?.previous)
      toast.error(`Não foi possível ${add ? 'favoritar' : 'remover'} ${name}. A alteração foi desfeita.`)
    },
    onSuccess: (data, { name, add }) => {
      queryClient.setQueryData(key, data)
      toast.success(add ? `${name} adicionado à lista de interesse.` : `${name} removido da lista de interesse.`)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}

/** Alterna o favorito; visitantes são levados ao login e retornam à página atual. */
export function useFavoriteToggle() {
  const mutation = useFavoriteMutation()
  const navigate = useNavigate()
  const { status } = useCacheScope()
  const href = useRouterState({ select: (s) => s.location.href })
  return (nftId: string, name: string, isFavorite: boolean) => {
    if (status !== 'authenticated') {
      toast.info('Entre para salvar NFTs na sua lista de interesse.')
      void navigate({ to: '/entrar', search: { redirect: href } })
      return
    }
    mutation.mutate({ nftId, name, add: !isFavorite })
  }
}
