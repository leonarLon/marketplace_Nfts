/**
 * Cenários determinísticos da API simulada. Selecione com `?scenario=<nome>` na URL,
 * pelo painel de cenários (dev/demo) ou por `window.__kurioMock.reset('<nome>')` nos testes.
 */
export const SCENARIOS = {
  default: 'Padrão: latência curta (120–380 ms), tudo funciona.',
  empty: 'Catálogo vazio.',
  slow: 'Latência alta e variável (1,6–2,8 s) em todas as rotas.',
  'out-of-order': 'Listagem com latência alternada (1ª lenta, 2ª rápida) para gerar respostas fora de ordem.',
  offline: 'Falha de conexão em todas as rotas REST e no Socket.IO.',
  'server-error': 'HTTP 500 na listagem e no detalhe de NFTs.',
  'session-short': 'Sessões expiram 45 s após o login.',
  'payment-declined': 'Todo pagamento é recusado pela simulação.',
  'order-timeout': 'A criação do pedido não responde a tempo na 1ª tentativa (pedido criado no servidor).',
  'price-changed': 'O preço do 1º item sobe ao enviar o pedido (evento nft.updated + 409).',
  'sold-out': 'A edição do 1º item esgota ao enviar o pedido (evento nft.updated + 409).',
  'wallet-rejected': 'A conexão de carteira é recusada pelo usuário simulado.',
  'order-hold': 'Pedidos ficam pendentes até serem liquidados manualmente (__kurioMock.settleOrder).',
} as const

export type ScenarioName = keyof typeof SCENARIOS
export const DEFAULT_SCENARIO: ScenarioName = 'default'

export function isScenario(value: unknown): value is ScenarioName {
  return typeof value === 'string' && value in SCENARIOS
}

/** PRNG determinístico (mulberry32) para latências reprodutíveis. */
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

let rng = mulberry32(42)
let listCalls = 0

export function resetRuntime() {
  rng = mulberry32(42)
  listCalls = 0
}

export function latencyFor(scenario: ScenarioName, route: string): number {
  if (scenario === 'out-of-order' && route === 'nfts:list') {
    listCalls += 1
    return listCalls % 2 === 1 ? 1500 : 150
  }
  const [min, max] = scenario === 'slow' ? [1600, 2800] : [120, 380]
  return Math.round(min + rng() * (max - min))
}

/** Tempo até a simulação de pagamento liquidar um pedido. */
export const SETTLE_DELAY_MS = 2500
export const SESSION_TTL_MS = 1000 * 60 * 60 * 8
export const SHORT_SESSION_TTL_MS = 45_000
export const QUOTE_TTL_MS = 1000 * 60 * 10
export const NETWORK_FEES = { ethereum: '0.016', polygon: '0.002', solana: '0.0008' } as const
