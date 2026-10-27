import type { NftUpdatedEvent } from '@/contracts/events'
import { db, nextId, nowIso, resetDb } from './db'
import { clearSettlementTimers, resumePendingOrders, settleOrder, updateNft } from './domain'
import { clearFaults, injectFault, type Fault } from './http-utils'
import { connectionCount, dropConnections, emitRaw, eventHistory, replayLastEvent, setRealtimeOffline } from './realtime'
import { isScenario, resetRuntime, SCENARIOS, type ScenarioName } from './scenarios'

/**
 * API de controle do backend simulado, exposta em `window.__kurioMock`.
 * Usada pelos testes Playwright e pelo painel de cenários. Todas as ações alteram o estado
 * do mock e, quando aplicável, publicam eventos pelo servidor Socket.IO simulado — a UI
 * só os recebe através do socket.io-client.
 */
export const mockControl = {
  scenarios: SCENARIOS,
  getScenario: () => db.scenario,

  /** Restaura integralmente o cenário (dados, falhas, timers, conexões). */
  reset(scenario: ScenarioName = 'default') {
    if (!isScenario(scenario)) throw new Error(`Cenário desconhecido: ${scenario}`)
    clearSettlementTimers()
    clearFaults()
    resetRuntime()
    setRealtimeOffline(false)
    dropConnections()
    resetDb(scenario)
  },

  /** Troca o cenário mantendo os dados atuais. */
  setScenario(scenario: ScenarioName) {
    if (!isScenario(scenario)) throw new Error(`Cenário desconhecido: ${scenario}`)
    db.scenario = scenario
    resetRuntime()
  },

  injectFault: (fault: Fault) => injectFault(fault),
  clearFaults,

  /** Altera preço e/ou disponibilidade de um NFT e publica `nft.updated`. */
  updateNft(nftId: string, patch: { price?: string; editions?: Record<string, number> }) {
    const nft = updateNft(nftId, patch)
    return { version: nft.version, price: nft.price }
  },

  /** Reenvia o último evento (duplicata exata). */
  replayLastEvent,

  /** Publica um nft.updated com versão anterior à atual (evento atrasado). */
  emitStaleNftEvent(nftId: string, price: string) {
    const nft = db.nfts[nftId]
    if (!nft) throw new Error(`NFT inexistente: ${nftId}`)
    const event: NftUpdatedEvent = {
      eventId: nextId('evt'),
      type: 'nft.updated',
      resource: { type: 'nft', id: nftId },
      version: Math.max(0, nft.version - 1),
      occurredAt: nowIso(),
      data: { price, previousPrice: null, editions: nft.editions.map((e) => ({ id: e.id, available: e.available })) },
    }
    emitRaw(event)
  },

  /** Derruba as conexões Socket.IO (o cliente reconecta sozinho). */
  dropConnections,
  /** Mantém o Socket.IO indisponível até ser liberado. */
  setRealtimeOffline,
  connectionCount,
  eventHistory,

  settleOrder: (orderId: string, outcome: 'confirmed' | 'declined') => settleOrder(orderId, outcome)?.status ?? null,
  pendingOrders: () => Object.values(db.orders).filter((o) => o.status === 'pending').map((o) => o.id),
  orderCount: () => Object.keys(db.orders).length,

  /** Expira todas as sessões ativas (próxima chamada autenticada recebe 401 SESSION_EXPIRED). */
  expireSessions() {
    for (const session of Object.values(db.sessions)) session.expiresAt = Date.now() - 1
  },

  snapshot: () => structuredClone(db),
}

export type MockControl = typeof mockControl

export function bootControl() {
  resumePendingOrders()
  ;(window as unknown as { __kurioMock: MockControl }).__kurioMock = mockControl
}
