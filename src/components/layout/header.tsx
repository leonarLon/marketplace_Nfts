import { useState } from 'react'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { Heart, LogIn, LogOut, Search, ShoppingCart, User, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useCart } from '@/features/cart/use-cart'
import { useLogout } from '@/features/auth/use-auth'
import { useCurrentUser } from '@/session/use-session'
import { cn } from '@/lib/utils'
import { UnavailableLink } from './unavailable'

const MARKET_PATHS = ['/nft', '/carrinho', '/pagamento', '/pedido']

export function Header() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const user = useCurrentUser()
  const { data: cart } = useCart()
  const logout = useLogout()
  const [searchOpen, setSearchOpen] = useState(false)
  const count = cart?.items.reduce((sum, i) => sum + i.quantity, 0) ?? 0
  const marketActive = MARKET_PATHS.some((p) => pathname.startsWith(p))

  const navItem = (active: boolean) =>
    cn(
      'relative py-2 text-sm transition-colors hover:text-primary md:text-base',
      active && 'font-bold text-primary after:absolute after:inset-x-0 after:-bottom-[13px] after:h-0.5 after:bg-primary',
    )

  return (
    <header className="container-page pt-6">
      <div className="flex h-11 items-center justify-between gap-4 border-b border-border-strong/60 pb-3">
        <Link to="/" className="text-sm font-bold tracking-[0.12em]" aria-label="Kurio, página inicial">
          KURIO
        </Link>

        <nav aria-label="Principal" className="hidden items-center gap-9 md:flex">
          <Link to="/" className={navItem(pathname === '/')} activeOptions={{ exact: true }}>
            Início
          </Link>
          <Link to="/" hash="catalogo" className={navItem(marketActive)}>
            Mercado
          </Link>
          <UnavailableLink className={navItem(false)}>Criadores</UnavailableLink>
          <UnavailableLink className={navItem(false)}>Aprenda</UnavailableLink>
        </nav>

        <div className="flex items-center gap-2 sm:gap-4">
          <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
          <Button variant="ghost" size="icon" asChild>
            <Link to="/carrinho" aria-label={`Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}`} className="relative">
              <ShoppingCart className="size-5" />
              {count > 0 && (
                <span className="absolute -top-0.5 -right-0.5 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                  {count}
                </span>
              )}
            </Link>
          </Button>
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" aria-label={`Conta de ${user.displayName}`}>
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt="" className="size-5 rounded-full object-cover" />
                  ) : (
                    <User className="size-4" />
                  )}
                  <span className="hidden max-w-28 truncate sm:inline">{user.displayName}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/perfil">
                    <User /> Dados do perfil
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/perfil/carteiras">
                    <Wallet /> Carteiras
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/perfil/favoritos">
                    <Heart /> Lista de interesse
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => logout.mutate()}>
                  <LogOut /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button size="sm" asChild>
              <Link to="/entrar" search={{ redirect: pathname === '/entrar' ? undefined : pathname }}>
                <LogIn className="size-4" /> Entrar
              </Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}

function SearchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate()
  const [term, setTerm] = useState('')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Buscar NFTs">
          <Search className="size-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Buscar NFTs</DialogTitle>
          <DialogDescription>Pesquise por nome, coleção ou ID do token.</DialogDescription>
        </DialogHeader>
        <form
          role="search"
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            onOpenChange(false)
            void navigate({ to: '/', search: (prev) => ({ ...prev, q: term.trim() || undefined, page: undefined }), hash: 'catalogo' })
          }}
        >
          <label htmlFor="global-search" className="sr-only">
            Termo de busca
          </label>
          <Input id="global-search" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Ex.: Emerald Ape" autoFocus />
          <Button type="submit">Buscar</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
