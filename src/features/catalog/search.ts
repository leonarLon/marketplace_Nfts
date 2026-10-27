import { z } from 'zod'
import { CATEGORIES, sortSchema, tabSchema, type Category, type NftListParams } from '@/contracts/nft'
import { NETWORKS, type Network } from '@/contracts/common'
import { isEthString } from '@/lib/money'

/**
 * Estado do catálogo na URL. Listas são strings separadas por vírgula para manter a URL legível
 * (ex.: ?category=musica,fotografia&sort=price-asc&page=2). Valores inválidos são descartados.
 */
const csv = <T extends string>(allowed: readonly T[]) =>
  z
    .string()
    .optional()
    .catch(undefined)
    .transform((v) => {
      const list = (v ?? '').split(',').filter((x): x is T => (allowed as readonly string[]).includes(x))
      return list.length ? [...new Set(list)].sort().join(',') : undefined
    })

const ethParam = z
  .union([z.string(), z.number()])
  .transform(String)
  .optional()
  .catch(undefined)
  .transform((v) => (v && isEthString(v) ? v : undefined))

export const catalogSearchSchema = z.object({
  q: z.union([z.string(), z.number()]).transform((v) => String(v).trim().slice(0, 80)).optional().catch(undefined).transform((v) => v || undefined),
  tab: tabSchema.optional().catch(undefined),
  category: csv(CATEGORIES),
  network: csv(NETWORKS),
  priceMin: ethParam,
  priceMax: ethParam,
  sort: sortSchema.optional().catch(undefined),
  page: z.coerce.number().int().min(1).optional().catch(undefined),
})

export type CatalogSearch = Partial<z.output<typeof catalogSearchSchema>>

export function toListParams(search: CatalogSearch): NftListParams {
  return {
    q: search.q,
    tab: search.tab ?? 'all',
    categories: (search.category?.split(',') ?? []) as Category[],
    networks: (search.network?.split(',') ?? []) as Network[],
    priceMin: search.priceMin,
    priceMax: search.priceMax,
    sort: search.sort ?? 'recent',
    page: search.page ?? 1,
  }
}

/** Alternar um valor numa lista CSV. */
export function toggleCsv(current: string | undefined, value: string) {
  const set = new Set(current?.split(',').filter(Boolean))
  if (set.has(value)) set.delete(value)
  else set.add(value)
  return set.size ? [...set].sort().join(',') : undefined
}
