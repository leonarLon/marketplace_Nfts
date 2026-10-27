import { useCallback, useId, useState, type FormEvent } from 'react'
import type { ZodType } from 'zod'
import { isApiError } from '@/api/http'

type Errors<T> = Partial<Record<keyof T | 'form', string>>

/**
 * Formulário controlado com validação Zod no envio e no blur, mensagens da API mescladas
 * por campo e foco automático no primeiro campo inválido.
 */
export function useZodForm<T extends Record<string, unknown>>(schema: ZodType<T>, initial: T, opts: { formId?: string } = {}) {
  const [values, setValues] = useState<T>(initial)
  const [errors, setErrors] = useState<Errors<T>>({})
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({})
  const autoId = useId()
  /** id do <form>; formulários lógicos podem compartilhar o mesmo elemento (opts.formId). */
  const formId = opts.formId ?? `form-${autoId}`

  const validate = useCallback(
    (next: T) => {
      const result = schema.safeParse(next)
      if (result.success) return { data: result.data, errors: {} as Errors<T> }
      const found: Errors<T> = {}
      for (const issue of result.error.issues) {
        const key = (issue.path[0] ?? 'form') as keyof T
        found[key] ??= issue.message
      }
      return { data: null, errors: found }
    },
    [schema],
  )

  const focusFirstError = (errs: Errors<T>) => {
    requestAnimationFrame(() => {
      const formEl = document.getElementById(formId)
      const first = Object.keys(errs).find((k) => k !== 'form')
      const el = first ? formEl?.querySelector<HTMLElement>(`[name="${first}"]`) : null
      ;(el ?? formEl?.querySelector<HTMLElement>('[role="alert"]'))?.focus()
    })
  }

  const setField = <K extends keyof T>(key: K, value: T[K]) => {
    setValues((prev) => {
      const next = { ...prev, [key]: value }
      if (touched[key] || errors[key]) {
        const { errors: errs } = validate(next)
        setErrors((e) => ({ ...e, [key]: errs[key] }))
      }
      return next
    })
  }

  /**
   * No blur só atualizamos erros JÁ exibidos (para limpá-los). Mostrar erro novo no blur
   * desloca o layout e pode fazer o clique em "Salvar" cair fora do botão.
   */
  const blur = (key: keyof T) => {
    setTouched((t) => ({ ...t, [key]: true }))
    const { errors: errs } = validate(values)
    setErrors((e) => (e[key] ? { ...e, [key]: errs[key] } : e))
  }

  /** Aplica erros retornados pela API (fieldErrors + mensagem geral). */
  const applyServerError = (error: unknown) => {
    const errs: Errors<T> = {}
    if (isApiError(error)) {
      for (const [k, v] of Object.entries(error.fieldErrors)) errs[k as keyof T] = v
      if (!Object.keys(error.fieldErrors).length) errs.form = error.message
    } else {
      errs.form = 'Não foi possível concluir. Tente novamente.'
    }
    setErrors(errs)
    focusFirstError(errs)
  }

  const handleSubmit = (onValid: (data: T) => void) => (event: FormEvent) => {
    event.preventDefault()
    const { data, errors: errs } = validate(values)
    setErrors(errs)
    if (!data) {
      focusFirstError(errs)
      return
    }
    onValid(data)
  }

  const fieldProps = <K extends keyof T & string>(key: K) => ({
    id: key,
    name: key,
    value: (values[key] ?? '') as string,
    onChange: (e: { target: { value: string } }) => setField(key, e.target.value as T[K]),
    onBlur: () => blur(key),
    'aria-invalid': errors[key] ? true : undefined,
    'aria-describedby': errors[key] ? `${key}-error` : undefined,
  })

  return { values, setValues, errors, setErrors, setField, fieldProps, handleSubmit, applyServerError, formProps: { id: formId }, reset: () => setValues(initial) }
}
