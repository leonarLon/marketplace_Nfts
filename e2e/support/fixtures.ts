import { test as base, expect, type Page } from '@playwright/test'

export type Scenario =
  | 'default'
  | 'empty'
  | 'slow'
  | 'out-of-order'
  | 'offline'
  | 'server-error'
  | 'session-short'
  | 'payment-declined'
  | 'order-timeout'
  | 'price-changed'
  | 'sold-out'
  | 'wallet-rejected'
  | 'order-hold'

export interface Credentials {
  email: string
  password: string
  name?: string
}

export const USERS = {
  ana: { email: 'ana@kurio.test', password: 'Kurio2026', name: 'Ana Lima' },
  bruno: { email: 'bruno@kurio.test', password: 'Kurio2026', name: 'Bruno Costa' },
} satisfies Record<string, Credentials>

/** Navega iniciando o backend simulado no cenário pedido (reset completo dos dados). */
export async function open(page: Page, path: string, scenario: Scenario = 'default') {
  const sep = path.includes('?') ? '&' : '?'
  await page.goto(`${path}${sep}scenario=${scenario}`)
  await page.waitForFunction(() => Boolean((window as unknown as { __kurioMock?: unknown }).__kurioMock))
  // __kurioMock existe antes do render; aguarda a aplicação montar.
  await page.locator('#conteudo').waitFor({ state: 'attached' })
}

/**
 * Indicadores de sessão visíveis em qualquer layout: no desktop ficam no cabeçalho; na home
 * mobile (sem cabeçalho, como no Figma) ficam no item "Perfil" da Tab Bar.
 */
export const signedOutIndicator = (page: Page) =>
  page.getByRole('link', { name: 'Entrar', exact: true }).filter({ visible: true }).first()
export const accountIndicator = (page: Page, name: string | RegExp) =>
  page.getByLabel(typeof name === 'string' ? `Conta de ${name}` : name, { exact: typeof name === 'string' }).filter({ visible: true }).first()

/** Sai da conta e aguarda a sessão local ser encerrada. */
export async function logout(page: Page) {
  await page.getByRole('button', { name: 'Sair' }).click()
  await expect(signedOutIndicator(page)).toBeVisible()
}

/** Executa uma ação na API de controle do mock (window.__kurioMock). */
export async function mock<T>(page: Page, fn: string, ...args: unknown[]): Promise<T> {
  return page.evaluate(
    ([name, params]) => {
      const api = (window as unknown as { __kurioMock: Record<string, (...a: unknown[]) => unknown> }).__kurioMock
      return api[name as string]!(...(params as unknown[])) as never
    },
    [fn, args] as const,
  )
}

/** Aguarda o socket.io-client conectar (indicador data-status do RealtimeStatus). */
export async function realtimeConnected(page: Page) {
  await expect(page.getByTestId('realtime-status')).toHaveAttribute('data-status', 'connected')
}

export async function login(page: Page, user: Credentials = USERS.ana) {
  await page.getByPlaceholder('contato@email.com').fill(user.email)
  await page.getByPlaceholder('Senha', { exact: true }).fill(user.password)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
}

export async function loginVia(page: Page, path: string, user: Credentials = USERS.ana, scenario: Scenario = 'default') {
  await open(page, `/entrar?redirect=${encodeURIComponent(path)}`, scenario)
  await login(page, user)
  await page.waitForURL((url) => url.pathname === path.split('?')[0])
}

export const test = base
export { expect }
