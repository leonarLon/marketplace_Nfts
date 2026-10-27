import { createFileRoute } from '@tanstack/react-router'
import { WalletsPage } from '@/features/account/wallets-page'
import { redirectSearchSchema } from '@/features/auth/redirect'

export const Route = createFileRoute('/_auth/perfil/carteiras')({
  validateSearch: redirectSearchSchema,
  component: function WalletsRoute() {
    const { redirect } = Route.useSearch()
    return <WalletsPage redirect={redirect} />
  },
})
