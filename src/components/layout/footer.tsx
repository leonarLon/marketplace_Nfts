import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { FacebookIcon, InstagramIcon, LinkedinIcon, TwitterIcon, YoutubeIcon } from '@/components/icons/social'
import { CATEGORY_LABEL, type Category } from '@/contracts/nft'
import { UnavailableLink } from './unavailable'

const FEATURES = [
  { letter: 'W', title: 'Segurança da carteira', text: 'Proteja sua carteira e colecione arte digital verificada com confiança.' },
  { letter: 'C', title: 'Criadores em destaque', text: 'Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede.' },
  { letter: 'D', title: 'Alertas de lançamentos', text: 'Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado.' },
]

const FOOTER_CATEGORIES: Category[] = ['arte-digital', 'fotografia', 'musica', 'arte-3d', 'utilidade']

const SOCIAL = [
  { label: 'Facebook', href: 'https://www.facebook.com/', Icon: FacebookIcon },
  { label: 'Instagram', href: 'https://www.instagram.com/', Icon: InstagramIcon },
  { label: 'X (Twitter)', href: 'https://x.com/', Icon: TwitterIcon },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/', Icon: LinkedinIcon },
  { label: 'YouTube', href: 'https://www.youtube.com/', Icon: YoutubeIcon },
]

export function WalletBadges({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-sm border border-border-strong bg-band px-2 py-1 text-[9px] font-bold tracking-wider text-primary ${className}`}>
      METAMASK <span aria-hidden>·</span> WALLETCONNECT <span aria-hidden>·</span> COINBASE
    </span>
  )
}

export function Footer() {
  const [newsletterMsg, setNewsletterMsg] = useState<string | null>(null)
  return (
    <footer className="container-page mt-24 mb-6">
      <div className="grid gap-8 bg-surface px-6 py-8 sm:grid-cols-2 lg:grid-cols-4 lg:px-12">
        {FEATURES.map((f) => (
          <div key={f.letter} className="lg:border-r lg:border-border-strong lg:pr-6">
            <span aria-hidden className="mb-5 grid size-[74px] place-items-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
              {f.letter}
            </span>
            <h2 className="mb-3 font-bold">{f.title}</h2>
            <p className="text-sm leading-6 text-muted-foreground">{f.text}</p>
          </div>
        ))}
        <div>
          <h2 className="mb-4 font-bold leading-5">Antecipe-se ao próximo lançamento</h2>
          <form
            className="flex"
            onSubmit={(e) => {
              e.preventDefault()
              setNewsletterMsg('A newsletter não faz parte desta demonstração; nenhum e-mail foi cadastrado.')
            }}
          >
            <label htmlFor="newsletter" className="sr-only">
              E-mail para novidades
            </label>
            <input
              id="newsletter"
              type="email"
              required
              placeholder="digite seu e-mail..."
              className="h-10 min-w-0 flex-1 bg-surface-2 px-3 text-sm placeholder:text-muted-foreground"
            />
            <button type="submit" className="h-10 bg-primary px-4 font-bold text-primary-foreground hover:bg-primary-hover">
              Enviar
            </button>
          </form>
          <p className="mt-4 text-xs leading-5 text-muted-foreground" role="status">
            {newsletterMsg ?? 'Receba lançamentos selecionados, histórias de criadores e novidades do mercado.'}
          </p>
        </div>
      </div>

      <div className="grid gap-4 bg-band px-6 py-6 text-sm sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
        <span className="font-bold tracking-[0.12em]">KURIO</span>
        <span>Feito para colecionadores, criadores e cultura</span>
        <span>contato@email.com</span>
        <span>+55 11 4002 8922</span>
      </div>

      <div className="grid gap-8 bg-surface px-6 py-8 text-sm sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
        <nav aria-label="Meu perfil">
          <h2 className="mb-3 text-base font-bold">Meu perfil</h2>
          <ul className="space-y-2">
            <li><Link to="/perfil" className="hover:text-primary">Meu perfil</Link></li>
            <li><Link to="/perfil/favoritos" className="hover:text-primary">Lista de interesse</Link></li>
            <li><UnavailableLink>Minha coleção</UnavailableLink></li>
            <li><UnavailableLink>Atividade</UnavailableLink></li>
            <li><UnavailableLink>Estúdio do criador</UnavailableLink></li>
          </ul>
        </nav>
        <nav aria-label="Central de ajuda">
          <h2 className="mb-3 text-base font-bold">Central de ajuda</h2>
          <ul className="space-y-2">
            {['Central de ajuda', 'Como comprar NFTs', 'Carteira e segurança', 'Política do mercado', 'Denunciar item'].map((t) => (
              <li key={t}><UnavailableLink>{t}</UnavailableLink></li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Coleções">
          <h2 className="mb-3 text-base font-bold">Coleções</h2>
          <ul className="space-y-2">
            {FOOTER_CATEGORIES.map((c) => (
              <li key={c}>
                <Link to="/" search={{ category: c }} hash="catalogo" className="hover:text-primary">
                  {CATEGORY_LABEL[c]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div>
          <h2 className="mb-3 text-base font-bold">Redes sociais</h2>
          <ul className="mb-6 flex gap-2">
            {SOCIAL.map(({ label, href, Icon }) => (
              <li key={label}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${label} (abre em nova aba)`}
                  className="grid size-8 place-items-center rounded-sm border border-primary text-primary hover:bg-primary/10"
                >
                  <Icon className="size-4" />
                </a>
              </li>
            ))}
          </ul>
          <h2 className="mb-2 text-base font-bold">Carteiras compatíveis</h2>
          <WalletBadges />
        </div>
      </div>
      <p className="mt-6 text-center text-xs">© 2026 Kurio. Propriedade digital para todos.</p>
    </footer>
  )
}
