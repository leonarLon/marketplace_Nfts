import type { ApiErrorCode, Network } from '@/contracts/common'
import type { Cart, CreateOrderRequest, Order, Quote, QuoteIssue, QuoteLine } from '@/contracts/commerce'
import type { NftDetail, NftListResponse, NftSummary } from '@/contracts/nft'
import { CATEGORIES, CATEGORY_LABEL, PAGE_SIZE } from '@/contracts/nft'
import { NETWORK_LABEL, NETWORKS } from '@/contracts/common'
import * as money from '@/lib/money'
import { availableOf, db, imageOf, nextId, nowIso, persist, type CartRecord, type NftRecord, type OrderRecord } from './db'
import { COUPONS } from './fixtures/users'
import { ART, artSrc } from './fixtures/nfts'
import { broadcast, emitToUser } from './realtime'
import { NETWORK_FEES, QUOTE_TTL_MS, SETTLE_DELAY_MS } from './scenarios'

export class MockHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly fieldErrors?: Record<string, string>,
    readonly details?: unknown,
  ) {
    super(message)
  }
}

/* ------------------------------------------------------------------ catálogo */

export function toSummary(nft: NftRecord): NftSummary {
  return {
    id: nft.id,
    tokenId: nft.tokenId,
    name: nft.name,
    ...imageOf(nft),
    price: nft.price,
    previousPrice: nft.previousPrice,
    category: nft.category,
    network: nft.network,
    badge: nft.badge,
    available: availableOf(nft),
    version: nft.version,
  }
}

export function toDetail(nft: NftRecord): NftDetail {
  const alt = ART[nft.art]
  return {
    ...toSummary(nft),
    collection: nft.collection,
    gallery: [0, 1, 2, 3].map((i) => ({ src: artSrc(nft.art), alt: `${nft.name}, vista ${i + 1}: ${alt}` })),
    summary: `Um colecionável digital finalizado à mão da coleção ${nft.collection.name}, verificado na ${NETWORK_LABEL[nft.network]}, com arte desbloqueável e acesso para colecionadores.`,
    description: [
      `${nft.name} é uma obra digital finalizada à mão da coleção ${nft.collection.name}. Cada atributo fica armazenado nos metadados do token e verificado na ${NETWORK_LABEL[nft.network]}. A obra explora identidade, movimento e luz em um mundo digital sem fronteiras.`,
      'A propriedade inclui a arte em alta resolução, lançamentos exclusivos para colecionadores e um registro permanente de procedência registrada na rede.',
    ],
    attributes: nft.attributes,
    rating: nft.rating,
    contract: '0x7A42...19E8',
    royaltiesBps: 500,
    editions: nft.editions,
    listedAt: nft.listedAt,
  }
}

export interface ListQuery {
  q: string
  tab: string
  categories: string[]
  networks: string[]
  priceMin: string | null
  priceMax: string | null
  sort: string
  page: number
  pageSize: number
}

const NEW_WINDOW_MS = 10 * 86_400_000

function matchesBase(nft: NftRecord, q: ListQuery) {
  if (q.q) {
    const term = q.q.toLowerCase()
    if (!`${nft.name} ${nft.collection.name} ${nft.tokenId}`.toLowerCase().includes(term)) return false
  }
  if (q.tab === 'new') {
    const newest = Math.max(...Object.values(db.nfts).map((n) => Date.parse(n.listedAt)))
    if (Date.parse(nft.listedAt) < newest - NEW_WINDOW_MS) return false
  }
  if (q.tab === 'trending' && nft.popularity < 75) return false
  if (q.priceMin && money.compare(nft.price, q.priceMin) < 0) return false
  if (q.priceMax && money.compare(nft.price, q.priceMax) > 0) return false
  return true
}

export function listNfts(q: ListQuery): NftListResponse {
  const all = Object.values(db.nfts)
  const base = all.filter((n) => matchesBase(n, q))
  const byCategory = (n: NftRecord) => !q.categories.length || q.categories.includes(n.category)
  const byNetwork = (n: NftRecord) => !q.networks.length || q.networks.includes(n.network)
  const filtered = base.filter((n) => byCategory(n) && byNetwork(n))

  const sorted = [...filtered].sort((a, b) => {
    switch (q.sort) {
      case 'price-asc':
        return money.compare(a.price, b.price) || a.id.localeCompare(b.id)
      case 'price-desc':
        return money.compare(b.price, a.price) || a.id.localeCompare(b.id)
      case 'popular':
        return b.popularity - a.popularity || a.id.localeCompare(b.id)
      default:
        return Date.parse(b.listedAt) - Date.parse(a.listedAt) || a.id.localeCompare(b.id)
    }
  })

  const totalPages = Math.ceil(sorted.length / q.pageSize)
  const start = (q.page - 1) * q.pageSize
  const prices = all.map((n) => n.price).sort(money.compare)

  return {
    items: sorted.slice(start, start + q.pageSize).map(toSummary),
    page: q.page,
    pageSize: q.pageSize,
    total: sorted.length,
    totalPages,
    facets: {
      categories: CATEGORIES.map((id) => ({
        id,
        label: CATEGORY_LABEL[id],
        count: base.filter((n) => n.category === id && byNetwork(n)).length,
      })),
      networks: NETWORKS.map((id) => ({
        id,
        label: NETWORK_LABEL[id],
        count: base.filter((n) => n.network === id && byCategory(n)).length,
      })),
      priceRange: { min: prices[0] ?? '0', max: prices.at(-1) ?? '0' },
    },
  }
}

export function parseListQuery(url: URL): ListQuery {
  const list = (key: string) => (url.searchParams.get(key) ?? '').split(',').filter(Boolean)
  const page = Number(url.searchParams.get('page') ?? '1')
  const priceMin = url.searchParams.get('priceMin')
  const priceMax = url.searchParams.get('priceMax')
  for (const [field, v] of [['priceMin', priceMin], ['priceMax', priceMax]] as const) {
    if (v && !money.isEthString(v)) {
      throw new MockHttpError(422, 'VALIDATION_ERROR', 'Faixa de preço inválida', { [field]: 'Valor inválido' })
    }
  }
  return {
    q: (url.searchParams.get('q') ?? '').trim(),
    tab: url.searchParams.get('tab') ?? 'all',
    categories: list('category'),
    networks: list('network'),
    priceMin,
    priceMax,
    sort: url.searchParams.get('sort') ?? 'recent',
    page: Number.isInteger(page) && page > 0 ? page : 1,
    pageSize: Number(url.searchParams.get('pageSize') ?? PAGE_SIZE) || PAGE_SIZE,
  }
}

export function getNft(id: string) {
  const nft = db.nfts[id]
  if (!nft) throw new MockHttpError(404, 'NOT_FOUND', 'NFT não encontrado')
  return nft
}

/** Altera preço/disponibilidade e publica `nft.updated` (REST e evento sempre consistentes). */
export function updateNft(id: string, patch: { price?: string; editions?: Record<string, number> }) {
  const nft = getNft(id)
  if (patch.price && !money.equals(patch.price, nft.price)) {
    nft.previousPrice = nft.price
    nft.price = patch.price
  }
  for (const [editionId, available] of Object.entries(patch.editions ?? {})) {
    const edition = nft.editions.find((e) => e.id === editionId)
    if (edition) edition.available = Math.max(0, available)
  }
  nft.version += 1
  persist()
  broadcast({
    eventId: nextId('evt'),
    type: 'nft.updated',
    resource: { type: 'nft', id: nft.id },
    version: nft.version,
    occurredAt: nowIso(),
    data: {
      price: nft.price,
      previousPrice: nft.previousPrice,
      editions: nft.editions.map((e) => ({ id: e.id, available: e.available })),
    },
  })
  persist()
  return nft
}

/* ------------------------------------------------------------------ carrinho */

export function findEdition(nftId: string, editionId: string) {
  const nft = getNft(nftId)
  const edition = nft.editions.find((e) => e.id === editionId)
  if (!edition) throw new MockHttpError(404, 'NOT_FOUND', 'Edição não encontrada')
  return { nft, edition }
}

export function createCart(ownerId: string | null): CartRecord {
  const cart: CartRecord = { id: nextId('cart'), ownerId, items: [], couponCode: null, version: 1, updatedAt: nowIso() }
  db.carts[cart.id] = cart
  return cart
}

export function userCart(userId: string) {
  return Object.values(db.carts).find((c) => c.ownerId === userId) ?? createCart(userId)
}

export function touch(cart: CartRecord) {
  cart.version += 1
  cart.updatedAt = nowIso()
  persist()
}

export function cartView(cart: CartRecord): Cart {
  return {
    id: cart.id,
    couponCode: cart.couponCode,
    version: cart.version,
    updatedAt: cart.updatedAt,
    items: cart.items.flatMap((item) => {
      const nft = db.nfts[item.nftId]
      const edition = nft?.editions.find((e) => e.id === item.editionId)
      if (!nft || !edition) return []
      return [
        {
          id: item.id,
          nftId: nft.id,
          editionId: edition.id,
          editionLabel: edition.label,
          name: nft.name,
          tokenId: nft.tokenId,
          ...imageOf(nft),
          quantity: item.quantity,
          unitPrice: nft.price,
          priceAtAdd: item.priceAtAdd,
          available: edition.available,
          maxPerOrder: edition.maxPerOrder,
          nftVersion: nft.version,
        },
      ]
    }),
  }
}

export function assertQuantity(nftId: string, editionId: string, quantity: number) {
  const { edition } = findEdition(nftId, editionId)
  if (edition.available === 0) throw new MockHttpError(409, 'OUT_OF_STOCK', `A edição ${edition.label} está esgotada`)
  const limit = Math.min(edition.available, edition.maxPerOrder)
  if (quantity > limit) {
    throw new MockHttpError(409, 'QUANTITY_LIMIT', `Quantidade máxima para a edição ${edition.label}: ${limit}`, undefined, { limit })
  }
}

export function addToCart(cart: CartRecord, nftId: string, editionId: string, quantity: number) {
  const { nft } = findEdition(nftId, editionId)
  const existing = cart.items.find((i) => i.nftId === nftId && i.editionId === editionId)
  const nextQty = (existing?.quantity ?? 0) + quantity
  assertQuantity(nftId, editionId, nextQty)
  if (existing) existing.quantity = nextQty
  else cart.items.push({ id: nextId('item'), nftId, editionId, quantity, priceAtAdd: nft.price })
  touch(cart)
}

export function mergeInto(target: CartRecord, source: CartRecord) {
  for (const item of source.items) {
    const edition = db.nfts[item.nftId]?.editions.find((e) => e.id === item.editionId)
    if (!edition) continue
    const existing = target.items.find((i) => i.nftId === item.nftId && i.editionId === item.editionId)
    const limit = Math.min(edition.available, edition.maxPerOrder)
    const qty = Math.min(limit, (existing?.quantity ?? 0) + item.quantity)
    if (qty <= 0) continue
    if (existing) existing.quantity = qty
    else target.items.push({ ...item, id: nextId('item'), quantity: qty })
  }
  target.couponCode ??= source.couponCode
  delete db.carts[source.id]
  touch(target)
}

export function validateCoupon(code: string) {
  const coupon = COUPONS[code.trim().toUpperCase()]
  if (!coupon) throw new MockHttpError(422, 'COUPON_INVALID', 'Cupom inválido', { code: 'Cupom inválido' })
  if (Date.parse(coupon.expiresAt) < Date.now()) {
    throw new MockHttpError(422, 'COUPON_EXPIRED', 'Este cupom expirou', { code: 'Este cupom expirou' })
  }
  return coupon
}

/* ------------------------------------------------------------------ cotação */

export function computeQuote(cart: CartRecord, network: Network, ownerId: string): Quote {
  if (!cart.items.length) throw new MockHttpError(422, 'VALIDATION_ERROR', 'O carrinho está vazio')
  const issues: QuoteIssue[] = []
  const lines: QuoteLine[] = []
  for (const item of cartView(cart).items) {
    if (item.available === 0) {
      issues.push({ kind: 'SOLD_OUT', itemId: item.id, message: `${item.name} (${item.editionLabel}) esgotou`, previous: String(item.quantity), current: '0' })
      continue
    }
    if (item.quantity > item.available) {
      issues.push({ kind: 'INSUFFICIENT_STOCK', itemId: item.id, message: `${item.name}: restam ${item.available}`, previous: String(item.quantity), current: String(item.available) })
    }
    if (!money.equals(item.unitPrice, item.priceAtAdd)) {
      issues.push({ kind: 'PRICE_CHANGED', itemId: item.id, message: `O preço de ${item.name} mudou`, previous: item.priceAtAdd, current: item.unitPrice })
    }
    const quantity = Math.min(item.quantity, item.available)
    lines.push({
      itemId: item.id,
      nftId: item.nftId,
      editionId: item.editionId,
      editionLabel: item.editionLabel,
      name: item.name,
      tokenId: item.tokenId,
      image: item.image,
      imageAlt: item.imageAlt,
      quantity,
      unitPrice: item.unitPrice,
      lineTotal: money.multiply(item.unitPrice, quantity),
      nftVersion: item.nftVersion,
    })
  }

  let coupon: Quote['coupon'] = null
  if (cart.couponCode) {
    try {
      coupon = { code: cart.couponCode, discountBps: validateCoupon(cart.couponCode).discountBps }
    } catch (error) {
      issues.push({ kind: 'COUPON_REMOVED', itemId: null, message: (error as Error).message, previous: cart.couponCode, current: null })
    }
  }

  const subtotal = money.add('0', ...lines.map((l) => l.lineTotal))
  const discount = coupon ? money.percentOf(subtotal, coupon.discountBps) : '0'
  const networkFee = lines.length ? NETWORK_FEES[network] : '0'
  const total = money.add(money.subtract(subtotal, discount), networkFee)
  const createdAt = Date.now()
  const quote: Quote = {
    id: nextId('quote'),
    cartVersion: cart.version,
    network,
    lines,
    coupon,
    subtotal,
    discount,
    networkFee,
    total,
    issues,
    createdAt: new Date(createdAt).toISOString(),
    expiresAt: new Date(createdAt + QUOTE_TTL_MS).toISOString(),
  }
  db.quotes[quote.id] = { ownerId, quote }
  persist()
  return quote
}

/* ------------------------------------------------------------------ pedidos */

export function toOrder(record: OrderRecord): Order {
  return {
    id: record.id,
    status: record.status,
    lines: record.lines,
    subtotal: record.subtotal,
    discount: record.discount,
    networkFee: record.networkFee,
    total: record.total,
    couponCode: record.couponCode,
    network: record.network,
    wallet: record.wallet,
    txHash: record.txHash,
    explorerUrl: record.txHash ? `https://sepolia.etherscan.io/tx/${record.txHash}` : null,
    declineReason: record.declineReason,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    version: record.version,
  }
}

function stableHash(value: unknown): string {
  const sort = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(sort)
      : v && typeof v === 'object'
        ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, sort(x)]))
        : v
  return JSON.stringify(sort(value))
}

export function findIdempotentOrder(userId: string, key: string, body: CreateOrderRequest) {
  const orderId = db.idempotency[`${userId}:${key}`]
  if (!orderId) return null
  const record = db.orders[orderId]
  if (!record) return null
  if (record.requestHash !== stableHash(body)) {
    throw new MockHttpError(409, 'IDEMPOTENCY_CONFLICT', 'Esta chave de idempotência já foi usada com outro pedido')
  }
  return record
}

/** Revalida a cotação contra o estado atual. Lança 409 com a nova cotação se algo mudou. */
export function revalidateQuote(userId: string, body: CreateOrderRequest, cart: CartRecord) {
  const stored = db.quotes[body.quoteId]
  if (!stored || stored.ownerId !== userId) throw new MockHttpError(404, 'NOT_FOUND', 'Cotação não encontrada')
  const { quote } = stored
  const fresh = () => computeQuote(cart, body.network, userId)
  if (Date.parse(quote.expiresAt) < Date.now()) {
    throw new MockHttpError(409, 'QUOTE_EXPIRED', 'A cotação expirou. Revise os valores.', undefined, { quote: fresh() })
  }
  if (quote.network !== body.network) {
    throw new MockHttpError(409, 'QUOTE_STALE', 'A rede mudou. Revise os valores.', undefined, { quote: fresh() })
  }
  for (const line of quote.lines) {
    const nft = db.nfts[line.nftId]
    const edition = nft?.editions.find((e) => e.id === line.editionId)
    if (!nft || !edition || edition.available < line.quantity) {
      throw new MockHttpError(409, 'OUT_OF_STOCK', `${line.name} (${line.editionLabel}) não tem mais a quantidade solicitada.`, undefined, { quote: fresh() })
    }
    if (!money.equals(nft.price, line.unitPrice)) {
      throw new MockHttpError(409, 'QUOTE_STALE', `O preço de ${line.name} mudou. Revise os valores.`, undefined, { quote: fresh() })
    }
  }
  if (quote.cartVersion !== cart.version) {
    throw new MockHttpError(409, 'QUOTE_STALE', 'O carrinho mudou desde a cotação. Revise os valores.', undefined, { quote: fresh() })
  }
  if (quote.coupon && cart.couponCode !== quote.coupon.code) {
    throw new MockHttpError(409, 'QUOTE_STALE', 'O cupom mudou. Revise os valores.', undefined, { quote: fresh() })
  }
  if (quote.issues.some((i) => i.kind === 'SOLD_OUT' || i.kind === 'INSUFFICIENT_STOCK')) {
    throw new MockHttpError(409, 'OUT_OF_STOCK', 'Há itens indisponíveis na cotação.', undefined, { quote: fresh() })
  }
  return quote
}

const settleTimers = new Map<string, ReturnType<typeof setTimeout>>()

export function createOrder(userId: string, key: string, body: CreateOrderRequest, quote: Quote): OrderRecord {
  const walletSet = db.wallets[userId]
  const wallet = [walletSet?.primary, walletSet?.secondary].find((w) => w?.id === body.walletId)
  if (!wallet) throw new MockHttpError(422, 'VALIDATION_ERROR', 'Carteira não encontrada', { walletId: 'Selecione uma carteira cadastrada' })
  const connection = db.walletConnections[userId]
  if (!connection || connection.walletId !== wallet.id) {
    throw new MockHttpError(409, 'WALLET_NOT_CONNECTED', 'Conecte a carteira selecionada antes de confirmar')
  }

  // Reserva o estoque enquanto o pagamento é processado.
  for (const line of quote.lines) {
    const edition = db.nfts[line.nftId]?.editions.find((e) => e.id === line.editionId)
    if (edition) edition.available -= line.quantity
  }
  const now = nowIso()
  const record: OrderRecord = {
    id: nextId('ord'),
    userId,
    idempotencyKey: key,
    requestHash: stableHash(body),
    status: 'pending',
    lines: structuredClone(quote.lines),
    subtotal: quote.subtotal,
    discount: quote.discount,
    networkFee: quote.networkFee,
    total: quote.total,
    couponCode: quote.coupon?.code ?? null,
    network: body.network,
    wallet: { id: wallet.id, nickname: wallet.nickname, provider: wallet.provider, address: wallet.address },
    txHash: null,
    declineReason: null,
    settleAt: db.scenario === 'order-hold' ? null : Date.now() + SETTLE_DELAY_MS,
    outcome: db.scenario === 'payment-declined' ? 'declined' : 'confirmed',
    createdAt: now,
    updatedAt: now,
    version: 1,
  }
  db.orders[record.id] = record
  db.idempotency[`${userId}:${key}`] = record.id
  delete db.quotes[quote.id]
  persist()
  for (const nftId of new Set(quote.lines.map((l) => l.nftId))) publishStock(nftId)
  scheduleSettlement(record)
  return record
}

function publishStock(nftId: string) {
  const nft = db.nfts[nftId]
  if (!nft) return
  updateNft(nftId, { editions: Object.fromEntries(nft.editions.map((e) => [e.id, e.available])) })
}

export function scheduleSettlement(record: OrderRecord) {
  if (record.status !== 'pending' || record.settleAt === null || settleTimers.has(record.id)) return
  const wait = Math.max(0, record.settleAt - Date.now())
  settleTimers.set(
    record.id,
    setTimeout(() => {
      settleTimers.delete(record.id)
      settleOrder(record.id)
    }, wait),
  )
}

/** Conclui a simulação de pagamento. Estados confirmados/recusados são terminais. */
export function settleOrder(orderId: string, outcome?: 'confirmed' | 'declined') {
  const record = db.orders[orderId]
  if (!record || record.status !== 'pending') return record ?? null
  const result = outcome ?? record.outcome
  record.status = result
  record.updatedAt = nowIso()
  record.version += 1
  record.settleAt = null

  if (result === 'confirmed') {
    record.txHash = `0x${Array.from(record.id + record.createdAt).reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7).toString(16).padStart(8, '0')}${'a91fe82c'.repeat(7)}`
    // Remove do carrinho apenas as quantidades efetivamente compradas.
    const cart = userCart(record.userId)
    for (const line of record.lines) {
      const item = cart.items.find((i) => i.nftId === line.nftId && i.editionId === line.editionId)
      if (!item) continue
      item.quantity -= line.quantity
    }
    cart.items = cart.items.filter((i) => i.quantity > 0)
    if (record.couponCode && cart.couponCode === record.couponCode) cart.couponCode = null
    touch(cart)
  } else {
    record.declineReason = 'Pagamento recusado pela carteira simulada.'
    for (const line of record.lines) {
      const edition = db.nfts[line.nftId]?.editions.find((e) => e.id === line.editionId)
      if (edition) edition.available += line.quantity
    }
    for (const nftId of new Set(record.lines.map((l) => l.nftId))) publishStock(nftId)
  }
  persist()
  emitToUser(record.userId, {
    eventId: nextId('evt'),
    type: 'order.updated',
    resource: { type: 'order', id: record.id },
    version: record.version,
    occurredAt: record.updatedAt,
    data: toOrder(record),
  })
  return record
}

/** Retoma timers de pedidos pendentes após refresh (o estado vem do localStorage). */
export function resumePendingOrders() {
  for (const record of Object.values(db.orders)) scheduleSettlement(record)
}

export function clearSettlementTimers() {
  settleTimers.forEach((t) => clearTimeout(t))
  settleTimers.clear()
}
