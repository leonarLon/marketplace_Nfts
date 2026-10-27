import { createFileRoute } from '@tanstack/react-router'
import { AuthPage } from '@/features/auth/auth-page'
import { redirectSearchSchema } from '@/features/auth/redirect'

export const Route = createFileRoute('/entrar')({
  validateSearch: redirectSearchSchema,
  head: () => ({ meta: [{ title: 'Entrar — Kurio' }] }),
  component: function LoginRoute() {
    const { redirect } = Route.useSearch()
    return <AuthPage mode="login" redirect={redirect} />
  },
})
