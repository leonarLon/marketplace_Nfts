import { createFileRoute } from '@tanstack/react-router'
import { FavoritesPage } from '@/features/favorites/favorites-page'

export const Route = createFileRoute('/_auth/perfil/favoritos')({
  component: FavoritesPage,
})
