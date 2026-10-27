import axios, { AxiosError, type AxiosRequestConfig } from 'axios'
import type { ZodType } from 'zod'
import { apiErrorBodySchema, type ApiErrorCode } from '@/contracts/common'
import { sessionStore } from '@/session/session-store'
import { guestCart } from '@/session/guest-cart'

export class ApiError extends Error {
  readonly code: ApiErrorCode
  readonly status: number | null
  readonly fieldErrors: Record<string, string>
  readonly details: unknown

  constructor(opts: {
    code: ApiErrorCode
    message: string
    status: number | null
    fieldErrors?: Record<string, string>
    details?: unknown
  }) {
    super(opts.message)
    this.name = 'ApiError'
    this.code = opts.code
    this.status = opts.status
    this.fieldErrors = opts.fieldErrors ?? {}
    this.details = opts.details
  }

  /** Falhas transitórias que podem ser repetidas com segurança (GETs ou mutations idempotentes). */
  get isTransient() {
    return ['NETWORK_ERROR', 'TIMEOUT', 'SERVER_ERROR', 'SERVICE_UNAVAILABLE'].includes(this.code)
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  timeout: Number(import.meta.env.VITE_HTTP_TIMEOUT ?? 8000),
  headers: { 'Content-Type': 'application/json' },
})

http.interceptors.request.use((config) => {
  const token = sessionStore.getToken()
  if (token) config.headers.set('Authorization', `Bearer ${token}`)
  const cartId = guestCart.get()
  if (cartId && !token) config.headers.set('X-Guest-Cart', cartId)
  return config
})

http.interceptors.response.use(
  (response) => response,
  (error: unknown) => Promise.reject(normalizeError(error)),
)

function normalizeError(error: unknown): unknown {
  if (axios.isCancel(error)) return error
  if (!(error instanceof AxiosError)) return error

  if (error.code === AxiosError.ECONNABORTED || error.code === AxiosError.ETIMEDOUT) {
    return new ApiError({ code: 'TIMEOUT', status: null, message: 'A requisição demorou demais para responder.' })
  }
  if (!error.response) {
    return new ApiError({ code: 'NETWORK_ERROR', status: null, message: 'Não foi possível conectar. Verifique sua conexão.' })
  }

  const { status, data, config } = error.response
  const parsed = apiErrorBodySchema.safeParse(data)
  const apiError = parsed.success
    ? new ApiError({ status, ...parsed.data.error })
    : new ApiError({
        code: status >= 500 ? 'SERVER_ERROR' : 'VALIDATION_ERROR',
        status,
        message: status >= 500 ? 'O serviço está instável. Tente novamente.' : 'Não foi possível concluir a operação.',
      })

  // Sessão rejeitada em requisição autenticada: marca expiração sem descartar o contexto.
  const sentToken = Boolean(config.headers?.Authorization)
  if (status === 401 && sentToken && (apiError.code === 'SESSION_EXPIRED' || apiError.code === 'UNAUTHORIZED')) {
    sessionStore.markExpired()
  }
  return apiError
}

/** Requisição com validação do contrato da resposta. */
export async function request<T>(schema: ZodType<T>, config: AxiosRequestConfig): Promise<T> {
  const response = await http.request<unknown>(config)
  return schema.parse(response.data)
}
