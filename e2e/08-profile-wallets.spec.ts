import { accountIndicator, expect, login, logout, test, USERS } from './support/fixtures'
import { signedIn } from './support/flows'

// PNG 1×1 válido
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')

test.describe('8. Perfil, avatar, senha e carteiras', () => {
  test('edição do perfil com erros de validação e da API, avatar e persistência', async ({ page }) => {
    await signedIn(page, '/perfil')
    const username = page.getByLabel('Nome de usuário')
    await username.fill('a')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('O nome de usuário deve ter ao menos 3 caracteres')).toBeVisible()
    await expect(username).toBeFocused()
    await expect(username).toHaveAttribute('aria-describedby', 'username-error')

    await username.fill('bruno.costa')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Este nome de usuário já está em uso')).toBeVisible()

    await username.fill('ana.colecionadora')
    await page.getByLabel('Nome de exibição').fill('Ana L.')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Perfil atualizado.')).toBeVisible()

    await page.locator('input[type="file"]').setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: PNG })
    await expect(page.getByRole('img', { name: 'Seu avatar' })).toBeVisible()

    await page.reload()
    await expect(page.getByLabel('Nome de usuário')).toHaveValue('ana.colecionadora')
    await expect(page.getByRole('img', { name: 'Seu avatar' })).toBeVisible()
    await expect(accountIndicator(page, 'Ana L.')).toBeVisible()
  })

  test('alteração de senha valida a senha atual e passa a valer no login', async ({ page }) => {
    await signedIn(page, '/perfil')
    await page.getByLabel('Senha atual').fill('errada000')
    await page.getByLabel('Nova senha', { exact: true }).fill('NovaSenha9')
    await page.getByLabel('Confirmar nova senha').fill('NovaSenha9')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Senha atual incorreta')).toBeVisible()

    await page.getByLabel('Senha atual').fill(USERS.ana.password)
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Senha alterada com sucesso.')).toBeVisible()

    await logout(page)
    await page.goto('/entrar')
    await login(page, { ...USERS.ana, password: 'NovaSenha9' })
    await expect(accountIndicator(page, /Conta de Ana/)).toBeVisible()
  })

  test('carteiras: validação, cadastro da secundária e persistência', async ({ page }) => {
    await signedIn(page, '/perfil/carteiras')
    await expect(page.getByRole('heading', { name: 'Carteira principal' })).toBeVisible()
    await expect(page.getByLabel('Endereço da carteira').first()).toHaveValue('0xA91F3c2B7d4E5f6A8b9C0d1E2f3A4b5C6d7EE82C')

    await page.getByRole('button', { name: 'Adicionar' }).click()
    const secondary = page.getByRole('form', { name: 'Carteira secundária' })
    await secondary.getByLabel('Apelido da carteira').fill('Reserva')
    await secondary.getByLabel('Nome do perfil').fill('analima')
    await secondary.getByLabel('Endereço da carteira').fill('0x123')
    await secondary.getByLabel('Código de indicação').fill('KURIO01')
    await secondary.getByLabel('Nome ENS').fill('analima')
    await secondary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(secondary.getByText('Endereço deve ter 0x seguido de 40 caracteres hexadecimais')).toBeVisible()
    await expect(secondary.getByLabel('Endereço da carteira')).toBeFocused()

    await secondary.getByLabel('Endereço da carteira').fill('0x1111111111111111111111111111111111111111')
    await secondary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(page.getByText('Carteira secundária salva.')).toBeVisible()

    await page.reload()
    await expect(page.getByRole('form', { name: 'Carteira secundária' }).getByLabel('Endereço da carteira')).toHaveValue('0x1111111111111111111111111111111111111111')
  })
})
