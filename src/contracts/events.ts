import { z } from 'zod'
import { ethString, isoDate } from './common'
import { orderSchema } from './commerce'

export const nftUpdatedEventSchema = z.object({
  eventId: z.string(),
  type: z.literal('nft.updated'),
  resource: z.object({ type: z.literal('nft'), id: z.string() }),
  version: z.number().int().nonnegative(),
  occurredAt: isoDate,
  data: z.object({
    price: ethString,
    previousPrice: ethString.nullable(),
    editions: z.array(z.object({ id: z.string(), available: z.number().int().nonnegative() })),
  }),
})
export type NftUpdatedEvent = z.infer<typeof nftUpdatedEventSchema>

export const orderUpdatedEventSchema = z.object({
  eventId: z.string(),
  type: z.literal('order.updated'),
  resource: z.object({ type: z.literal('order'), id: z.string() }),
  version: z.number().int().nonnegative(),
  occurredAt: isoDate,
  data: orderSchema,
})
export type OrderUpdatedEvent = z.infer<typeof orderUpdatedEventSchema>

export const realtimeEventSchema = z.discriminatedUnion('type', [nftUpdatedEventSchema, orderUpdatedEventSchema])
export type RealtimeEvent = z.infer<typeof realtimeEventSchema>

export const REALTIME_EVENTS = ['nft.updated', 'order.updated'] as const
