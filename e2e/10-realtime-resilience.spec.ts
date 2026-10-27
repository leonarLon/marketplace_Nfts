import { expect, login, logout, mock, open, realtimeConnected, test, USERS } from './support/fixtures'
import { addFromDetail, reviewCheckout, signedIn } from './support/flows'

const price = (page: import('@playwright/test').Page) => page.getByTestId('detail-price')

test.describe('10. Eventos duplicados/antigos, desconexão e retomada de pedido pendente', () => {
  test('@desktop duplicatas e eventos antigos não regridem o estado', async ({ page }) => {
    await open(page, '/nft/emerald-ape-042')
    await realtimeConnected(page)
    await expect(price(page)).toContainText('1.19 ETH')

    await mock(page, 'updateNft', 'emerald-ape-042', { price: '2.00' })
    await expect(price(page)).toContainText('2.00 ETH')

    // Duplicata exata (mesmo eventId/versão) e evento atrasado com versão anterior
    await mock(page, 'replayLastEvent')
    await mock(page, 'emitStaleNftEvent', 'emerald-ape-042', '0.50')
    await page.waitForTimeout(500)
    await expect(price(page)).toContainText('2.00 ETH')
    await expect(price(page)).not.toContainText('0.50')
  })

  test('reconexão reconcilia com a API REST', async ({ page }) => {
    await open(page, '/nft/emerald-ape-042')
    await realtimeConnected(page)
    await mock(page, 'setRealtimeOffline', true)
    await expect(page.getByTestId('realtime-status')).toHaveAttribute('data-status', 'reconnecting')
    await expect(page.getByTestId('realtime-status')).toContainText('interrompida')

    // Mudança enquanto offline: nenhum evento chega
    await page.evaluate(() => {
      const w = window as unknown as { __kurioMock: { updateNft: (id: string, p: unknown) => void } }
      w.__kurioMock.updateNft('emerald-ape-042', { price: '3.33' })
    })
    await mock(page, 'setRealtimeOffline', false)
    await realtimeConnected(page)
    await expect(page.getByTestId('realtime-status')).toContainText('restabelecida')
    await expect(page.getByText('3.33 ETH').filter({ visible: true }).first()).toBeVisible()
  })

  test('pedido pendente sobrevive à queda de conexão e ao refresh sem nova compra', async ({ page }) => {
    await signedIn(page, '/', 'order-hold')
    await addFromDetail(page, 'emerald-ape-042', { edition: '1/50' })
    await page.goto('/pagamento')
    await reviewCheckout(page)
    await page.getByTestId('confirm-purchase').click()
    await expect(page.getByTestId('order-pending')).toBeVisible()
    const orderUrl = page.url()

    // Queda do socket enquanto pendente
    await mock(page, 'setRealtimeOffline', true)
    const [orderId] = await mock<string[]>(page, 'pendingOrders')
    await mock(page, 'settleOrder', orderId, 'confirmed')
    await mock(page, 'setRealtimeOffline', false)
    await expect(page.getByTestId('order-confirmed')).toBeVisible({ timeout: 10_000 })

    // Refresh mantém o estado terminal e não cria outro pedido
    await page.reload()
    expect(page.url()).toBe(orderUrl)
    await expect(page.getByTestId('order-confirmed')).toBeVisible()
    expect(await mock<number>(page, 'orderCount')).toBe(1)
  })

  test('refresh durante o pendente recupera o estado; outro usuário não acessa o pedido', async ({ page }) => {
    await signedIn(page, '/', 'order-hold')
    await addFromDetail(page, 'emerald-ape-042', { edition: '1/50' })
    await page.goto('/pagamento')
    await reviewCheckout(page)
    await page.getByTestId('confirm-purchase').click()
    await expect(page.getByTestId('order-pending')).toBeVisible()
    await page.reload()
    await expect(page.getByTestId('order-pending')).toBeVisible()
    const orderPath = new URL(page.url()).pathname
    const [orderId] = await mock<string[]>(page, 'pendingOrders')

    // Troca de usuário: Bruno não vê o pedido de Ana nem recebe o evento dele
    await page.goto('/perfil')
    await logout(page)
    await page.goto(`/entrar?redirect=${encodeURIComponent(orderPath)}`)
    await login(page, USERS.bruno)
    await expect(page.getByRole('heading', { name: 'Pedido não encontrado' })).toBeVisible()
    await mock(page, 'settleOrder', orderId, 'declined')
    await page.waitForTimeout(500)
    await expect(page.getByTestId('order-declined')).toHaveCount(0)
    expect(await mock<number>(page, 'orderCount')).toBe(1)
  })
})
