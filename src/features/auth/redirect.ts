import { z } from 'zod'

/** Aceita apenas caminhos internos para evitar open redirect. */
export const redirectSearchSchema = z.object({
  redirect: z
    .string()
    .optional()
    .catch(undefined)
    .transform((v) => (v && v.startsWith('/') && !v.startsWith('//') && !v.startsWith('/entrar') && !v.startsWith('/cadastro') ? v : undefined)),
})
