import { z } from 'zod'
import { ethString, isoDate, networkSchema } from './common'

export const CATEGORIES = [
  'arte-digital',
  'fotografia',
  'musica',
  'arte-3d',
  'colecionaveis',
  'generativa',
  'jogos',
  'assinaturas',
  'utilidade',
] as const
export const categorySchema = z.enum(CATEGORIES)
export type Category = z.infer<typeof categorySchema>

export const CATEGORY_LABEL: Record<Category, string> = {
  'arte-digital': 'Arte digital',
  fotografia: 'Fotografia',
  musica: 'Música',
  'arte-3d': 'Arte 3D',
  colecionaveis: 'Colecionáveis',
  generativa: 'Generativa',
  jogos: 'Jogos',
  assinaturas: 'Assinaturas',
  utilidade: 'Utilidade',
}

export const editionSchema = z.object({
  id: z.string(),
  label: z.string(),
  supply: z.number().int().positive().nullable(),
  available: z.number().int().nonnegative(),
  maxPerOrder: z.number().int().positive(),
})
export type Edition = z.infer<typeof editionSchema>

export const nftSummarySchema = z.object({
  id: z.string(),
  tokenId: z.string(),
  name: z.string(),
  image: z.string(),
  imageAlt: z.string(),
  price: ethString,
  previousPrice: ethString.nullable(),
  category: categorySchema,
  network: networkSchema,
  badge: z.string().nullable(),
  available: z.number().int().nonnegative(),
  version: z.number().int().nonnegative(),
})
export type NftSummary = z.infer<typeof nftSummarySchema>

export const nftDetailSchema = nftSummarySchema.extend({
  collection: z.object({ id: z.string(), name: z.string() }),
  gallery: z.array(z.object({ src: z.string(), alt: z.string() })),
  summary: z.string(),
  description: z.array(z.string()),
  attributes: z.array(z.string()),
  rating: z.object({ average: z.number(), count: z.number().int() }),
  contract: z.string(),
  royaltiesBps: z.number().int(),
  editions: z.array(editionSchema),
  listedAt: isoDate,
})
export type NftDetail = z.infer<typeof nftDetailSchema>

export const SORTS = ['recent', 'price-asc', 'price-desc', 'popular'] as const
export const sortSchema = z.enum(SORTS)
export type NftSort = z.infer<typeof sortSchema>
export const SORT_LABEL: Record<NftSort, string> = {
  recent: 'Listados recentemente',
  'price-asc': 'Menor preço',
  'price-desc': 'Maior preço',
  popular: 'Mais populares',
}

export const TABS = ['all', 'new', 'trending'] as const
export const tabSchema = z.enum(TABS)
export type NftTab = z.infer<typeof tabSchema>
export const TAB_LABEL: Record<NftTab, string> = {
  all: 'Todos os NFTs',
  new: 'Novos lançamentos',
  trending: 'Em alta',
}

export const PAGE_SIZE = 9

/** Parâmetros da listagem, espelhados na URL e enviados à API. */
export interface NftListParams {
  q?: string
  tab?: NftTab
  categories?: Category[]
  networks?: z.infer<typeof networkSchema>[]
  priceMin?: string
  priceMax?: string
  sort?: NftSort
  page?: number
}

export const facetSchema = z.object({ id: z.string(), label: z.string(), count: z.number().int() })

export const nftListResponseSchema = z.object({
  items: z.array(nftSummarySchema),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
  facets: z.object({
    categories: z.array(facetSchema),
    networks: z.array(facetSchema),
    priceRange: z.object({ min: ethString, max: ethString }),
  }),
})
export type NftListResponse = z.infer<typeof nftListResponseSchema>

export const featuredResponseSchema = z.object({
  /** Slides do carrossel do herói. */
  heroes: z.array(nftSummarySchema).min(1),
  /** Banner "NFT em destaque" da lateral. */
  spotlight: nftSummarySchema,
})
export type FeaturedResponse = z.infer<typeof featuredResponseSchema>
