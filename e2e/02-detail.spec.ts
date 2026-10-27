import { expect, open, test } from './support/fixtures'

test.describe('2. Detalhe: acesso direto e recurso inexistente', () => {
  test('acesso direto ao detalhe carrega dados, edições e limite de quantidade', async ({ page }) => {
    await open(page, '/nft/ivory-baron-088')
    await expect(page.getByRole('heading', { level: 1, name: 'Ivory Baron #088' })).toBeVisible()
    await expect(page.getByText('ID do token: #0088').first()).toBeVisible()

    // Edição 1/10: máximo 5 por pedido
    await page.getByRole('radio', { name: '1/10', exact: true }).click()
    await expect(page.getByTestId('edition-availability')).toContainText('máximo de 5 por pedido')
    const increase = page.getByRole('button', { name: 'Aumentar quantidade' }).filter({ visible: true }).first()
    for (let i = 0; i < 4; i += 1) await increase.click()
    await expect(increase).toBeDisabled()
    await expect(page.getByRole('status', { name: 'Quantidade' }).filter({ visible: true }).first()).toHaveText('5')
  })

  test('edição esgotada fica indisponível', async ({ page }) => {
    await open(page, '/nft/golden-frequency-071')
    const soldOut = page.getByRole('radio', { name: /1\/50/ })
    await expect(soldOut).toBeDisabled()
    await expect(soldOut).toHaveAccessibleName(/esgotada/)
  })

  test('NFT inexistente mostra página de não encontrado', async ({ page }) => {
    await open(page, '/nft/nao-existe-999')
    await expect(page.getByRole('heading', { name: 'NFT não encontrado' })).toBeVisible()
    await page.getByRole('link', { name: 'Voltar ao início' }).click()
    await expect(page).toHaveURL(/\/$/)
  })

  test('rota inexistente mostra 404', async ({ page }) => {
    await open(page, '/rota/que/nao/existe')
    await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible()
  })
})
