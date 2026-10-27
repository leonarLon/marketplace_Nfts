import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { sessionStore } from '@/session/session-store'

/**
 * Guarda dos fluxos privados (checkout, pedidos, perfil, carteiras, favoritos).
 * Visitantes são enviados ao login com retorno à rota pedida. Sessão expirada permanece na
 * rota (o diálogo de reautenticação preserva o contexto).
 */
export const Route = createFileRoute('/_auth')({
  beforeLoad: ({ location }) => {
    if (sessionStore.getState().status === 'anonymous') {
      throw redirect({ to: '/entrar', search: { redirect: location.href } })
    }
  },
  component: Outlet,
})
