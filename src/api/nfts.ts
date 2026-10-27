import { z } from 'zod'
import {
  featuredResponseSchema,
  nftDetailSchema,
  nftListResponseSchema,
  nftSummarySchema,
  PAGE_SIZE,
  type NftListParams,
} from '@/contracts/nft'
import { request } from './http'

/** Serializa os parâmetros exatamente como a API espera (listas separadas por vírgula). */
export function toListQuery(params: NftListParams) {
  return {
    q: params.q || undefined,
    tab: params.tab && params.tab !== 'all' ? params.tab : undefined,
    category: params.categories?.length ? params.categories.join(',') : undefined,
    network: params.networks?.length ? params.networks.join(',') : undefined,
    priceMin: params.priceMin || undefined,
    priceMax: params.priceMax || undefined,
    sort: params.sort ?? 'recent',
    page: params.page ?? 1,
    pageSize: PAGE_SIZE,
  }
}

export const nftsApi = {
  list: (params: NftListParams, signal?: AbortSignal) =>
    request(nftListResponseSchema, { url: '/nfts', params: toListQuery(params), signal }),
  featured: (signal?: AbortSignal) => request(featuredResponseSchema, { url: '/nfts/featured', signal }),
  detail: (id: string, signal?: AbortSignal) =>
    request(nftDetailSchema, { url: `/nfts/${encodeURIComponent(id)}`, signal }),
  related: (id: string, signal?: AbortSignal) =>
    request(z.object({ items: z.array(nftSummarySchema) }), {
      url: `/nfts/${encodeURIComponent(id)}/related`,
      signal,
    }),
}
