import { delay, HttpResponse } from 'msw'
import type { ApiErrorCode } from '@/contracts/common'
import type { ZodType } from 'zod'
import { db } from './db'
import { MockHttpError } from './domain'
import { latencyFor, SESSION_TTL_MS, SHORT_SESSION_TTL_MS } from './scenarios'

export const API = import.meta.env.VITE_API_URL ?? '/api'

/* ------------------------------------------------- injeção de falhas (testes/demo) */

export interface Fault {
  /** Chave da rota (ex.: "nfts:list", "favorites:add") ou "*" para qualquer rota. */
  route: string
  kind: 'status' | 'network' | 'timeout'
  status?: number
  code?: ApiErrorCode
  times: number
}

const faults: Fault[] = []

export function injectFault(fault: Fault) {
  faults.push({ ...fault })
}

export function clearFaults() {
  faults.length = 0
}

function takeFault(route: string) {
  const idx = faults.findIndex((f) => f.route === route || f.route === '*')
  if (idx < 0) return null
  const fault = faults[idx] as Fault
  fault.times -= 1
  if (fault.times <= 0) faults.splice(idx, 1)
  return fault
}

/* ------------------------------------------------------------- respostas */

export function errorJson(status: number, code: ApiErrorCode, message: string, fieldErrors?: Record<string, string>, details?: unknown) {
  return HttpResponse.json({ error: { code, message, fieldErrors, details } }, { status })
}

const HTTP_TIMEOUT = Number(import.meta.env.VITE_HTTP_TIMEOUT ?? 8000)

type Resolver = (ctx: { request: Request; params: Record<string, string | readonly string[] | undefined> }) => Promise<Response> | Response

/**
 * Envelopa um handler com: falhas injetadas, cenário offline, latência determinística,
 * erros 5xx de cenário e conversão de MockHttpError para o envelope de erro da API.
 */
export function route(name: string, resolver: Resolver): Resolver {
  return async (ctx) => {
    const fault = takeFault(name)
    if (fault?.kind === 'network' || db.scenario === 'offline') return HttpResponse.error()
    await delay(latencyFor(db.scenario, name))
    if (fault?.kind === 'timeout') {
      await delay(HTTP_TIMEOUT + 2000)
      return errorJson(504, 'TIMEOUT', 'Tempo esgotado')
    }
    if (fault?.kind === 'status') {
      const status = fault.status ?? 500
      return errorJson(status, fault.code ?? (status >= 500 ? 'SERVER_ERROR' : 'VALIDATION_ERROR'), 'Falha simulada')
    }
    if (db.scenario === 'server-error' && (name === 'nfts:list' || name === 'nfts:detail')) {
      return errorJson(500, 'SERVER_ERROR', 'Erro interno simulado')
    }
    try {
      return await resolver(ctx)
    } catch (error) {
      if (error instanceof MockHttpError) {
        return errorJson(error.status, error.code, error.message, error.fieldErrors, error.details)
      }
      console.error('[mock] erro inesperado', error)
      return errorJson(500, 'SERVER_ERROR', 'Erro interno simulado')
    }
  }
}

export async function parseBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    throw new MockHttpError(400, 'VALIDATION_ERROR', 'Corpo da requisição inválido')
  }
  const result = schema.safeParse(raw)
  if (!result.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of result.error.issues) {
      const key = issue.path.join('.') || 'form'
      fieldErrors[key] ??= issue.message
    }
    throw new MockHttpError(422, 'VALIDATION_ERROR', 'Verifique os campos destacados', fieldErrors)
  }
  return result.data
}

/* ------------------------------------------------------------- sessão */

export function bearer(request: Request) {
  const header = request.headers.get('Authorization')
  return header?.startsWith('Bearer ') ? header.slice(7) : null
}

export function requireUser(request: Request) {
  const token = bearer(request)
  if (!token) throw new MockHttpError(401, 'UNAUTHORIZED', 'Entre para continuar')
  const session = db.sessions[token]
  if (!session || session.revoked) throw new MockHttpError(401, 'UNAUTHORIZED', 'Sessão inválida')
  if (session.expiresAt <= Date.now()) throw new MockHttpError(401, 'SESSION_EXPIRED', 'Sua sessão expirou')
  const user = db.users[session.userId]
  if (!user) throw new MockHttpError(401, 'UNAUTHORIZED', 'Sessão inválida')
  return { user, token, session }
}

export function sessionTtl() {
  return db.scenario === 'session-short' ? SHORT_SESSION_TTL_MS : SESSION_TTL_MS
}

export async function hashPassword(salt: string, password: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${password}`))
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('')
}
