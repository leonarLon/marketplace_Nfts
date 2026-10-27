import type { Page } from '@playwright/test'
import { expect, open, test } from './support/fixtures'
import { addFromDetail, signedIn } from './support/flows'

/** Estabiliza a captura: esconde elementos de demonstração e notificações transitórias. */
async function stabilize(page: Page) {
  await page.addStyleTag({
    content: `[aria-label="Abrir painel de cenários da demonstração"], [data-sonner-toaster] { display: none !important; }`,
  })
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
  // Imagens lazy fora da dobra não carregariam; a captura de página inteira precisa delas.
  await page.evaluate(() => document.querySelectorAll('img[loading="lazy"]').forEach((img) => ((img as HTMLImageElement).loading = 'eager')))
  await page.evaluate(() => Promise.all(Array.from(document.images).filter((i) => !i.complete).map((i) => new Promise((r) => (i.onload = i.onerror = r)))))
}

test.describe('Regressão visual (baselines versionadas)', () => {
  test('início', async ({ page }) => {
    await open(page, '/')
    await expect(page.getByTestId('nft-card')).toHaveCount(9)
    await stabilize(page)
    await expect(page).toHaveScreenshot('inicio.png', { fullPage: true })
  })

  test('detalhe', async ({ page }) => {
    await open(page, '/nft/emerald-ape-042')
    await expect(page.getByTestId('nft-card').first()).toBeVisible()
    await stabilize(page)
    await expect(page).toHaveScreenshot('detalhe.png', { fullPage: true })
  })

  test('carrinho', async ({ page }) => {
    await open(page, '/')
    await addFromDetail(page, 'emerald-ape-042', { edition: '1/50', quantity: 2 })
    await addFromDetail(page, 'violet-nomad-314', { edition: '1/50' })
    await page.goto('/carrinho')
    await expect(page.getByTestId('summary-total').filter({ visible: true })).toHaveText('3.786 ETH')
    await stabilize(page)
    await expect(page).toHaveScreenshot('carrinho.png', { fullPage: true })
  })

  test('pagamento', async ({ page }) => {
    await signedIn(page, '/')
    await addFromDetail(page, 'emerald-ape-042', { edition: '1/50', quantity: 2 })
    await page.goto('/pagamento')
    await expect(page.getByTestId('summary-total')).toHaveText('2.396 ETH')
    await stabilize(page)
    await expect(page).toHaveScreenshot('pagamento.png', { fullPage: true })
  })
})
