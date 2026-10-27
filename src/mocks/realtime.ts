import { ws } from 'msw'
import { toSocketIo } from '@mswjs/socket.io-binding'
import type { RealtimeEvent } from '@/contracts/events'
import { db } from './db'

/**
 * Servidor Socket.IO simulado. O MSW intercepta o WebSocket aberto pelo `socket.io-client`
 * e `@mswjs/socket.io-binding` traduz o protocolo Engine.IO/Socket.IO. A aplicação usa
 * o cliente Socket.IO real — nenhum evento é entregue por chamada direta a setters ou cache.
 *
 * Limitações do binding (documentadas em ARCHITECTURE.md): apenas namespace "/", sem
 * acknowledgements nem payload binário, e o handshake é sempre aceito (sid fixo "test").
 */
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? 'wss://realtime.kurio.test'
// O MSW remove o prefixo "/socket.io/" do caminho do cliente antes de casar o handler,
// então o link aponta apenas para a origem do servidor de tempo real.
const realtime = ws.link(SOCKET_URL)

const HEARTBEAT_MS = 20_000

interface Connection {
  id: string
  token: string | null
  emit: (event: string, payload: unknown) => void
  close: () => void
}

const connections = new Map<string, Connection>()
const history: { event: string; payload: RealtimeEvent }[] = []
let offline = false

export function setRealtimeOffline(value: boolean) {
  offline = value
  if (value) dropConnections()
}

/** Usuário dono da conexão, revalidado a cada emissão (logout/expiração rebaixam a visitante). */
function userOf(conn: Connection): string | null {
  if (!conn.token) return null
  const session = db.sessions[conn.token]
  if (!session || session.revoked || session.expiresAt <= Date.now()) return null
  return session.userId
}

export const realtimeHandler = realtime.addEventListener('connection', (connection) => {
  const { client } = connection
  if (offline || db.scenario === 'offline') {
    queueMicrotask(() => client.close())
    return
  }

  const io = toSocketIo(connection)
  const conn: Connection = {
    id: client.id,
    token: null,
    emit: (event, payload) => io.client.emit(event, payload),
    close: () => client.close(),
  }
  connections.set(conn.id, conn)

  // Pacote CONNECT do Socket.IO ("40{...auth}") carrega o token enviado em `auth`.
  client.addEventListener('message', (event) => {
    if (typeof event.data !== 'string' || !event.data.startsWith('40')) return
    try {
      const auth = JSON.parse(event.data.slice(2) || '{}') as { token?: unknown }
      conn.token = typeof auth.token === 'string' ? auth.token : null
    } catch {
      conn.token = null
    }
  })

  // O binding anuncia pingInterval de 25 s; sem PING o cliente encerraria a conexão por timeout.
  const heartbeat = setInterval(() => client.send('2'), HEARTBEAT_MS)
  client.addEventListener('close', () => {
    clearInterval(heartbeat)
    connections.delete(conn.id)
  })
})

function record(payload: RealtimeEvent) {
  history.push({ event: payload.type, payload })
  if (history.length > 50) history.shift()
}

/** Eventos públicos (catálogo) vão para todas as conexões. */
export function broadcast(payload: RealtimeEvent) {
  record(payload)
  connections.forEach((conn) => conn.emit(payload.type, payload))
}

/** Eventos privados vão somente para conexões autenticadas do próprio usuário. */
export function emitToUser(userId: string, payload: RealtimeEvent) {
  record(payload)
  connections.forEach((conn) => {
    if (userOf(conn) === userId) conn.emit(payload.type, payload)
  })
}

/** Reenvia o último evento (mesmo eventId e versão) para exercitar a deduplicação. */
export function replayLastEvent(type?: RealtimeEvent['type']) {
  const last = [...history].reverse().find((h) => !type || h.event === type)
  if (!last) return false
  const target = last.payload
  if (target.type === 'order.updated') {
    const owner = db.orders[target.resource.id]?.userId
    connections.forEach((conn) => {
      if (owner && userOf(conn) === owner) conn.emit(target.type, target)
    })
  } else {
    connections.forEach((conn) => conn.emit(target.type, target))
  }
  return true
}

/** Envia um evento arbitrário já montado (usado para eventos antigos / fora de ordem). */
export function emitRaw(payload: RealtimeEvent, toUserId?: string) {
  connections.forEach((conn) => {
    if (!toUserId || userOf(conn) === toUserId) conn.emit(payload.type, payload)
  })
}

export function dropConnections() {
  connections.forEach((conn) => conn.close())
  connections.clear()
}

export function connectionCount() {
  return connections.size
}

export function eventHistory() {
  return history.map((h) => h.payload)
}
