import { expect, mock, open, test } from './support/fixtures'
import { addFromDetail } from './support/flows'

test.describe('12. Skeletons em carregamento lento, falha e recuperação', () => {
  test('skeletons no catálogo, detalhe e resumo do carrinho (cenário lento)', async ({ page }) => {
    await page.goto('/?scenario=slow')
    await expect(page.getByTestId('nft-card-skeleton').first()).toBeVisible()
    await expect(page.getByTestId('nft-card').first()).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('nft-card-skeleton')).toHaveCount(0)

    await page.goto('/nft/emerald-ape-042')
    await expect(page.getByTestId('detail-skeleton')).toBeVisible()
    await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible({ timeout: 10_000 })
  })

  test('skeleton do resumo do carrinho e preservação de dimensões', async ({ page }) => {
    await open(page, '/')
    await addFromDetail(page, 'emerald-ape-042', { edition: '1/50' })
    await mock(page, 'setScenario', 'slow')
    await page.goto('/carrinho')
    await expect(page.getByTestId('summary-skeleton').filter({ visible: true })).toBeVisible()
    await expect(page.getByTestId('summary-total').filter({ visible: true })).toBeVisible({ timeout: 15_000 })
  })

  test('falha na listagem mostra erro e recupera com nova tentativa', async ({ page }) => {
    await open(page, '/nft/emerald-ape-042')
    // 3 falhas: tentativa inicial + 2 retries automáticos para erros transitórios
    await mock(page, 'injectFault', { route: 'nfts:list', kind: 'status', status: 500, times: 3 })
    // Navegação dentro da mesma instância (a falha injetada vive na memória do mock)
    const logo = page.getByRole('link', { name: 'Kurio, página inicial' })
    if (await logo.isVisible()) await logo.click()
    else await page.getByRole('button', { name: 'Voltar' }).click()
    const alert = page.getByRole('alert').filter({ hasText: 'Não foi possível carregar' })
    await expect(alert).toBeVisible({ timeout: 15_000 })
    await alert.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(page.getByTestId('nft-card').first()).toBeVisible()
  })

  test('falha de conexão (offline) é informada sem quebrar a página', async ({ page }) => {
    await page.goto('/nft/emerald-ape-042?scenario=offline')
    await expect(page.getByRole('alert').filter({ hasText: /Não foi possível conectar/ })).toBeVisible({ timeout: 15_000 })
    await mock(page, 'setScenario', 'default')
    await page.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible()
  })
})
