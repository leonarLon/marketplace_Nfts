import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

export function NotFound({ title = 'Página não encontrada', description = 'O endereço acessado não existe ou foi removido.' }: { title?: string; description?: string }) {
  return (
    <section className="container-page grid min-h-[50vh] place-items-center py-16 text-center" aria-labelledby="not-found-title">
      <div className="max-w-md space-y-4">
        <p className="text-5xl font-bold text-primary" aria-hidden>
          404
        </p>
        <h1 id="not-found-title" className="text-2xl font-bold">
          {title}
        </h1>
        <p className="text-muted-foreground">{description}</p>
        <Button asChild>
          <Link to="/">Voltar ao início</Link>
        </Button>
      </div>
    </section>
  )
}
