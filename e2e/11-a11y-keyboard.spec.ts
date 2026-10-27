import { expect, open, test } from './support/fixtures'

test.describe('11. Teclado, foco de diálogos e validação de formulários', () => {
  test('link de pular conteúdo e navegação por teclado até o NFT', async ({ page }) => {
    await open(page, '/')
    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: 'Pular para o conteúdo' })
    await expect(skip).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.locator('#conteudo')).toBeFocused()

    // Tab até o primeiro card do catálogo e Enter abre o detalhe
    const firstCard = page.getByTestId('catalog-grid').getByRole('link', { name: 'Emerald Ape #042' })
    for (let i = 0; i < 60 && !(await firstCard.evaluate((el) => el === document.activeElement)); i += 1) await page.keyboard.press('Tab')
    await expect(firstCard).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/nft\/emerald-ape-042/)
  })

  test('@desktop diálogo de busca prende o foco e o devolve ao fechar com Esc', async ({ page }) => {
    await open(page, '/')
    const trigger = page.getByRole('button', { name: 'Buscar NFTs' })
    await trigger.focus()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog', { name: 'Buscar NFTs' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('textbox', { name: 'Termo de busca' })).toBeFocused()
    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press('Tab')
      expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true)
    }
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()
  })

  test('drawer de filtros (mobile) controla o foco', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile', 'drawer só existe abaixo de lg')
    await open(page, '/')
    await page.getByRole('button', { name: 'Filtros' }).click()
    const drawer = page.getByRole('dialog', { name: 'Filtros' })
    await expect(drawer).toBeVisible()
    for (let i = 0; i < 5; i += 1) {
      await page.keyboard.press('Tab')
      expect(await drawer.evaluate((el) => el.contains(document.activeElement))).toBe(true)
    }
    await page.keyboard.press('Escape')
    await expect(drawer).toBeHidden()
    await expect(page.getByRole('button', { name: 'Filtros' })).toBeFocused()
  })

  test('Tab Bar (mobile): destinos, item ativo, sessão e atalho de busca', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile', 'Tab Bar só existe no mobile')
    await open(page, '/')
    const bar = page.getByRole('navigation', { name: 'Navegação inferior' })
    await expect(bar).toBeVisible()
    // Home mobile sem cabeçalho, como no frame "Mobile / Início".
    await expect(page.getByRole('navigation', { name: 'Principal' })).toBeHidden()
    await expect(bar.getByRole('link', { name: 'Início' })).toHaveAttribute('aria-current', 'page')

    // Atalho central foca a busca do catálogo
    await bar.getByRole('button', { name: 'Explorar coleções' }).click()
    await expect(page.locator('#catalog-search')).toBeFocused()

    // Visitante: item de conta leva ao login; após entrar, indica a conta
    await bar.getByRole('link', { name: 'Entrar' }).click()
    await expect(page).toHaveURL(/\/entrar/)
    await page.getByPlaceholder('contato@email.com').fill('ana@kurio.test')
    await page.getByPlaceholder('Senha', { exact: true }).fill('Kurio2026')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).toHaveURL(/\/$/)
    await bar.getByRole('link', { name: /^Conta de / }).click()
    await expect(page).toHaveURL(/\/perfil$/)
    await expect(bar.getByRole('link', { name: /^Conta de / })).toHaveAttribute('aria-current', 'page')
    await bar.getByRole('link', { name: 'Favoritos' }).click()
    await expect(page).toHaveURL(/\/perfil\/favoritos$/)
    await bar.getByRole('link', { name: /^Carrinho/ }).click()
    await expect(page).toHaveURL(/\/carrinho$/)
    await expect(bar).toBeHidden()
  })

  test('validação do login: erros associados aos campos e foco no primeiro inválido', async ({ page }) => {
    await open(page, '/entrar')
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: 'Entrar', exact: true }).click()
    const email = dialog.getByPlaceholder('contato@email.com')
    await expect(email).toBeFocused()
    await expect(email).toHaveAttribute('aria-invalid', 'true')
    await expect(email).toHaveAccessibleDescription('Informe um e-mail válido')
    await email.fill('ana@kurio.test')
    await page.keyboard.press('Tab')
    await expect(email).not.toHaveAttribute('aria-invalid', 'true')
    await dialog.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(dialog.getByPlaceholder('Senha', { exact: true })).toHaveAccessibleDescription('Informe sua senha')
  })

  test('sem overflow horizontal', async ({ page }) => {
    for (const path of ['/', '/nft/emerald-ape-042', '/carrinho', '/entrar']) {
      await open(page, path)
      await page.waitForLoadState('networkidle')
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow, path).toBeLessThanOrEqual(0)
    }
  })
})
