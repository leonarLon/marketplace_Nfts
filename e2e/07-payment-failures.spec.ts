import { expect, mock, test } from './support/fixtures'
import { addFromDetail, reviewCheckout, signedIn } from './support/flows'

test.describe('7. Falha de pagamento, clique repetido e timeout com idempotência', () => {
  test('pagamento recusado preserva os itens e não mostra confirmação', async ({ page }) => {
    await signedIn(page, '/', 'payment-declined')
    await addFromDetail(page, 'emerald-ape-042', { edition: '1/50' })
    await page.goto('/pagamento')
    await reviewCheckout(page)
    await page.getByTestId('confirm-purchase').click()
    await expect(page.getByTestId('order-pending')).toBeVisible()
    await expect(page.getByTestId('order-declined')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('order-confirmed')).toHaveCount(0)
    await page.goto('/carrinho')
    await expect(page.getByTestId('cart-item').filter({ visible: true })).toHaveCount(1)
  })

  test('clique repetido cria um único pedido', async ({ page }) => {
    await signedIn(page, '/')
    await addFromDetail(page, 'emerald-ape-042', { edition: '1/50' })
    await page.goto('/pagamento')
    await reviewCheckout(page)
    const confirm = page.getByTestId('confirm-purchase')
    await confirm.dblclick()
    await confirm.click({ force: true }).catch(() => undefined)
    await expect(page).toHaveURL(/\/pedido\/ord_/)
    expect(await mock<number>(page, 'orderCount')).toBe(1)
  })

  test('timeout após a criação recupera o mesmo pedido pela chave de idempotência', async ({ page }) => {
    test.setTimeout(60_000)
    await signedIn(page, '/', 'order-timeout')
    await addFromDetail(page, 'emerald-ape-042', { edition: '1/50' })
    await page.goto('/pagamento')
    await reviewCheckout(page)

    const keys: string[] = []
    page.on('request', (r) => {
      if (r.url().endsWith('/api/orders') && r.method() === 'POST') keys.push(r.headers()['idempotency-key'] ?? '')
    })
    await page.getByTestId('confirm-purchase').click()
    await expect(page.getByText(/Reenviando a mesma tentativa/)).toBeVisible({ timeout: 15_000 })
    await expect(page).toHaveURL(/\/pedido\/ord_/, { timeout: 20_000 })
    await expect(page.getByTestId('order-confirmed')).toBeVisible({ timeout: 10_000 })

    expect(keys.length).toBeGreaterThanOrEqual(2)
    expect(new Set(keys).size).toBe(1)
    expect(await mock<number>(page, 'orderCount')).toBe(1)
  })

  test('a mesma chave com outro conteúdo gera conflito na API', async ({ page }) => {
    await signedIn(page, '/')
    const token = await page.evaluate(() => JSON.parse(localStorage.getItem('kurio:session')!).token as string)
    const result = await page.evaluate(async (t) => {
      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${t}`, 'Idempotency-Key': 'chave-fixa' }
      await fetch('/api/cart/items', { method: 'POST', headers, body: JSON.stringify({ nftId: 'emerald-ape-042', editionId: 'emerald-ape-042--1-50', quantity: 1 }) })
      await fetch('/api/wallets/connection', { method: 'POST', headers, body: JSON.stringify({ walletId: 'wal_ana_primary', network: 'ethereum' }) })
      const buyer = { displayName: 'Ana Lima', username: 'ana.lima', profileName: 'analima', email: 'ana@kurio.test', referralCode: 'KURIO01', ensName: 'analima', note: '' }
      const q1 = await (await fetch('/api/quotes', { method: 'POST', headers, body: JSON.stringify({ network: 'ethereum' }) })).json()
      const first = await fetch('/api/orders', { method: 'POST', headers, body: JSON.stringify({ quoteId: q1.id, walletId: 'wal_ana_primary', network: 'ethereum', buyer }) })
      const replay = await fetch('/api/orders', { method: 'POST', headers, body: JSON.stringify({ quoteId: q1.id, walletId: 'wal_ana_primary', network: 'ethereum', buyer }) })
      const conflict = await fetch('/api/orders', { method: 'POST', headers, body: JSON.stringify({ quoteId: q1.id, walletId: 'wal_ana_primary', network: 'ethereum', buyer: { ...buyer, note: 'outro' } }) })
      return { first: first.status, replay: replay.status, replayed: replay.headers.get('Idempotent-Replay'), sameId: (await first.clone().json()).id === (await replay.json()).id, conflict: conflict.status, code: (await conflict.json()).error.code }
    }, token)
    expect(result).toEqual({ first: 201, replay: 200, replayed: 'true', sameId: true, conflict: 409, code: 'IDEMPOTENCY_CONFLICT' })
  })
})

test.describe('7b. Carteira', () => {
  test('conexão recusada na carteira é informada e permite nova tentativa', async ({ page }) => {
    await signedIn(page, '/', 'wallet-rejected')
    await addFromDetail(page, 'emerald-ape-042', { edition: '1/50' })
    await page.goto('/pagamento')
    await page.getByRole('button', { name: 'Conectar MetaMask' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Conexão recusada na carteira' })).toBeVisible()
    await expect(page.getByText(/Conectada em/)).toHaveCount(0)
    await mock(page, 'setScenario', 'default')
    await page.getByRole('button', { name: 'Conectar MetaMask' }).click()
    await expect(page.getByText('Conectada em Ethereum')).toBeVisible()
    await page.getByRole('button', { name: 'Desconectar' }).click()
    await expect(page.getByRole('button', { name: 'Conectar MetaMask' })).toBeVisible()
  })
})
