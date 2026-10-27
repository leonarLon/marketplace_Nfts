import { io, type Socket } from 'socket.io-client'
import type { QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryKeys } from '@/app/query-keys'
import type { Cart, Order } from '@/contracts/commerce'
import { isTerminal } from '@/contracts/commerce'
import { realtimeEventSchema, type NftUpdatedEvent, type OrderUpdatedEvent } from '@/contracts/events'
import type { FeaturedResponse, NftDetail, NftListResponse, NftSummary } from '@/contracts/nft'
import { equals, formatEth } from '@/lib/money'
import { nftVersions } from './version-store'

export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? 'wss://realtime.kurio.test'

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'offline'

/**
 * Uma instância por sessão (usuário ou visitante). Ao trocar de sessão a instância antiga é
 * descartada com `dispose()`: listeners removidos, socket desconectado e eventos tardios ignorados.
 */
export class RealtimeClient {
  private readonly socket: Socket
  private readonly seen = new Set<string>()
  private readonly orderVersions = new Map<string, number>()
  private disposed = false
  private hasConnected = false
  private statusListeners = new Set<(s: ConnectionStatus) => void>()
  status: ConnectionStatus = 'connecting'

  constructor(
    private readonly queryClient: QueryClient,
    private readonly userId: string | null,
    token: string | null,
  ) {
    this.socket = io(SOCKET_URL, {
      // O mock intercepta WebSocket; long-polling HTTP não é usado.
      transports: ['websocket'],
      auth: token ? { token } : {},
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
    })
    this.socket.on('connect', this.onConnect)
    this.socket.on('disconnect', this.onDisconnect)
    this.socket.io.on('reconnect_attempt', () => this.setStatus('reconnecting'))
    this.socket.on('connect_error', () => this.setStatus('reconnecting'))
    this.socket.on('nft.updated', (payload: unknown) => this.handle(payload))
    this.socket.on('order.updated', (payload: unknown) => this.handle(payload))
  }

  onStatus(listener: (s: ConnectionStatus) => void) {
    this.statusListeners.add(listener)
    listener(this.status)
    return () => {
      this.statusListeners.delete(listener)
    }
  }

  private setStatus(status: ConnectionStatus) {
    if (this.disposed || this.status === status) return
    this.status = status
    this.statusListeners.forEach((l) => l(status))
  }

  private onConnect = () => {
    this.setStatus('connected')
    if (this.hasConnected) this.reconcile()
    this.hasConnected = true
  }

  private onDisconnect = () => {
    this.setStatus(this.socket.active ? 'reconnecting' : 'offline')
  }

  /** Após reconectar, a API REST é a fonte de verdade para tudo que pode ter mudado offline. */
  private reconcile() {
    void this.queryClient.invalidateQueries({ queryKey: queryKeys.nfts.all })
    void this.queryClient.invalidateQueries({ queryKey: queryKeys.cart(this.userId) })
    void this.queryClient.invalidateQueries({ queryKey: [...queryKeys.scope(this.userId), 'quote'] })
    if (this.userId) {
      void this.queryClient.invalidateQueries({ queryKey: ['user', this.userId, 'order'] })
    }
  }

  private handle(payload: unknown) {
    if (this.disposed) return
    const parsed = realtimeEventSchema.safeParse(payload)
    if (!parsed.success) return
    const event = parsed.data
    if (this.seen.has(event.eventId)) return
    this.seen.add(event.eventId)
    if (event.type === 'nft.updated') this.applyNft(event)
    else this.applyOrder(event)
  }

  private applyNft(event: NftUpdatedEvent) {
    const id = event.resource.id
    const cachedDetail = this.queryClient.getQueryData<NftDetail>(queryKeys.nfts.detail(id))
    const known = Math.max(nftVersions.get(id), cachedDetail?.version ?? 0)
    if (event.version <= known) return
    nftVersions.observe(id, event.version)

    const { price, previousPrice, editions } = event.data
    const availability = new Map(editions.map((e) => [e.id, e.available]))
    const total = editions.reduce((s, e) => s + e.available, 0)
    const patchSummary = <T extends NftSummary>(nft: T): T =>
      nft.id === id && nft.version < event.version ? { ...nft, price, previousPrice, available: total, version: event.version } : nft

    this.queryClient.setQueryData<NftDetail>(queryKeys.nfts.detail(id), (old) =>
      old && old.version < event.version
        ? {
            ...patchSummary(old),
            editions: old.editions.map((e) => ({ ...e, available: availability.get(e.id) ?? e.available })),
          }
        : old,
    )
    this.queryClient.setQueriesData<NftListResponse>({ queryKey: queryKeys.nfts.lists() }, (old) =>
      old ? { ...old, items: old.items.map(patchSummary) } : old,
    )
    this.queryClient.setQueriesData<{ items: NftSummary[] }>({ queryKey: ['nfts', 'related'] }, (old) =>
      old ? { ...old, items: old.items.map(patchSummary) } : old,
    )
    this.queryClient.setQueryData<FeaturedResponse>(queryKeys.nfts.featured(), (old) =>
      old ? { heroes: old.heroes.map(patchSummary), spotlight: patchSummary(old.spotlight) } : old,
    )

    // Carrinho: reflete imediatamente e avisa; depois confirma com a API.
    const cartKey = queryKeys.cart(this.userId)
    const cart = this.queryClient.getQueryData<Cart>(cartKey)
    const affected = cart?.items.filter((i) => i.nftId === id) ?? []
    if (cart && affected.length) {
      this.queryClient.setQueryData<Cart>(cartKey, {
        ...cart,
        items: cart.items.map((i) =>
          i.nftId === id ? { ...i, unitPrice: price, available: availability.get(i.editionId) ?? i.available, nftVersion: event.version } : i,
        ),
      })
      const item = affected[0]!
      const priceChanged = !equals(item.unitPrice, price)
      const soldOut = affected.some((i) => (availability.get(i.editionId) ?? i.available) === 0)
      toast.warning(
        soldOut
          ? `${item.name}: edição esgotada. Revise seu carrinho.`
          : priceChanged
            ? `${item.name}: preço alterado para ${formatEth(price)} ETH.`
            : `${item.name}: disponibilidade atualizada.`,
        { id: `nft-${id}` },
      )
      void this.queryClient.invalidateQueries({ queryKey: cartKey })
    }
    // Cotações com este NFT deixam de valer; a revalidação busca valores novos na API.
    void this.queryClient.invalidateQueries({ queryKey: [...queryKeys.scope(this.userId), 'quote'] })
  }

  private applyOrder(event: OrderUpdatedEvent) {
    if (!this.userId) return
    const id = event.resource.id
    if (event.version <= (this.orderVersions.get(id) ?? 0)) return
    const key = queryKeys.order(this.userId, id)
    const current = this.queryClient.getQueryData<Order>(key)
    // Estados terminais nunca regridem; versões antigas são ignoradas.
    if (current && (current.version >= event.version || isTerminal(current.status))) return
    this.orderVersions.set(id, event.version)
    this.queryClient.setQueryData<Order>(key, event.data)
    if (isTerminal(event.data.status)) {
      void this.queryClient.invalidateQueries({ queryKey: queryKeys.cart(this.userId) })
    }
  }

  /** Para testes e reconexão manual a partir da UI. */
  reconnect() {
    if (!this.disposed && !this.socket.connected) this.socket.connect()
  }

  dispose() {
    this.disposed = true
    this.statusListeners.clear()
    this.socket.removeAllListeners()
    this.socket.io.removeAllListeners()
    this.socket.disconnect()
  }
}
