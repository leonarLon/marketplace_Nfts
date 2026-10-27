import { expect, login, open, test, USERS } from './support/fixtures'
import { addFromDetail } from './support/flows'

const visible = <T extends import('@playwright/test').Locator>(l: T) => l.filter({ visible: true })

test.describe('5. Carrinho, quantidades, cupom e persistência', () => {
  test('quantidades, remoção, cupons e persistência após refresh e login', async ({ page }) => {
    await open(page, '/')
    await addFromDetail(page, 'violet-nomad-314', { edition: '1/50' })
    await addFromDetail(page, 'golden-beat-207', { edition: 'ABERTA', quantity: 2 })

    await page.goto('/carrinho')
    const items = visible(page.getByTestId('cart-item'))
    await expect(items).toHaveCount(2)
    // 1.39 + 2×0.99 = 3.37 + 0.016
    await expect(visible(page.getByTestId('summary-total'))).toHaveText('3.386 ETH')

    // Alterar quantidade
    await visible(page.getByRole('button', { name: 'Aumentar quantidade de Violet Nomad #314' })).click()
    await expect(visible(page.getByTestId('summary-subtotal'))).toHaveText('4.76 ETH')

    // Remover
    await visible(page.getByRole('button', { name: 'Remover Golden Beat #207 do carrinho' })).click()
    await expect(items).toHaveCount(1)
    await expect(visible(page.getByTestId('summary-subtotal'))).toHaveText('2.78 ETH')

    // Cupom inválido / expirado / válido
    const coupon = visible(page.getByRole('textbox', { name: 'Código promocional' }))
    const apply = visible(page.getByRole('button', { name: 'Aplicar' }))
    await coupon.fill('NAOEXISTE')
    await apply.click()
    await expect(visible(page.getByRole('alert').filter({ hasText: 'Cupom inválido' }))).toBeVisible()
    await expect(coupon).toHaveAttribute('aria-invalid', 'true')
    await coupon.fill('EXPIRADO')
    await apply.click()
    await expect(visible(page.getByRole('alert').filter({ hasText: 'Este cupom expirou' }))).toBeVisible()
    await coupon.fill('kurio10')
    await apply.click()
    await expect(visible(page.getByTestId('coupon-applied'))).toContainText('KURIO10')
    // 2.78 − 10% (0.278) + 0.016
    await expect(visible(page.getByTestId('summary-discount'))).toHaveText('(-) 0.278 ETH')
    await expect(visible(page.getByTestId('summary-total'))).toHaveText('2.518 ETH')

    // Persistência após refresh (visitante)
    await page.reload()
    await expect(items).toHaveCount(1)
    await expect(visible(page.getByTestId('coupon-applied'))).toContainText('KURIO10')

    // Login preserva os itens do visitante
    await page.goto('/entrar?redirect=%2Fcarrinho')
    await login(page, USERS.ana)
    await expect(page).toHaveURL(/\/carrinho$/)
    await expect(items).toHaveCount(1)
    await expect(items.first()).toContainText('Violet Nomad #314')
    await expect(visible(page.getByRole('status', { name: 'Quantidade de Violet Nomad #314' }))).toHaveText('2')
    await page.reload()
    await expect(items).toHaveCount(1)
  })
})
