import { expect, type Page } from '@playwright/test'
import { login, open, type Credentials, type Scenario, USERS } from './fixtures'

/** Adiciona um NFT ao carrinho pela página de detalhe. */
export async function addFromDetail(page: Page, nftId: string, opts: { quantity?: number; edition?: string } = {}) {
  await page.goto(`/nft/${nftId}`)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  if (opts.edition) await page.getByRole('radio', { name: opts.edition, exact: true }).click()
  const increase = page.getByRole('button', { name: 'Aumentar quantidade' }).filter({ visible: true }).first()
  for (let i = 1; i < (opts.quantity ?? 1); i += 1) await increase.click()
  const addButton = page.getByRole('button', { name: 'Adicionar ao carrinho' }).filter({ visible: true }).first()
  const response = page.waitForResponse((r) => r.url().includes('/api/cart/items') && r.request().method() === 'POST')
  await addButton.click()
  expect((await response).ok()).toBe(true)
}

/** Login (Ana por padrão) partindo do cenário pedido e voltando para `path`. */
export async function signedIn(page: Page, path = '/', scenario: Scenario = 'default', user: Credentials = USERS.ana) {
  await open(page, `/entrar?redirect=${encodeURIComponent(path)}`, scenario)
  await login(page, user)
  await page.waitForURL((url) => url.pathname === path.split('?')[0])
}

/** No checkout: conecta a carteira e abre a revisão. */
export async function reviewCheckout(page: Page) {
  await expect(page.getByRole('heading', { name: 'Perfil do colecionador' })).toBeVisible()
  const connect = page.getByRole('button', { name: /^Conectar / })
  if (await connect.isVisible()) {
    await connect.click()
    await expect(page.getByText(/Conectada em/)).toBeVisible()
  }
  await page.getByRole('button', { name: 'Revisar e confirmar compra' }).click()
  await expect(page.getByRole('dialog', { name: 'Revise sua compra' })).toBeVisible()
}
