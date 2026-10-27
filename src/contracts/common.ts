import { z } from 'zod'
import { isEthString } from '@/lib/money'

export const ethString = z.string().refine(isEthString, 'Valor ETH deve ser string decimal')

export const isoDate = z.string()

export const NETWORKS = ['ethereum', 'polygon', 'solana'] as const
export const networkSchema = z.enum(NETWORKS)
export type Network = z.infer<typeof networkSchema>

export const NETWORK_LABEL: Record<Network, string> = {
  ethereum: 'Ethereum',
  polygon: 'Polygon',
  solana: 'Solana',
}

export const WALLET_PROVIDERS = ['metamask', 'walletconnect', 'coinbase'] as const
export const walletProviderSchema = z.enum(WALLET_PROVIDERS)
export type WalletProvider = z.infer<typeof walletProviderSchema>

export const WALLET_PROVIDER_LABEL: Record<WalletProvider, string> = {
  metamask: 'MetaMask',
  walletconnect: 'WalletConnect',
  coinbase: 'Coinbase Wallet',
}

export const API_ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'SESSION_EXPIRED',
  'FORBIDDEN',
  'NOT_FOUND',
  'EMAIL_TAKEN',
  'USERNAME_TAKEN',
  'INVALID_CREDENTIALS',
  'INVALID_PASSWORD',
  'OUT_OF_STOCK',
  'QUANTITY_LIMIT',
  'QUOTE_STALE',
  'QUOTE_EXPIRED',
  'COUPON_INVALID',
  'COUPON_EXPIRED',
  'IDEMPOTENCY_CONFLICT',
  'WALLET_NOT_CONNECTED',
  'WALLET_REJECTED',
  'SERVER_ERROR',
  'SERVICE_UNAVAILABLE',
  'NETWORK_ERROR',
  'TIMEOUT',
] as const
export const apiErrorCodeSchema = z.enum(API_ERROR_CODES)
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>

export const apiErrorBodySchema = z.object({
  error: z.object({
    code: apiErrorCodeSchema,
    message: z.string(),
    fieldErrors: z.record(z.string(), z.string()).optional(),
    details: z.unknown().optional(),
  }),
})
export type ApiErrorBody = z.infer<typeof apiErrorBodySchema>
