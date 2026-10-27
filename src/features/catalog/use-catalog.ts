import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { nftsApi } from '@/api/nfts'
import { queryKeys } from '@/app/query-keys'
import type { NftListParams, NftSummary } from '@/contracts/nft'
import { nftVersions } from '@/realtime/version-store'

function observe<T extends { id: string; version: number }>(items: T[]) {
  items.forEach((i) => nftVersions.observe(i.id, i.version))
}

/**
 * Listagem paginada. Cada combinação de parâmetros tem sua própria chave, então uma resposta
 * atrasada de parâmetros antigos nunca sobrescreve a atual; o AbortSignal cancela a requisição
 * obsoleta quando a chave muda. `keepPreviousData` mantém a grade visível durante a troca.
 */
export function useNftList(params: NftListParams) {
  return useQuery({
    queryKey: queryKeys.nfts.list(params),
    queryFn: async ({ signal }) => {
      const res = await nftsApi.list(params, signal)
      observe(res.items)
      return res
    },
    placeholderData: keepPreviousData,
  })
}

export function useFeatured() {
  return useQuery({
    queryKey: queryKeys.nfts.featured(),
    queryFn: async ({ signal }) => {
      const res = await nftsApi.featured(signal)
      observe([...res.heroes, res.spotlight])
      return res
    },
    staleTime: 60_000,
  })
}

export function useNftDetail(id: string) {
  return useQuery({
    queryKey: queryKeys.nfts.detail(id),
    queryFn: async ({ signal }) => {
      const nft = await nftsApi.detail(id, signal)
      nftVersions.observe(nft.id, nft.version)
      return nft
    },
  })
}

export function useRelated(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.nfts.related(id ?? ''),
    enabled: Boolean(id),
    queryFn: async ({ signal }) => {
      const res = await nftsApi.related(id!, signal)
      observe(res.items as NftSummary[])
      return res
    },
    staleTime: 60_000,
  })
}
