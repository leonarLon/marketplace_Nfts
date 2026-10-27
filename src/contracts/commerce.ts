import { z } from 'zod'
import { ethString, isoDate, networkSchema, walletProviderSchema } from './common'

export const cartItemSchema = z.object({
  id: z.string(),
  nftId: z.string(),
  editionId: z.string(),
  editionLabel: z.string(),
  name: z.string(),
  tokenId: z.string(),
  image: z.string(),
  imageAlt: z.string(),
  quantity: z.number().int().positive(),
  /** Preço atual do catálogo. */
  unitPrice: ethString,
  /** Preço no momento em que o item entrou no carrinho, para sinalizar alterações. */
  priceAtAdd: ethString,
  available: z.number().int().nonnegative(),
  maxPerOrder: z.number().int().positive(),
  nftVersion: z.number().int().nonnegative(),
})
export type CartItem = z.infer<typeof cartItemSchema>

export const cartSchema = z.object({
  id: z.string(),
  items: z.array(cartItemSchema),
  couponCode: z.string().nullable(),
  version: z.number().int().nonnegative(),
  updatedAt: isoDate,
})
export type Cart = z.infer<typeof cartSchema>

export const addCartItemSchema = z.object({
  nftId: z.string(),
  editionId: z.string(),
  quantity: z.number().int().positive(),
})
export type AddCartItemRequest = z.infer<typeof addCartItemSchema>

export const QUOTE_ISSUE_KINDS = ['PRICE_CHANGED', 'INSUFFICIENT_STOCK', 'SOLD_OUT', 'COUPON_REMOVED'] as const
export const quoteIssueSchema = z.object({
  kind: z.enum(QUOTE_ISSUE_KINDS),
  itemId: z.string().nullable(),
  message: z.string(),
  previous: z.string().nullable(),
  current: z.string().nullable(),
})
export type QuoteIssue = z.infer<typeof quoteIssueSchema>

export const quoteLineSchema = z.object({
  itemId: z.string(),
  nftId: z.string(),
  editionId: z.string(),
  editionLabel: z.string(),
  name: z.string(),
  tokenId: z.string(),
  image: z.string(),
  imageAlt: z.string(),
  quantity: z.number().int().positive(),
  unitPrice: ethString,
  lineTotal: ethString,
  nftVersion: z.number().int().nonnegative(),
})
export type QuoteLine = z.infer<typeof quoteLineSchema>

export const quoteSchema = z.object({
  id: z.string(),
  cartVersion: z.number().int().nonnegative(),
  network: networkSchema,
  lines: z.array(quoteLineSchema),
  coupon: z.object({ code: z.string(), discountBps: z.number().int() }).nullable(),
  subtotal: ethString,
  discount: ethString,
  networkFee: ethString,
  total: ethString,
  issues: z.array(quoteIssueSchema),
  createdAt: isoDate,
  expiresAt: isoDate,
})
export type Quote = z.infer<typeof quoteSchema>

/** A cotação é calculada sobre o carrinho atual do dono da requisição (itens + cupom aplicado). */
export const quoteRequestSchema = z.object({
  network: networkSchema,
})
export type QuoteRequest = z.infer<typeof quoteRequestSchema>

export const buyerSchema = z.object({
  displayName: z.string().trim().min(2, 'Informe o nome de exibição'),
  username: z.string().trim().min(3, 'Informe o nome de usuário'),
  profileName: z.string().trim().min(2, 'Informe o nome do perfil'),
  email: z.email('Informe um e-mail válido'),
  referralCode: z.string().trim().regex(/^[A-Z0-9]{4,12}$/i, 'Código de 4 a 12 letras ou números'),
  ensName: z.string().regex(/^[a-z0-9-]{3,32}$/i, 'Use de 3 a 32 letras, números ou hífen'),
  note: z.string().max(280, 'Máximo de 280 caracteres'),
})
export type Buyer = z.infer<typeof buyerSchema>

export const createOrderRequestSchema = z.object({
  quoteId: z.string(),
  walletId: z.string(),
  network: networkSchema,
  buyer: buyerSchema,
})
export type CreateOrderRequest = z.infer<typeof createOrderRequestSchema>

export const ORDER_STATUSES = ['pending', 'confirmed', 'declined'] as const
export const orderStatusSchema = z.enum(ORDER_STATUSES)
export type OrderStatus = z.infer<typeof orderStatusSchema>

export const orderSchema = z.object({
  id: z.string(),
  status: orderStatusSchema,
  /** Snapshot imutável da cotação aceita. */
  lines: z.array(quoteLineSchema),
  subtotal: ethString,
  discount: ethString,
  networkFee: ethString,
  total: ethString,
  couponCode: z.string().nullable(),
  network: networkSchema,
  wallet: z.object({ id: z.string(), nickname: z.string(), provider: walletProviderSchema, address: z.string() }),
  txHash: z.string().nullable(),
  explorerUrl: z.string().nullable(),
  declineReason: z.string().nullable(),
  createdAt: isoDate,
  updatedAt: isoDate,
  version: z.number().int().nonnegative(),
})
export type Order = z.infer<typeof orderSchema>

export function isTerminal(status: OrderStatus) {
  return status === 'confirmed' || status === 'declined'
}
