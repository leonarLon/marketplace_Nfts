import type { Category, Edition } from '@/contracts/nft'
import type { Network } from '@/contracts/common'

/**
 * Catálogo determinístico. Os 9 primeiros itens reproduzem os nomes/preços visíveis no Figma;
 * os demais variam categoria, rede, preço e data para exercitar filtros e paginação.
 */
export interface NftSeed {
  id: string
  tokenId: string
  name: string
  art: ArtKey
  price: string
  previousPrice: string | null
  category: Category
  network: Network
  badge: string | null
  collection: { id: string; name: string }
  attributes: string[]
  rating: { average: number; count: number }
  popularity: number
  /** Dias atrás em relação à data-base fixa do catálogo. */
  listedDaysAgo: number
  editions: Edition[]
}

export const ART = {
  'ape-emerald': 'Macaco de pelagem castanha com óculos redondos verdes e jaqueta college verde',
  'gorilla-sage': 'Gorila cinza com chapéu bucket verde-sálvia e moletom lilás',
  'gorilla-ivory': 'Gorila de pelagem escura com gola alta verde e blazer marfim',
  'monkey-golden': 'Macaco dourado com fones de ouvido verdes e jaqueta creme',
} as const
export type ArtKey = keyof typeof ART

export const artSrc = (art: ArtKey) => `/images/nfts/${art}.webp`

/** Data-base fixa para que ordenação e "novos lançamentos" sejam reprodutíveis. */
export const CATALOG_BASE_DATE = Date.UTC(2026, 6, 29, 12, 0, 0)

function editions(id: string, kind: 'all' | 'limited' | 'open' | 'unique', soldOut: string[] = []): Edition[] {
  const make = (suffix: string, label: string, supply: number | null, available: number, maxPerOrder: number) => ({
    id: `${id}--${suffix}`,
    label,
    supply,
    available: soldOut.includes(suffix) ? 0 : available,
    maxPerOrder,
  })
  const unique = make('1-1', '1/1', 1, 1, 1)
  const ten = make('1-10', '1/10', 10, 7, 5)
  const fifty = make('1-50', '1/50', 50, 32, 10)
  const open = make('open', 'ABERTA', null, 500, 20)
  switch (kind) {
    case 'unique':
      return [unique]
    case 'limited':
      return [unique, ten, fifty]
    case 'open':
      return [fifty, open]
    default:
      return [unique, ten, fifty, open]
  }
}

const APES = { id: 'kurio-apes', name: 'Kurio Apes' }
const EDITIONS = { id: 'kurio-editions', name: 'Kurio Editions' }
const SIGNAL = { id: 'golden-signal', name: 'Golden Signal Club' }

const featured: NftSeed[] = [
  {
    id: 'emerald-ape-042', tokenId: '#0042', name: 'Emerald Ape #042', art: 'ape-emerald', price: '1.19', previousPrice: null,
    category: 'arte-digital', network: 'ethereum', badge: 'RARO', collection: APES, attributes: ['Óculos', 'Esmeralda', 'Raro'],
    rating: { average: 4.8, count: 19 }, popularity: 98, listedDaysAgo: 1, editions: editions('emerald-ape-042', 'all'),
  },
  {
    id: 'sage-nomad-009', tokenId: '#0009', name: 'Sage Nomad #009', art: 'gorilla-sage', price: '1.69', previousPrice: null,
    category: 'colecionaveis', network: 'ethereum', badge: null, collection: EDITIONS, attributes: ['Chapéu', 'Sálvia'],
    rating: { average: 4.6, count: 12 }, popularity: 91, listedDaysAgo: 2, editions: editions('sage-nomad-009', 'limited'),
  },
  {
    id: 'neon-vessel-552', tokenId: '#0552', name: 'Neon Vessel #552', art: 'gorilla-ivory', price: '1.99', previousPrice: '2.29',
    category: 'arte-3d', network: 'polygon', badge: null, collection: EDITIONS, attributes: ['Blazer', 'Marfim', 'Neon'],
    rating: { average: 4.7, count: 22 }, popularity: 88, listedDaysAgo: 3, editions: editions('neon-vessel-552', 'all'),
  },
  {
    id: 'cosmic-bloom-118', tokenId: '#0118', name: 'Cosmic Bloom #118', art: 'gorilla-sage', price: '1.29', previousPrice: null,
    category: 'generativa', network: 'ethereum', badge: null, collection: EDITIONS, attributes: ['Moletom', 'Lilás'],
    rating: { average: 4.4, count: 9 }, popularity: 76, listedDaysAgo: 4, editions: editions('cosmic-bloom-118', 'open'),
  },
  {
    id: 'violet-nomad-314', tokenId: '#0314', name: 'Violet Nomad #314', art: 'gorilla-sage', price: '1.39', previousPrice: null,
    category: 'arte-digital', network: 'solana', badge: null, collection: EDITIONS, attributes: ['Chapéu', 'Violeta'],
    rating: { average: 4.5, count: 14 }, popularity: 83, listedDaysAgo: 5, editions: editions('violet-nomad-314', 'all'),
  },
  {
    id: 'ivory-baron-088', tokenId: '#0088', name: 'Ivory Baron #088', art: 'gorilla-ivory', price: '1.79', previousPrice: null,
    category: 'colecionaveis', network: 'ethereum', badge: null, collection: APES, attributes: ['Blazer', 'Gola alta'],
    rating: { average: 4.9, count: 31 }, popularity: 95, listedDaysAgo: 6, editions: editions('ivory-baron-088', 'all'),
  },
  {
    id: 'golden-beat-207', tokenId: '#0207', name: 'Golden Beat #207', art: 'monkey-golden', price: '0.99', previousPrice: null,
    category: 'musica', network: 'polygon', badge: null, collection: SIGNAL, attributes: ['Fones', 'Dourado'],
    rating: { average: 4.3, count: 8 }, popularity: 70, listedDaysAgo: 7, editions: editions('golden-beat-207', 'open'),
  },
  {
    id: 'golden-frequency-071', tokenId: '#0071', name: 'Golden Frequency #071', art: 'monkey-golden', price: '0.59', previousPrice: null,
    category: 'musica', network: 'solana', badge: null, collection: SIGNAL, attributes: ['Fones', 'Frequência'],
    rating: { average: 4.1, count: 5 }, popularity: 64, listedDaysAgo: 8, editions: editions('golden-frequency-071', 'open', ['1-50']),
  },
  {
    id: 'golden-signal-160', tokenId: '#0160', name: 'Golden Signal #160', art: 'monkey-golden', price: '0.39', previousPrice: null,
    category: 'musica', network: 'ethereum', badge: null, collection: SIGNAL, attributes: ['Fones', 'Sinal'],
    rating: { average: 4.2, count: 6 }, popularity: 61, listedDaysAgo: 9, editions: editions('golden-signal-160', 'all'),
  },
]

const ARTS: ArtKey[] = ['ape-emerald', 'gorilla-sage', 'gorilla-ivory', 'monkey-golden']
const ADJECTIVES = ['Amber', 'Velvet', 'Lunar', 'Copper', 'Silent', 'Crimson', 'Jade', 'Solar', 'Midnight', 'Opal', 'Rustic', 'Hollow', 'Gilded', 'Misty', 'Electric', 'Quiet', 'Royal', 'Dusty', 'Atomic', 'Pale', 'Wild', 'Iron', 'Frost', 'Cinder', 'Coral', 'Shadow', 'Prism']
const NOUNS = ['Monk', 'Drifter', 'Echo', 'Warden', 'Pilot', 'Scholar', 'Rider', 'Oracle', 'Keeper', 'Rogue', 'Seeker', 'Herald']
const COLLECTIONS = [APES, EDITIONS, SIGNAL]
const NETWORK_CYCLE: Network[] = ['ethereum', 'polygon', 'ethereum', 'solana', 'polygon']
const CATEGORY_CYCLE: Category[] = ['arte-digital', 'fotografia', 'musica', 'arte-3d', 'colecionaveis', 'generativa', 'jogos', 'assinaturas', 'utilidade']
const KINDS = ['all', 'limited', 'open', 'unique'] as const

/** Preço determinístico entre 0.05 e 12.30 ETH com 2 casas (inteiros em centésimos). */
function priceFor(i: number) {
  const cents = 5 + ((i * 337 + 41) % 1225)
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`
}

const generated: NftSeed[] = Array.from({ length: 27 }, (_, i) => {
  const n = 600 + i * 13
  const name = `${ADJECTIVES[i % ADJECTIVES.length]} ${NOUNS[(i * 5) % NOUNS.length]} #${n}`
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '')
  const art = ARTS[i % ARTS.length] as ArtKey
  const kind = KINDS[i % KINDS.length] as (typeof KINDS)[number]
  return {
    id,
    tokenId: `#${String(n).padStart(4, '0')}`,
    name,
    art,
    price: priceFor(i),
    previousPrice: i % 7 === 3 ? priceFor(i + 50) : null,
    category: CATEGORY_CYCLE[i % CATEGORY_CYCLE.length] as Category,
    network: NETWORK_CYCLE[i % NETWORK_CYCLE.length] as Network,
    badge: i % 9 === 4 ? 'RARO' : null,
    collection: COLLECTIONS[i % COLLECTIONS.length] as NftSeed['collection'],
    attributes: ['Edição Kurio', ADJECTIVES[i % ADJECTIVES.length] as string],
    rating: { average: 3.8 + ((i * 7) % 12) / 10, count: 3 + ((i * 11) % 40) },
    popularity: 10 + ((i * 29) % 60),
    listedDaysAgo: 10 + i * 3,
    editions: editions(id, kind, i % 10 === 6 ? ['1-1'] : []),
  }
})

export const NFT_SEEDS: NftSeed[] = [...featured, ...generated]

/** Edição esgotada usada nos cenários de "edição indisponível". */
export const SOLD_OUT_EXAMPLE = { nftId: 'golden-frequency-071', editionId: 'golden-frequency-071--1-50' }
