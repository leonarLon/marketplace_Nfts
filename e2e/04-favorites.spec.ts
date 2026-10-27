import { expect, mock, test } from './support/fixtures'
import { signedIn } from './support/flows'

test.describe('4. Favoritos com atualização otimista, falha e recuperação', () => {
  test('favoritar persiste; falha na mutation desfaz o estado otimista', async ({ page }) => {
    await signedIn(page, '/nft/emerald-ape-042')
    const button = page.getByRole('button', { name: 'Favoritar', exact: true }).filter({ visible: true }).first()
    await expect(button).toHaveAttribute('aria-pressed', 'false')

    // Sucesso: muda na hora e persiste após refresh
    await button.click()
    await expect(button).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByText('Emerald Ape #042 adicionado à lista de interesse.')).toBeVisible()
    await page.reload()
    await expect(page.getByRole('button', { name: 'Favoritar', exact: true }).filter({ visible: true }).first()).toHaveAttribute('aria-pressed', 'true')

    // Falha: atualização otimista aparece e é revertida
    await mock(page, 'injectFault', { route: 'favorites:remove', kind: 'status', status: 503, times: 1 })
    const pressed = page.getByRole('button', { name: 'Favoritar', exact: true }).filter({ visible: true }).first()
    await pressed.click()
    await expect(page.getByText(/Não foi possível remover Emerald Ape #042/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Favoritar', exact: true }).filter({ visible: true }).first()).toHaveAttribute('aria-pressed', 'true')

    // Recuperação: nova tentativa funciona
    await page.getByRole('button', { name: 'Favoritar', exact: true }).filter({ visible: true }).first().click()
    await expect(page.getByRole('button', { name: 'Favoritar', exact: true }).filter({ visible: true }).first()).toHaveAttribute('aria-pressed', 'false')
    await page.goto('/perfil/favoritos')
    await expect(page.getByText('Emerald Ape #042')).toHaveCount(0)
  })

  test('visitante é levado ao login ao favoritar', async ({ page }) => {
    await page.goto('/nft/emerald-ape-042?scenario=default')
    await page.getByRole('button', { name: 'Favoritar', exact: true }).filter({ visible: true }).first().click()
    await expect(page).toHaveURL(/\/entrar\?redirect=%2Fnft%2Femerald-ape-042/)
  })
})
