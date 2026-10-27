import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { Heart, House, ScanLine, ShoppingCart, User } from 'lucide-react'
import { useCart } from '@/features/cart/use-cart'
import { cn } from '@/lib/utils'
import { useCurrentUser } from '@/session/use-session'

/**
 * Tab Bar do frame "Mobile / Início" (nó 70395:245, 414×126): barra com recorte central,
 * botão circular laranja de 65 px (ícone de scan → explorar coleções) e quatro destinos:
 * Início, Favoritos, Carrinho ("Shop") e Perfil ("User").
 */
export function MobileTabBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const navigate = useNavigate()
  const user = useCurrentUser()
  const { data: cart } = useCart()
  const count = cart?.items.reduce((sum, i) => sum + i.quantity, 0) ?? 0

  const explore = async () => {
    if (pathname !== '/') await navigate({ to: '/' })
    window.scrollTo({ top: 0 })
    requestAnimationFrame(() => document.getElementById('catalog-search')?.focus())
  }

  const itemClass = (active: boolean) =>
    cn('grid size-11 place-items-center rounded-full', active ? 'text-primary' : 'text-[#e8c9a6] hover:text-primary')

  return (
    <nav aria-label="Navegação inferior" className="fixed inset-x-0 bottom-0 z-40 md:hidden" data-testid="mobile-tab-bar">
      <div className="relative flex h-[95px] items-stretch pb-[env(safe-area-inset-bottom)] drop-shadow-[0_-8px_24px_rgba(0,0,0,0.35)]">
        <div className="flex flex-1 items-center justify-around rounded-tl-[32px] bg-surface pl-3">
          <Link to="/" aria-label="Início" aria-current={pathname === '/' ? 'page' : undefined} className={itemClass(pathname === '/')}>
            <House className={cn('size-5', pathname === '/' && 'fill-current')} aria-hidden />
          </Link>
          <Link
            to="/perfil/favoritos"
            aria-label="Favoritos"
            aria-current={pathname === '/perfil/favoritos' ? 'page' : undefined}
            className={itemClass(pathname === '/perfil/favoritos')}
          >
            <Heart className="size-5 fill-current" aria-hidden />
          </Link>
        </div>
        {/* Recorte côncavo onde o botão central se encaixa. */}
        <svg viewBox="0 0 110 95" width="110" height="95" aria-hidden className="shrink-0 fill-surface">
          <path d="M0 0H8C16 0 17 3 19 9A38 38 0 0 0 91 9C93 3 94 0 102 0H110V95H0Z" />
        </svg>
        <div className="flex flex-1 items-center justify-around rounded-tr-[32px] bg-surface pr-3">
          <Link
            to="/carrinho"
            aria-label={`Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}`}
            className={cn(itemClass(pathname === '/carrinho'), 'relative')}
          >
            <ShoppingCart className="size-5" aria-hidden />
            {count > 0 && (
              <span aria-hidden className="absolute top-1 right-0.5 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] leading-4 font-bold text-primary-foreground">
                {count}
              </span>
            )}
          </Link>
          {/* Sem cabeçalho na home mobile, o item de conta também indica a sessão. */}
          {user ? (
            <Link
              to="/perfil"
              aria-label={`Conta de ${user.displayName}`}
              aria-current={pathname === '/perfil' ? 'page' : undefined}
              className={itemClass(pathname === '/perfil')}
            >
              <User className="size-5 fill-current" aria-hidden />
            </Link>
          ) : (
            <Link to="/entrar" aria-label="Entrar" className={itemClass(false)}>
              <User className="size-5" aria-hidden />
            </Link>
          )}
        </div>
        <button
          type="button"
          onClick={explore}
          aria-label="Explorar coleções"
          className="absolute -top-[31px] left-1/2 grid size-[65px] -translate-x-1/2 place-items-center rounded-full bg-gradient-to-b from-primary-hover to-[#b8733a] text-foreground shadow-lg"
        >
          <ScanLine className="size-[26px]" aria-hidden />
        </button>
      </div>
    </nav>
  )
}
