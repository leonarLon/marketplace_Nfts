import type { User, Wallet } from '@/contracts/account'
import type { Network } from '@/contracts/common'
import type { OrderStatus, Quote, QuoteLine } from '@/contracts/commerce'
import type { Category, Edition } from '@/contracts/nft'
import { ART, artSrc, CATALOG_BASE_DATE, NFT_SEEDS, type ArtKey } from './fixtures/nfts'
import { USER_SEEDS } from './fixtures/users'
import { DEFAULT_SCENARIO, isScenario, type ScenarioName } from './scenarios'

/**
 * Estado do "backend" simulado. É a única fonte dos dados mockados: REST e eventos Socket.IO
 * leem e escrevem aqui, garantindo consistência entre catálogo, carrinho, pedidos etc.
 * Persistido em localStorage para sobreviver ao refresh; `resetDb` restaura o cenário conhecido.
 */
export interface NftRecord {
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
  listedAt: string
  editions: Edition[]
  version: number
}

export interface CartRecord {
  id: string
  ownerId: string | null
  items: { id: string; nftId: string; editionId: string; quantity: number; priceAtAdd: string }[]
  couponCode: string | null
  version: number
  updatedAt: string
}

export interface OrderRecord {
  id: string
  userId: string
  idempotencyKey: string
  requestHash: string
  status: OrderStatus
  lines: QuoteLine[]
  subtotal: string
  discount: string
  networkFee: string
  total: string
  couponCode: string | null
  network: Network
  wallet: { id: string; nickname: string; provider: Wallet['provider']; address: string }
  txHash: string | null
  declineReason: string | null
  /** Momento em que a simulação de pagamento conclui (confirmado/recusado). null = aguardando controle manual. */
  settleAt: number | null
  outcome: 'confirmed' | 'declined'
  createdAt: string
  updatedAt: string
  version: number
}

export interface DbState {
  schema: number
  scenario: ScenarioName
  nfts: Record<string, NftRecord>
  users: Record<string, User>
  credentials: Record<string, { salt: string; hash: string }>
  sessions: Record<string, { userId: string; expiresAt: number; revoked: boolean }>
  carts: Record<string, CartRecord>
  favorites: Record<string, string[]>
  wallets: Record<string, { primary: Wallet | null; secondary: Wallet | null }>
  walletConnections: Record<string, { walletId: string; network: Network; connectedAt: string }>
  quotes: Record<string, { ownerId: string; quote: Quote }>
  orders: Record<string, OrderRecord>
  idempotency: Record<string, string>
  /** Gatilhos de cenário que devem disparar uma única vez por reset (ex.: preço alterado). */
  flags: Record<string, boolean>
  seq: number
}

const STORAGE_KEY = 'kurio-mock:db'
const SCHEMA_VERSION = 3

function seed(scenario: ScenarioName): DbState {
  const nfts: Record<string, NftRecord> = {}
  for (const s of NFT_SEEDS) {
    nfts[s.id] = {
      id: s.id,
      tokenId: s.tokenId,
      name: s.name,
      art: s.art,
      price: s.price,
      previousPrice: s.previousPrice,
      category: s.category,
      network: s.network,
      badge: s.badge,
      collection: s.collection,
      attributes: s.attributes,
      rating: s.rating,
      popularity: s.popularity,
      listedAt: new Date(CATALOG_BASE_DATE - s.listedDaysAgo * 86_400_000).toISOString(),
      editions: s.editions.map((e) => ({ ...e })),
      version: 1,
    }
  }
  const state: DbState = {
    schema: SCHEMA_VERSION,
    scenario,
    nfts,
    users: {},
    credentials: {},
    sessions: {},
    carts: {},
    favorites: {},
    wallets: {},
    walletConnections: {},
    quotes: {},
    orders: {},
    idempotency: {},
    flags: {},
    seq: 1,
  }
  for (const u of USER_SEEDS) {
    state.users[u.user.id] = { ...u.user }
    state.credentials[u.user.id] = { ...u.credential }
    state.favorites[u.user.id] = [...u.favorites]
    state.wallets[u.user.id] = structuredClone(u.wallets)
  }
  if (scenario === 'empty') state.nfts = {}
  return state
}

function load(): DbState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as DbState
      if (parsed.schema === SCHEMA_VERSION && isScenario(parsed.scenario)) return parsed
    }
  } catch {
    /* estado corrompido: recomeça do seed */
  }
  return seed(DEFAULT_SCENARIO)
}

export let db: DbState = load()

export function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
  } catch {
    /* sem storage: mantém só em memória */
  }
}

export function resetDb(scenario: ScenarioName = db.scenario) {
  db = seed(scenario)
  persist()
}

export function nextId(prefix: string) {
  db.seq += 1
  return `${prefix}_${db.seq.toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

export function nowIso() {
  return new Date().toISOString()
}

export function imageOf(nft: NftRecord) {
  return { image: artSrc(nft.art), imageAlt: `${nft.name}: ${ART[nft.art]}` }
}

export function availableOf(nft: NftRecord) {
  return nft.editions.reduce((sum, e) => sum + e.available, 0)
}
