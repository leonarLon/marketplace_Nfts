import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Itens do layout fora do escopo da entrega (editorial, suporte, atividade, ofertas...).
 * São exibidos para preservar a composição do Figma, mas sinalizados como indisponíveis
 * — não navegam e não aparentam sucesso funcional.
 */
export function UnavailableLink({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      role="link"
      aria-disabled="true"
      title="Disponível em breve"
      className={cn('cursor-not-allowed opacity-70', className)}
    >
      {children}
      <span className="sr-only"> (indisponível nesta versão)</span>
    </span>
  )
}
