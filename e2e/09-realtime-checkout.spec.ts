import { expect, mock, realtimeConnected, test } from './support/fixtures'
import { addFromDetail, reviewCheckout, signedIn } from './support/flows'

test.describe('9. Alteração de preço/disponibilidade via Socket.IO durante o checkout', () => {
  test('mudança de preço avisa, atualiza o resumo e bloqueia a cotação desatualizada', async ({ page }) => {
    await signedIn(page, '/')
    await addFromDetail(page, 'emerald-ape-042', { edition: '1/50' })
    await page.goto('/carrinho')
    await realtimeConnected(page)
    await expect(page.getByTestId('summary-total').filter({ visible: true })).toHaveText('1.206 ETH')

    // Evento chega pelo socket.io-client enquanto o carrinho está aberto
    await mock(page, 'updateNft', 'emerald-ape-042', { price: '1.50' })
    await expect(page.getByText('Emerald Ape #042: preço alterado para 1.50 ETH.')).toBeVisible()
    await expect(page.getByTestId('price-changed').filter({ visible: true })).toContainText('era 1.19 ETH')
    await expect(page.getByTestId('summary-total').filter({ visible: true })).toHaveText('1.516 ETH')

    // No checkout: revisão aberta, novo evento torna a cotação obsoleta
    await page.getByRole('button', { name: 'Conectar e finalizar' }).filter({ visible: true }).click()
    await reviewCheckout(page)
    const confirm = page.getByTestId('confirm-purchase')
    await expect(confirm).toBeEnabled()
    await mock(page, 'updateNft', 'emerald-ape-042', { price: '1.80' })
    await expect(page.getByTestId('quote-changed')).toBeVisible()
    await expect(confirm).toBeDisabled()

    // Nova confirmação explícita com os valores atualizados
    await page.getByRole('button', { name: 'Revisar novos valores' }).click()
    await expect(page.getByTestId('review').getByTestId('summary-total')).toHaveText('1.816 ETH')
    await expect(confirm).toBeEnabled()
    await confirm.click()
    await expect(page.getByTestId('order-confirmed')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('receipt-total')).toHaveText('1.816 ETH')
  })

  test('edição esgotada no envio exige revisão (API recusa a cotação antiga)', async ({ page }) => {
    await signedIn(page, '/', 'sold-out')
    await addFromDetail(page, 'emerald-ape-042', { edition: '1/50' })
    await page.goto('/pagamento')
    await reviewCheckout(page)
    await page.getByTestId('confirm-purchase').click()
    await expect(page.getByTestId('quote-changed')).toBeVisible()
    await expect(page.getByTestId('quote-changed')).toContainText('esgotou')
    expect(await mock<number>(page, 'orderCount')).toBe(0)
  })

  test('preço alterado no envio exige nova confirmação', async ({ page }) => {
    await signedIn(page, '/', 'price-changed')
    await addFromDetail(page, 'emerald-ape-042', { edition: '1/50' })
    await page.goto('/pagamento')
    await reviewCheckout(page)
    await page.getByTestId('confirm-purchase').click()
    await expect(page.getByTestId('quote-changed')).toBeVisible()
    await page.getByRole('button', { name: 'Revisar novos valores' }).click()
    await page.getByTestId('confirm-purchase').click()
    await expect(page.getByTestId('order-confirmed')).toBeVisible({ timeout: 10_000 })
    expect(await mock<number>(page, 'orderCount')).toBe(1)
  })
})
