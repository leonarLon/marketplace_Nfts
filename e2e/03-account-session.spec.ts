import { accountIndicator, expect, login, mock, open, signedOutIndicator, test, USERS } from './support/fixtures'
import { addFromDetail, signedIn } from './support/flows'

test.describe('3. Cadastro, login, expiração, logout e troca de usuário', () => {
  test('cadastro com conflito e depois com sucesso', async ({ page }) => {
    await open(page, '/cadastro')
    await page.getByPlaceholder('Nome de usuário').fill('ana.lima')
    await page.getByPlaceholder('Digite seu e-mail', { exact: true }).fill('ana@kurio.test')
    await page.getByPlaceholder('Senha', { exact: true }).fill('Segura123')
    await page.getByPlaceholder('Confirmar senha').fill('Segura123')
    await page.getByRole('button', { name: 'Criar conta' }).click()
    await expect(page.getByText('Este e-mail já está cadastrado')).toBeVisible()
    await expect(page.getByPlaceholder('Digite seu e-mail', { exact: true })).toHaveAttribute('aria-invalid', 'true')

    await page.getByPlaceholder('Digite seu e-mail', { exact: true }).fill('nova@kurio.test')
    await page.getByRole('button', { name: 'Criar conta' }).click()
    await expect(page.getByText('Este nome de usuário já está em uso')).toBeVisible()

    await page.getByPlaceholder('Nome de usuário').fill('nova.colecionadora')
    await page.getByRole('button', { name: 'Criar conta' }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(accountIndicator(page, /Conta de nova.colecionadora/)).toBeVisible()
  })

  test('login inválido, login com retorno ao fluxo anterior e sessão após refresh', async ({ page }) => {
    await open(page, '/perfil')
    await expect(page).toHaveURL(/\/entrar\?redirect=%2Fperfil/)
    await page.getByPlaceholder('contato@email.com').fill(USERS.ana.email)
    await page.getByPlaceholder('Senha', { exact: true }).fill('errada123')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'E-mail ou senha incorretos' })).toBeVisible()
    await login(page)
    await expect(page).toHaveURL(/\/perfil$/)
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Perfil do colecionador' })).toBeVisible()
  })

  test('expiração durante a navegação preserva o contexto após novo login', async ({ page }) => {
    await signedIn(page, '/perfil')
    await page.getByLabel('Nome de exibição').fill('Ana Rascunho')
    await mock(page, 'expireSessions')
    await page.getByRole('button', { name: 'Salvar' }).click()
    const dialog = page.getByRole('dialog', { name: 'Sua sessão expirou' })
    await expect(dialog).toBeVisible()
    await dialog.getByPlaceholder('Senha', { exact: true }).fill(USERS.ana.password)
    await dialog.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(dialog).toBeHidden()
    await expect(page).toHaveURL(/\/perfil$/)
    await expect(page.getByLabel('Nome de exibição')).toHaveValue('Ana Rascunho')
  })

  test('logout e troca de usuário não vazam dados privados', async ({ page }) => {
    await signedIn(page, '/perfil/favoritos')
    await expect(page.getByTestId('favorites-grid').getByText('Ivory Baron #088')).toBeVisible()

    await page.getByRole('button', { name: 'Sair' }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(signedOutIndicator(page)).toBeVisible()

    await page.goto('/entrar?redirect=%2Fperfil%2Ffavoritos')
    await login(page, USERS.bruno)
    await expect(page).toHaveURL(/\/perfil\/favoritos$/)
    const grid = page.getByTestId('favorites-grid')
    await expect(grid.getByText('Golden Beat #207')).toBeVisible()
    await expect(grid.getByText('Ivory Baron #088')).toHaveCount(0)
    await page.goto('/perfil')
    await expect(page.locator('#email')).toHaveValue(USERS.bruno.email)
  })
})

test.describe('3b. Expiração durante o checkout', () => {
  test('reautenticar no checkout mantém o formulário preenchido e permite concluir', async ({ page }) => {
    await signedIn(page, '/')
    await addFromDetail(page, 'emerald-ape-042', { edition: '1/50' })
    await page.goto('/pagamento')
    await page.locator('#note').fill('Entregar na carteira principal')
    await mock(page, 'expireSessions')
    // Qualquer requisição autenticada revela a expiração (pode ser uma em segundo plano).
    await page.getByRole('button', { name: 'Conectar MetaMask' }).click({ timeout: 3_000 }).catch(() => undefined)
    const dialog = page.getByRole('dialog', { name: 'Sua sessão expirou' })
    await expect(dialog).toBeVisible()
    await dialog.getByPlaceholder('Senha', { exact: true }).fill(USERS.ana.password)
    await dialog.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(dialog).toBeHidden()
    await expect(page).toHaveURL(/\/pagamento$/)
    await expect(page.locator('#note')).toHaveValue('Entregar na carteira principal')
    await page.reload()
    await expect(page.locator('#note')).toHaveValue('Entregar na carteira principal')
  })
})
