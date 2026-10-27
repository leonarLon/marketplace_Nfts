import { expect, mock, open, realtimeConnected, test } from './support/fixtures'

test('a aplicação inicia com MSW e conecta o Socket.IO simulado', async ({ page }) => {
  await open(page, '/')
  // Desktop: herói amplo; mobile: banner em card (frame "Mobile / Início").
  await expect(page.getByRole('heading', { level: 1, name: /seja dono d(o futuro|a cultura digital)/i })).toBeVisible()
  await expect(page.getByTestId('nft-card').first()).toBeVisible()
  await realtimeConnected(page)
  expect(await mock<number>(page, 'connectionCount')).toBeGreaterThan(0)
})
