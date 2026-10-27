import { createFileRoute } from '@tanstack/react-router'
import { AuthPage } from '@/features/auth/auth-page'
import { redirectSearchSchema } from '@/features/auth/redirect'

export const Route = createFileRoute('/cadastro')({
  validateSearch: redirectSearchSchema,
  head: () => ({ meta: [{ title: 'Criar conta — Kurio' }] }),
  component: function RegisterRoute() {
    const { redirect } = Route.useSearch()
    return <AuthPage mode="register" redirect={redirect} />
  },
})
