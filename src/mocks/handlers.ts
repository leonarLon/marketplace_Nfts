import { delay, http, HttpResponse } from 'msw'
import { z } from 'zod'
import {
  avatarUpdateSchema,
  loginRequestSchema,
  passwordRule,
  profileUpdateSchema,
  usernameRule,
  walletInputSchema,
  walletSlotSchema,
  type Session,
  type User,
} from '@/contracts/account'
import { networkSchema } from '@/contracts/common'
import { addCartItemSchema, createOrderRequestSchema, quoteRequestSchema } from '@/contracts/commerce'
import * as money from '@/lib/money'
import { db, nextId, nowIso, persist, type CartRecord } from './db'
import {
  addToCart,
  assertQuantity,
  cartView,
  computeQuote,
  createCart,
  createOrder,
  findIdempotentOrder,
  getNft,
  listNfts,
  mergeInto,
  MockHttpError,
  parseListQuery,
  revalidateQuote,
  settleOrder,
  toDetail,
  toOrder,
  toSummary,
  touch,
  updateNft,
  userCart,
  validateCoupon,
} from './domain'
import { API, bearer, hashPassword, parseBody, requireUser, route, sessionTtl } from './http-utils'
import { realtimeHandler } from './realtime'

const HTTP_TIMEOUT = Number(import.meta.env.VITE_HTTP_TIMEOUT ?? 8000)

function issueSession(user: User): Session {
  const token = `tok_${crypto.randomUUID()}`
  const expiresAt = Date.now() + sessionTtl()
  db.sessions[token] = { userId: user.id, expiresAt, revoked: false }
  persist()
  return { token, expiresAt: new Date(expiresAt).toISOString(), user }
}

function assertUnique(fields: { email?: string; username?: string }, exceptUserId?: string) {
  const users = Object.values(db.users).filter((u) => u.id !== exceptUserId)
  if (fields.email && users.some((u) => u.email.toLowerCase() === fields.email!.toLowerCase())) {
    throw new MockHttpError(409, 'EMAIL_TAKEN', 'Este e-mail já está cadastrado', { email: 'Este e-mail já está cadastrado' })
  }
  if (fields.username && users.some((u) => u.username.toLowerCase() === fields.username!.toLowerCase())) {
    throw new MockHttpError(409, 'USERNAME_TAKEN', 'Este nome de usuário já está em uso', { username: 'Este nome de usuário já está em uso' })
  }
}

/** Carrinho do dono da requisição: usuário autenticado ou visitante (X-Guest-Cart). */
function resolveCart(request: Request): CartRecord {
  if (bearer(request)) return userCart(requireUser(request).user.id)
  const guestId = request.headers.get('X-Guest-Cart')
  const existing = guestId ? db.carts[guestId] : undefined
  if (existing && existing.ownerId === null) return existing
  const cart = createCart(null)
  persist()
  return cart
}

function parseSlot(value: unknown) {
  const result = walletSlotSchema.safeParse(value)
  if (!result.success) throw new MockHttpError(404, 'NOT_FOUND', 'Carteira não encontrada')
  return result.data
}

function findItem(cart: CartRecord, itemId: string) {
  const item = cart.items.find((i) => i.id === itemId)
  if (!item) throw new MockHttpError(404, 'NOT_FOUND', 'Item não encontrado no carrinho')
  return item
}

export const handlers = [
  realtimeHandler,

  /* ------------------------------------------------------------ catálogo */
  http.get(`${API}/nfts`, route('nfts:list', ({ request }) => HttpResponse.json(listNfts(parseListQuery(new URL(request.url)))))),

  http.get(
    `${API}/nfts/featured`,
    route('nfts:featured', () => {
      const heroes = ['emerald-ape-042', 'ivory-baron-088', 'golden-beat-207'].flatMap((id) => (db.nfts[id] ? [db.nfts[id]] : []))
      const spotlight = db.nfts['cosmic-bloom-118']
      if (!heroes.length || !spotlight) throw new MockHttpError(404, 'NOT_FOUND', 'Sem destaques')
      return HttpResponse.json({ heroes: heroes.map(toSummary), spotlight: toSummary(spotlight) })
    }),
  ),

  http.get(`${API}/nfts/:id`, route('nfts:detail', ({ params }) => HttpResponse.json(toDetail(getNft(String(params.id)))))),

  http.get(
    `${API}/nfts/:id/related`,
    route('nfts:related', ({ params }) => {
      const nft = getNft(String(params.id))
      const items = Object.values(db.nfts)
        .filter((n) => n.id !== nft.id)
        .sort((a, b) => Number(b.collection.id === nft.collection.id) - Number(a.collection.id === nft.collection.id) || b.popularity - a.popularity)
        .slice(0, 10)
        .map(toSummary)
      return HttpResponse.json({ items })
    }),
  ),

  /* ------------------------------------------------------------ sessão */
  http.post(
    `${API}/auth/register`,
    route('auth:register', async ({ request }) => {
      const body = await parseBody(request, z.object({ username: usernameRule, email: z.email('Informe um e-mail válido'), password: passwordRule }))
      assertUnique(body)
      const id = nextId('usr')
      const salt = nextId('salt')
      const user: User = {
        id,
        username: body.username,
        displayName: body.username,
        email: body.email,
        ensName: null,
        walletNickname: null,
        avatarUrl: null,
        updatedAt: nowIso(),
      }
      db.users[id] = user
      db.credentials[id] = { salt, hash: await hashPassword(salt, body.password) }
      db.favorites[id] = []
      db.wallets[id] = { primary: null, secondary: null }
      return HttpResponse.json(issueSession(user), { status: 201 })
    }),
  ),

  http.post(
    `${API}/auth/login`,
    route('auth:login', async ({ request }) => {
      const body = await parseBody(request, loginRequestSchema)
      const user = Object.values(db.users).find((u) => u.email.toLowerCase() === body.email.toLowerCase())
      const credential = user ? db.credentials[user.id] : undefined
      if (!user || !credential || (await hashPassword(credential.salt, body.password)) !== credential.hash) {
        throw new MockHttpError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha incorretos')
      }
      return HttpResponse.json(issueSession(user))
    }),
  ),

  http.get(
    `${API}/auth/session`,
    route('auth:session', ({ request }) => {
      const { user, token, session } = requireUser(request)
      return HttpResponse.json({ token, expiresAt: new Date(session.expiresAt).toISOString(), user })
    }),
  ),

  http.post(
    `${API}/auth/logout`,
    route('auth:logout', ({ request }) => {
      const token = bearer(request)
      const session = token ? db.sessions[token] : undefined
      if (session) {
        session.revoked = true
        delete db.walletConnections[session.userId]
        persist()
      }
      return HttpResponse.json({ ok: true })
    }),
  ),

  /* ------------------------------------------------------------ favoritos */
  http.get(`${API}/favorites`, route('favorites:list', ({ request }) => HttpResponse.json({ nftIds: db.favorites[requireUser(request).user.id] ?? [] }))),

  http.put(
    `${API}/favorites/:nftId`,
    route('favorites:add', ({ request, params }) => {
      const { user } = requireUser(request)
      const nft = getNft(String(params.nftId))
      const list = (db.favorites[user.id] ??= [])
      if (!list.includes(nft.id)) list.push(nft.id)
      persist()
      return HttpResponse.json({ nftIds: list })
    }),
  ),

  http.delete(
    `${API}/favorites/:nftId`,
    route('favorites:remove', ({ request, params }) => {
      const { user } = requireUser(request)
      db.favorites[user.id] = (db.favorites[user.id] ?? []).filter((id) => id !== params.nftId)
      persist()
      return HttpResponse.json({ nftIds: db.favorites[user.id] })
    }),
  ),

  /* ------------------------------------------------------------ carrinho */
  http.get(`${API}/cart`, route('cart:get', ({ request }) => HttpResponse.json(cartView(resolveCart(request))))),

  http.post(
    `${API}/cart/items`,
    route('cart:add', async ({ request }) => {
      const cart = resolveCart(request)
      const body = await parseBody(request, addCartItemSchema)
      addToCart(cart, body.nftId, body.editionId, body.quantity)
      return HttpResponse.json(cartView(cart))
    }),
  ),

  http.patch(
    `${API}/cart/items/:itemId`,
    route('cart:update', async ({ request, params }) => {
      const cart = resolveCart(request)
      const { quantity } = await parseBody(request, z.object({ quantity: z.number().int().positive('Quantidade inválida') }))
      const item = findItem(cart, String(params.itemId))
      assertQuantity(item.nftId, item.editionId, quantity)
      item.quantity = quantity
      touch(cart)
      return HttpResponse.json(cartView(cart))
    }),
  ),

  http.delete(
    `${API}/cart/items/:itemId`,
    route('cart:remove', ({ request, params }) => {
      const cart = resolveCart(request)
      findItem(cart, String(params.itemId))
      cart.items = cart.items.filter((i) => i.id !== params.itemId)
      touch(cart)
      return HttpResponse.json(cartView(cart))
    }),
  ),

  http.put(
    `${API}/cart/coupon`,
    route('cart:coupon', async ({ request }) => {
      const cart = resolveCart(request)
      const { code } = await parseBody(request, z.object({ code: z.string().trim().min(1, 'Informe o código') }))
      validateCoupon(code)
      cart.couponCode = code.trim().toUpperCase()
      touch(cart)
      return HttpResponse.json(cartView(cart))
    }),
  ),

  http.delete(
    `${API}/cart/coupon`,
    route('cart:coupon-remove', ({ request }) => {
      const cart = resolveCart(request)
      cart.couponCode = null
      touch(cart)
      return HttpResponse.json(cartView(cart))
    }),
  ),

  http.post(
    `${API}/cart/merge`,
    route('cart:merge', async ({ request }) => {
      const { user } = requireUser(request)
      const { guestCartId } = await parseBody(request, z.object({ guestCartId: z.string() }))
      const target = userCart(user.id)
      const source = db.carts[guestCartId]
      if (source && source.ownerId === null && source.id !== target.id) mergeInto(target, source)
      return HttpResponse.json(cartView(target))
    }),
  ),

  /* ------------------------------------------------------------ cotação e pedidos */
  http.post(
    `${API}/quotes`,
    route('quotes:create', async ({ request }) => {
      // Visitantes também recebem cotação do próprio carrinho (resumo do carrinho); pedidos exigem login.
      const cart = resolveCart(request)
      const body = await parseBody(request, quoteRequestSchema)
      return HttpResponse.json(computeQuote(cart, body.network, cart.ownerId ?? `guest:${cart.id}`))
    }),
  ),

  http.post(
    `${API}/orders`,
    route('orders:create', async ({ request }) => {
      const { user } = requireUser(request)
      const key = request.headers.get('Idempotency-Key')
      if (!key) throw new MockHttpError(422, 'VALIDATION_ERROR', 'Cabeçalho Idempotency-Key obrigatório')
      const body = await parseBody(request, createOrderRequestSchema)

      const existing = findIdempotentOrder(user.id, key, body)
      if (existing) {
        if (existing.status === 'pending' && existing.settleAt !== null && existing.settleAt <= Date.now()) settleOrder(existing.id)
        return HttpResponse.json(toOrder(existing), { headers: { 'Idempotent-Replay': 'true' } })
      }

      const cart = userCart(user.id)
      const firstLine = db.quotes[body.quoteId]?.quote.lines[0]
      if (firstLine && db.scenario === 'price-changed' && !db.flags['price-changed']) {
        db.flags['price-changed'] = true
        const nft = getNft(firstLine.nftId)
        updateNft(nft.id, { price: money.add(nft.price, money.percentOf(nft.price, 1000)) })
      }
      if (firstLine && db.scenario === 'sold-out' && !db.flags['sold-out']) {
        db.flags['sold-out'] = true
        updateNft(firstLine.nftId, { editions: { [firstLine.editionId]: 0 } })
      }

      const quote = revalidateQuote(user.id, body, cart)
      const record = createOrder(user.id, key, body, quote)

      // Pedido criado no servidor, mas a resposta se perde: o cliente deve reenviar com a mesma chave.
      if (db.scenario === 'order-timeout' && !db.flags[`timeout:${key}`]) {
        db.flags[`timeout:${key}`] = true
        persist()
        await delay(HTTP_TIMEOUT + 4000)
      }
      return HttpResponse.json(toOrder(record), { status: 201 })
    }),
  ),

  http.get(
    `${API}/orders/:id`,
    route('orders:get', ({ request, params }) => {
      const { user } = requireUser(request)
      const record = db.orders[String(params.id)]
      // Pedido de outro usuário responde 404 para não revelar sua existência.
      if (!record || record.userId !== user.id) throw new MockHttpError(404, 'NOT_FOUND', 'Pedido não encontrado')
      if (record.status === 'pending' && record.settleAt !== null && record.settleAt <= Date.now()) settleOrder(record.id)
      return HttpResponse.json(toOrder(record))
    }),
  ),

  /* ------------------------------------------------------------ perfil */
  http.get(`${API}/profile`, route('profile:get', ({ request }) => HttpResponse.json(requireUser(request).user))),

  http.patch(
    `${API}/profile`,
    route('profile:update', async ({ request }) => {
      const { user } = requireUser(request)
      const body = await parseBody(request, profileUpdateSchema)
      assertUnique(body, user.id)
      Object.assign(user, body, { updatedAt: nowIso() })
      persist()
      return HttpResponse.json(user)
    }),
  ),

  http.put(
    `${API}/profile/avatar`,
    route('profile:avatar', async ({ request }) => {
      const { user } = requireUser(request)
      const { dataUrl } = await parseBody(request, avatarUpdateSchema)
      if (dataUrl && dataUrl.length > 700_000) {
        throw new MockHttpError(422, 'VALIDATION_ERROR', 'A imagem deve ter no máximo 512 KB', { avatar: 'A imagem deve ter no máximo 512 KB' })
      }
      user.avatarUrl = dataUrl
      user.updatedAt = nowIso()
      persist()
      return HttpResponse.json(user)
    }),
  ),

  http.post(
    `${API}/profile/password`,
    route('profile:password', async ({ request }) => {
      const { user } = requireUser(request)
      const body = await parseBody(request, z.object({ currentPassword: z.string().min(1), newPassword: passwordRule }))
      const credential = db.credentials[user.id]
      if (!credential || (await hashPassword(credential.salt, body.currentPassword)) !== credential.hash) {
        throw new MockHttpError(422, 'INVALID_PASSWORD', 'Senha atual incorreta', { currentPassword: 'Senha atual incorreta' })
      }
      const salt = nextId('salt')
      db.credentials[user.id] = { salt, hash: await hashPassword(salt, body.newPassword) }
      persist()
      return HttpResponse.json({ ok: true })
    }),
  ),

  /* ------------------------------------------------------------ carteiras */
  http.get(`${API}/wallets`, route('wallets:get', ({ request }) => HttpResponse.json(db.wallets[requireUser(request).user.id] ?? { primary: null, secondary: null }))),

  http.get(
    `${API}/wallets/connection`,
    route('wallets:connection', ({ request }) => {
      const { user } = requireUser(request)
      const connection = db.walletConnections[user.id]
      const wallet = [db.wallets[user.id]?.primary, db.wallets[user.id]?.secondary].find((w) => w?.id === connection?.walletId)
      return HttpResponse.json(connection && wallet ? { ...connection, address: wallet.address } : null)
    }),
  ),

  http.post(
    `${API}/wallets/connection`,
    route('wallets:connect', async ({ request }) => {
      const { user } = requireUser(request)
      const body = await parseBody(request, z.object({ walletId: z.string(), network: networkSchema }))
      const wallet = [db.wallets[user.id]?.primary, db.wallets[user.id]?.secondary].find((w) => w?.id === body.walletId)
      if (!wallet) throw new MockHttpError(404, 'NOT_FOUND', 'Carteira não encontrada')
      if (db.scenario === 'wallet-rejected') {
        throw new MockHttpError(403, 'WALLET_REJECTED', 'A conexão foi recusada na carteira')
      }
      const connection = { walletId: wallet.id, network: body.network, connectedAt: nowIso() }
      db.walletConnections[user.id] = connection
      persist()
      return HttpResponse.json({ ...connection, address: wallet.address })
    }),
  ),

  http.delete(
    `${API}/wallets/connection`,
    route('wallets:disconnect', ({ request }) => {
      const { user } = requireUser(request)
      delete db.walletConnections[user.id]
      persist()
      return HttpResponse.json({ ok: true })
    }),
  ),
  http.put(
    `${API}/wallets/:slot`,
    route('wallets:save', async ({ request, params }) => {
      const { user } = requireUser(request)
      const slot = parseSlot(params.slot)
      const body = await parseBody(request, walletInputSchema)
      const set = (db.wallets[user.id] ??= { primary: null, secondary: null })
      if (slot === 'secondary' && !set.primary) {
        throw new MockHttpError(422, 'VALIDATION_ERROR', 'Cadastre a carteira principal primeiro')
      }
      const wallet = { ...body, id: set[slot]?.id ?? nextId(`wal_${slot}`), slot, updatedAt: nowIso() }
      set[slot] = wallet
      persist()
      return HttpResponse.json(wallet)
    }),
  ),

  http.delete(
    `${API}/wallets/:slot`,
    route('wallets:remove', ({ request, params }) => {
      const { user } = requireUser(request)
      const slot = parseSlot(params.slot)
      const set = db.wallets[user.id]
      if (slot === 'primary' && set?.secondary) {
        throw new MockHttpError(422, 'VALIDATION_ERROR', 'Remova a carteira secundária antes da principal')
      }
      if (set) set[slot] = null
      persist()
      return HttpResponse.json({ ok: true })
    }),
  ),

]
