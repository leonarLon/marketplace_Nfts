import { createFileRoute, Link, Outlet } from '@tanstack/react-router'
import { AlertTriangle, Download, Heart, LineChart, LogOut, MapPin, ShoppingCart, User } from 'lucide-react'
import type { ReactNode } from 'react'
import { useLogout } from '@/features/auth/use-auth'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_auth/perfil')({
  component: ProfileLayout,
})

const itemClass = 'relative flex shrink-0 items-center gap-3 border-l-4 border-transparent px-3 py-3 text-sm text-primary whitespace-nowrap transition-colors hover:bg-surface-2 lg:px-4'

function Unavailable({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li>
      <span aria-disabled="true" title="Disponível em breve" className={cn(itemClass, 'cursor-not-allowed opacity-60 hover:bg-transparent')}>
        {icon}
        {children}
        <span className="sr-only"> (indisponível nesta versão)</span>
      </span>
    </li>
  )
}

function ProfileLayout() {
  const logout = useLogout()
  return (
    <div className="container-page mt-8 grid gap-8 lg:grid-cols-[310px_1fr]">
      <nav aria-label="Meu perfil" className="min-w-0 self-start bg-surface lg:py-2">
        <h2 className="hidden px-3 pt-4 pb-2 text-lg font-bold lg:block">Meu perfil</h2>
        <ul className="relative flex overflow-x-auto lg:flex-col">
          <li>
            <Link to="/perfil" activeOptions={{ exact: true }} className={itemClass} activeProps={{ className: 'border-primary bg-surface-2/40 font-bold', 'aria-current': 'page' }}>
              <User className="size-4" aria-hidden /> Dados do perfil
            </Link>
          </li>
          <li>
            <Link to="/perfil/carteiras" className={itemClass} activeProps={{ className: 'border-primary bg-surface-2/40 font-bold', 'aria-current': 'page' }}>
              <MapPin className="size-4" aria-hidden /> Carteiras
            </Link>
          </li>
          <Unavailable icon={<ShoppingCart className="size-4" aria-hidden />}>Atividade</Unavailable>
          <li>
            <Link to="/perfil/favoritos" className={itemClass} activeProps={{ className: 'border-primary bg-surface-2/40 font-bold', 'aria-current': 'page' }}>
              <Heart className="size-4" aria-hidden /> Lista de interesse
            </Link>
          </li>
          <Unavailable icon={<LineChart className="size-4" aria-hidden />}>Ofertas</Unavailable>
          <Unavailable icon={<Download className="size-4" aria-hidden />}>Arquivos baixados</Unavailable>
          <Unavailable icon={<AlertTriangle className="size-4" aria-hidden />}>Suporte</Unavailable>
          <li className="lg:border-t lg:border-border">
            <button type="button" onClick={() => logout.mutate()} className={cn(itemClass, 'w-full font-bold')}>
              <LogOut className="size-4" aria-hidden /> Sair
            </button>
          </li>
        </ul>
      </nav>
      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  )
}
