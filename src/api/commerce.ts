import {
  cartSchema,
  orderSchema,
  quoteSchema,
  type AddCartItemRequest,
  type CreateOrderRequest,
  type QuoteRequest,
} from '@/contracts/commerce'
import { request } from './http'

export const cartApi = {
  get: (signal?: AbortSignal) => request(cartSchema, { url: '/cart', signal }),
  addItem: (body: AddCartItemRequest) => request(cartSchema, { url: '/cart/items', method: 'POST', data: body }),
  updateItem: (itemId: string, quantity: number) =>
    request(cartSchema, { url: `/cart/items/${itemId}`, method: 'PATCH', data: { quantity } }),
  removeItem: (itemId: string) => request(cartSchema, { url: `/cart/items/${itemId}`, method: 'DELETE' }),
  applyCoupon: (code: string) => request(cartSchema, { url: '/cart/coupon', method: 'PUT', data: { code } }),
  removeCoupon: () => request(cartSchema, { url: '/cart/coupon', method: 'DELETE' }),
  /** Funde o carrinho do visitante no carrinho do usuário autenticado. */
  merge: (guestCartId: string) =>
    request(cartSchema, { url: '/cart/merge', method: 'POST', data: { guestCartId } }),
}

export const quotesApi = {
  create: (body: QuoteRequest) => request(quoteSchema, { url: '/quotes', method: 'POST', data: body }),
}

export const ordersApi = {
  create: (body: CreateOrderRequest, idempotencyKey: string) =>
    request(orderSchema, {
      url: '/orders',
      method: 'POST',
      data: body,
      headers: { 'Idempotency-Key': idempotencyKey },
    }),
  get: (id: string, signal?: AbortSignal) => request(orderSchema, { url: `/orders/${id}`, signal }),
}
