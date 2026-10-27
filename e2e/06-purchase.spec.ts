import { expect, mock, test } from './support/fixtures'
import { addFromDetail, reviewCheckout, signedIn } from './support/flows'

test.describe('6. Compra completa', () => {
  test('do catálogo ao recibo confirmado, com snapshot imutável e remoção das quantidades compradas', async ({ page }) => {
    await signedIn(page, '/')

    // Catálogo → detalhe
    await page.getByRole('link', { name: 'Emerald Ape #042' }).first().click()
    await expect(page).toHaveURL(/\/nft\/emerald-ape-042$/)
    await addFromDetail(page, 'emerald-ape-042', { quantity: 2, edition: '1/50' })

    await page.goto('/carrinho')
    await expect(page.getByTestId('summary-total').filter({ visible: true })).toHaveText('2.396 ETH')
    await page.getByRole('button', { name: 'Conectar e finalizar' }).filter({ visible: true }).click()
    await expect(page).toHaveURL(/\/pagamento$/)

    await reviewCheckout(page)
    const review = page.getByTestId('review')
    await expect(review).toContainText('Emerald Ape #042')
    await expect(review.getByTestId('summary-total')).toHaveText('2.396 ETH')
    await page.getByTestId('confirm-purchase').click()

    // Pendente → confirmado somente após a simulação confirmar
    await expect(page).toHaveURL(/\/pedido\/ord_/)
    await expect(page.getByTestId('order-pending')).toBeVisible()
    await expect(page.getByTestId('order-confirmed')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('receipt-total')).toHaveText('2.396 ETH')
    await expect(page.getByTestId('receipt-line')).toHaveCount(1)
    await expect(page.getByTestId('tx-hash')).toHaveText(/^0x/)

    // Alteração posterior do catálogo não altera o recibo (snapshot)
    await mock(page, 'updateNft', 'emerald-ape-042', { price: '9.99' })
    await page.reload()
    await expect(page.getByTestId('receipt-total')).toHaveText('2.396 ETH')

    // Carrinho sem os itens comprados
    await page.goto('/carrinho')
    await expect(page.getByTestId('cart-empty')).toBeVisible()
    expect(await mock<number>(page, 'orderCount')).toBe(1)
  })
})
