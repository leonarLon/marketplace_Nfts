import { z } from 'zod'
import {
  favoritesResponseSchema,
  sessionSchema,
  userSchema,
  walletConnectionSchema,
  walletSchema,
  walletsResponseSchema,
  type AvatarUpdate,
  type ChangePasswordRequest,
  type LoginRequest,
  type ProfileUpdate,
  type RegisterRequest,
  type WalletInput,
  type WalletSlot,
} from '@/contracts/account'
import type { Network } from '@/contracts/common'
import { request } from './http'

const ok = z.object({ ok: z.literal(true) })

export const authApi = {
  register: ({ confirmPassword: _c, ...body }: RegisterRequest) =>
    request(sessionSchema, { url: '/auth/register', method: 'POST', data: body }),
  login: (body: LoginRequest) => request(sessionSchema, { url: '/auth/login', method: 'POST', data: body }),
  session: (signal?: AbortSignal) => request(sessionSchema, { url: '/auth/session', signal }),
  logout: () => request(ok, { url: '/auth/logout', method: 'POST' }),
}

export const profileApi = {
  get: (signal?: AbortSignal) => request(userSchema, { url: '/profile', signal }),
  update: (body: ProfileUpdate) => request(userSchema, { url: '/profile', method: 'PATCH', data: body }),
  updateAvatar: (body: AvatarUpdate) => request(userSchema, { url: '/profile/avatar', method: 'PUT', data: body }),
  changePassword: ({ confirmPassword: _c, ...body }: ChangePasswordRequest) =>
    request(ok, { url: '/profile/password', method: 'POST', data: body }),
}

export const walletsApi = {
  get: (signal?: AbortSignal) => request(walletsResponseSchema, { url: '/wallets', signal }),
  save: (slot: WalletSlot, body: WalletInput) =>
    request(walletSchema, { url: `/wallets/${slot}`, method: 'PUT', data: body }),
  remove: (slot: WalletSlot) => request(ok, { url: `/wallets/${slot}`, method: 'DELETE' }),
  connection: (signal?: AbortSignal) =>
    request(walletConnectionSchema.nullable(), { url: '/wallets/connection', signal }),
  /** Simula a aprovação da conexão na extensão da carteira (pode ser recusada). */
  connect: (walletId: string, network: Network) =>
    request(walletConnectionSchema, { url: '/wallets/connection', method: 'POST', data: { walletId, network } }),
  disconnect: () => request(ok, { url: '/wallets/connection', method: 'DELETE' }),
}

export const favoritesApi = {
  list: (signal?: AbortSignal) => request(favoritesResponseSchema, { url: '/favorites', signal }),
  add: (nftId: string) =>
    request(favoritesResponseSchema, { url: `/favorites/${encodeURIComponent(nftId)}`, method: 'PUT' }),
  remove: (nftId: string) =>
    request(favoritesResponseSchema, { url: `/favorites/${encodeURIComponent(nftId)}`, method: 'DELETE' }),
}
