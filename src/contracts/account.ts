import { z } from 'zod'
import { isoDate, networkSchema, walletProviderSchema } from './common'

export const userSchema = z.object({
  id: z.string(),
  username: z.string(),
  displayName: z.string(),
  email: z.string(),
  ensName: z.string().nullable(),
  walletNickname: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  updatedAt: isoDate,
})
export type User = z.infer<typeof userSchema>

export const sessionSchema = z.object({
  token: z.string(),
  expiresAt: isoDate,
  user: userSchema,
})
export type Session = z.infer<typeof sessionSchema>

export const loginRequestSchema = z.object({
  email: z.email('Informe um e-mail válido'),
  password: z.string().min(1, 'Informe sua senha'),
})
export type LoginRequest = z.infer<typeof loginRequestSchema>

export const passwordRule = z
  .string()
  .min(8, 'A senha deve ter ao menos 8 caracteres')
  .regex(/[A-Za-z]/, 'A senha deve conter letras')
  .regex(/\d/, 'A senha deve conter números')

export const usernameRule = z
  .string()
  .min(3, 'O nome de usuário deve ter ao menos 3 caracteres')
  .max(24, 'O nome de usuário deve ter no máximo 24 caracteres')
  .regex(/^[a-z0-9_.]+$/i, 'Use apenas letras, números, ponto e sublinhado')

export const registerRequestSchema = z
  .object({
    username: usernameRule,
    email: z.email('Informe um e-mail válido'),
    password: passwordRule,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não conferem',
  })
export type RegisterRequest = z.infer<typeof registerRequestSchema>

export const ensRule = z
  .string()
  .regex(/^[a-z0-9-]{3,32}$/i, 'Use de 3 a 32 letras, números ou hífen')

export const profileUpdateSchema = z.object({
  displayName: z.string().trim().min(2, 'Informe o nome de exibição'),
  username: usernameRule,
  email: z.email('Informe um e-mail válido'),
  ensName: ensRule,
  walletNickname: z.string().trim().min(2, 'Informe o apelido da carteira'),
})
export type ProfileUpdate = z.infer<typeof profileUpdateSchema>

export const avatarUpdateSchema = z.object({
  /** Data URL de imagem (png/jpeg/webp) com até ~512 KB. */
  dataUrl: z.string().regex(/^data:image\/(png|jpeg|webp);base64,/, 'Formato de imagem inválido').nullable(),
})
export type AvatarUpdate = z.infer<typeof avatarUpdateSchema>

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Informe a senha atual'),
    newPassword: passwordRule,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não conferem',
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ['newPassword'],
    message: 'A nova senha deve ser diferente da atual',
  })
export type ChangePasswordRequest = z.infer<typeof changePasswordSchema>

export const WALLET_SLOTS = ['primary', 'secondary'] as const
export const walletSlotSchema = z.enum(WALLET_SLOTS)
export type WalletSlot = z.infer<typeof walletSlotSchema>

const ethAddress = z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Endereço deve ter 0x seguido de 40 caracteres hexadecimais')

export const walletInputSchema = z.object({
  displayName: z.string().trim().min(2, 'Informe o nome de exibição'),
  nickname: z.string().trim().min(2, 'Informe o apelido da carteira'),
  network: networkSchema,
  profileName: z.string().trim().min(2, 'Informe o nome do perfil'),
  address: ethAddress,
  secondaryAddress: z.union([ethAddress, z.literal('')]),
  provider: walletProviderSchema,
  referralCode: z.string().trim().regex(/^[A-Z0-9]{4,12}$/i, 'Código de 4 a 12 letras ou números'),
  email: z.email('Informe um e-mail válido'),
  ensName: ensRule,
})
export type WalletInput = z.infer<typeof walletInputSchema>

export const walletSchema = walletInputSchema.extend({
  id: z.string(),
  slot: walletSlotSchema,
  updatedAt: isoDate,
})
export type Wallet = z.infer<typeof walletSchema>

export const walletsResponseSchema = z.object({
  primary: walletSchema.nullable(),
  secondary: walletSchema.nullable(),
})
export type WalletsResponse = z.infer<typeof walletsResponseSchema>

export const favoritesResponseSchema = z.object({ nftIds: z.array(z.string()) })
export type FavoritesResponse = z.infer<typeof favoritesResponseSchema>

export const walletConnectionSchema = z.object({
  walletId: z.string(),
  network: networkSchema,
  address: z.string(),
  connectedAt: isoDate,
})
export type WalletConnection = z.infer<typeof walletConnectionSchema>
