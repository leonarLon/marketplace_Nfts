import { expect, mock, open, test } from './support/fixtures'

const names = (page: import('@playwright/test').Page) => page.getByTestId('catalog-grid').getByRole('heading', { level: 3 })

test.describe('1. Catálogo, busca, filtros, ordenação, paginação e histórico', () => {
  test('filtros combinados e ordenação refletem na URL, reiniciam a página e sobrevivem ao refresh', async ({ page }) => {
    await open(page, '/')
    const grid = page.getByTestId('catalog-grid')
    await expect(grid.getByTestId('nft-card')).toHaveCount(9)

    // Paginação
    await page.getByRole('link', { name: 'Página 2' }).click()
    await expect(page).toHaveURL(/page=2/)
    await expect(page.getByRole('link', { name: 'Página 2' })).toHaveAttribute('aria-current', 'page')

    // Filtro combinável → reinicia a paginação
    const filters = page.getByRole('complementary', { name: 'Filtros' }).filter({ visible: true })
    const openFilters = page.getByRole('button', { name: 'Filtros', exact: true })
    const scope = (await openFilters.isVisible()) ? page.getByRole('dialog', { name: 'Filtros' }) : filters
    if (await openFilters.isVisible()) await openFilters.click()
    await scope.getByRole('button', { name: /^Música/ }).click()
    await expect(page).not.toHaveURL(/page=/)
    await expect(page).toHaveURL(/category=musica/)
    await scope.getByRole('button', { name: /^Polygon/ }).click()
    await expect(page).toHaveURL(/network=polygon/)
    if (await page.getByRole('dialog', { name: 'Filtros' }).isVisible()) await page.keyboard.press('Escape')

    // Resultado esperado calculado a partir do estado do backend simulado
    type Nft = { name: string; category: string; network: string; listedAt: string }
    const db = await mock<{ nfts: Record<string, Nft> }>(page, 'snapshot')
    const expected = Object.values(db.nfts)
      .filter((n) => n.category === 'musica' && n.network === 'polygon')
      .sort((a, b) => Date.parse(b.listedAt) - Date.parse(a.listedAt))
      .map((n) => n.name)
    expect(expected.length).toBeGreaterThan(0)
    await expect(names(page)).toHaveText(expected.slice(0, 9))

    // Ordenação (no mobile fica dentro do drawer de filtros)
    const mobile = await openFilters.isVisible()
    if (mobile) await openFilters.click()
    const sortScope = mobile ? page.getByRole('dialog', { name: 'Filtros' }) : page
    await sortScope.getByRole('combobox', { name: 'Ordenar por' }).click()
    await page.getByRole('option', { name: 'Maior preço' }).click()
    await expect(page).toHaveURL(/sort=price-desc/)
    if (mobile) await page.keyboard.press('Escape')
    const prices = (await page.getByTestId('catalog-grid').locator('p.font-bold').allTextContents()).map((t) => Number(t.replace(/[^\d.]/g, '').slice(0, 5)))
    expect([...prices].sort((a, b) => b - a)).toEqual(prices)

    // Refresh mantém o estado
    const url = page.url()
    await page.reload()
    expect(page.url()).toBe(url)
    if (mobile) await openFilters.click()
    await expect(sortScope.getByRole('combobox', { name: 'Ordenar por' })).toContainText('Maior preço')
    if (mobile) await page.keyboard.press('Escape')

    // Voltar/avançar restauram
    await page.goBack()
    await expect(page).not.toHaveURL(/sort=/)
    await expect(page).toHaveURL(/network=polygon/)
    await page.goBack()
    await expect(page).not.toHaveURL(/network=/)
    await page.goForward()
    await expect(page).toHaveURL(/network=polygon/)
  })

  test('busca pela URL e resultado vazio', async ({ page }) => {
    await open(page, '/?q=nomad')
    await expect(names(page)).toHaveText(['Sage Nomad #009', 'Violet Nomad #314'])
    await page.goto('/?q=inexistente-xyz')
    await expect(page.getByTestId('catalog-empty')).toBeVisible()
    await page.getByRole('button', { name: 'Limpar busca e filtros' }).click()
    await expect(page.getByTestId('nft-card').first()).toBeVisible()
  })

  test('@desktop busca pelo cabeçalho e abas', async ({ page }) => {
    await open(page, '/')
    await page.getByRole('button', { name: 'Buscar NFTs' }).click()
    await page.getByRole('textbox', { name: 'Termo de busca' }).fill('nomad')
    await page.getByRole('button', { name: 'Buscar', exact: true }).click()
    await expect(page).toHaveURL(/q=nomad/)
    await expect(names(page)).toHaveText(['Sage Nomad #009', 'Violet Nomad #314'])
    await page.getByRole('button', { name: 'Em alta' }).click()
    await expect(page).toHaveURL(/tab=trending/)
  })

  test('respostas fora de ordem não sobrescrevem a consulta atual', async ({ page }) => {
    // Cenário: listagens alternam lenta (1,5 s) / rápida (150 ms).
    await open(page, '/', 'out-of-order') // 1ª: lenta
    await expect(page.getByTestId('nft-card').first()).toBeVisible()
    await page.getByRole('button', { name: 'Em alta' }).click() // 2ª: rápida
    await expect(page).toHaveURL(/tab=trending/)
    // Em alta = popularidade ≥ 75 (6 NFTs nas fixtures)
    await expect(names(page)).toHaveCount(6)
    const trending = await names(page).allTextContents()
    expect(trending).not.toContain('Golden Beat #207')

    await page.getByRole('button', { name: 'Novos lançamentos' }).click() // 3ª: lenta, fica em voo
    await page.getByRole('button', { name: 'Em alta' }).click() // volta à consulta atual
    await expect(names(page)).toHaveText(trending)
    await page.waitForTimeout(1_800) // a resposta lenta de "novos" chega agora e deve ser descartada
    await expect(page).toHaveURL(/tab=trending/)
    await expect(names(page)).toHaveText(trending)
  })

  test('filtro de preço', async ({ page }) => {
    await open(page, '/?priceMin=1.00&priceMax=1.50')
    await expect(page.getByTestId('nft-card').first()).toBeVisible()
    const texts = await page.getByTestId('catalog-grid').locator('p.font-bold').allTextContents()
    expect(texts.length).toBeGreaterThan(0)
    for (const t of texts) {
      const v = Number(t.match(/[\d.]+/)![0])
      expect(v).toBeGreaterThanOrEqual(1)
      expect(v).toBeLessThanOrEqual(1.5)
    }
    await expect(page.getByRole('button', { name: /Remover filtro Preço/ })).toBeVisible()
  })
})
