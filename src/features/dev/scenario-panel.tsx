import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { FlaskConical } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { queryKeys } from '@/app/query-keys'
import type { Cart } from '@/contracts/commerce'
import * as money from '@/lib/money'
import { useCacheScope } from '@/session/use-session'

/** Contrato mínimo da API de controle exposta pela camada MSW (src/mocks/control.ts). */
interface MockControlApi {
  scenarios: Record<string, string>
  getScenario: () => string
  updateNft: (id: string, patch: { price?: string; editions?: Record<string, number> }) => unknown
  replayLastEvent: () => boolean
  dropConnections: () => void
  pendingOrders: () => string[]
  settleOrder: (id: string, outcome: 'confirmed' | 'declined') => unknown
  expireSessions: () => void
}

function control(): MockControlApi | null {
  return (window as unknown as { __kurioMock?: MockControlApi }).__kurioMock ?? null
}

/**
 * Painel de cenários (somente com mocks ativos). Atua no backend simulado; a interface recebe
 * as mudanças pelas mesmas vias de produção: respostas REST e eventos via socket.io-client.
 */
export function ScenarioPanel() {
  const api = control()
  const queryClient = useQueryClient()
  const { scope } = useCacheScope()
  const [scenario, setScenario] = useState(() => api?.getScenario() ?? 'default')
  if (!api) return null

  const firstCartItem = () => queryClient.getQueryData<Cart>(queryKeys.cart(scope))?.items[0]

  const actions: { label: string; run: () => void }[] = [
    {
      label: 'Subir 10% o preço do 1º item do carrinho',
      run: () => {
        const item = firstCartItem()
        if (!item) return void toast.info('Adicione um item ao carrinho primeiro.')
        api.updateNft(item.nftId, { price: money.add(item.unitPrice, money.percentOf(item.unitPrice, 1000)) })
      },
    },
    {
      label: 'Esgotar a edição do 1º item do carrinho',
      run: () => {
        const item = firstCartItem()
        if (!item) return void toast.info('Adicione um item ao carrinho primeiro.')
        api.updateNft(item.nftId, { editions: { [item.editionId]: 0 } })
      },
    },
    { label: 'Reenviar último evento (duplicata)', run: () => api.replayLastEvent() },
    { label: 'Derrubar conexão Socket.IO', run: () => api.dropConnections() },
    { label: 'Expirar sessões ativas', run: () => api.expireSessions() },
    {
      label: 'Recusar pedidos pendentes',
      run: () => api.pendingOrders().forEach((id) => api.settleOrder(id, 'declined')),
    },
  ]

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="secondary" size="sm" className="fixed right-4 bottom-4 z-40 border border-border-strong shadow-lg max-md:top-1 max-md:right-1/2 max-md:bottom-auto max-md:h-7 max-md:translate-x-1/2 max-md:text-xs" aria-label="Abrir painel de cenários da demonstração">
          <FlaskConical className="size-4" aria-hidden /> Cenários
        </Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Cenários da demonstração</SheetTitle>
          <SheetDescription>Controla a API simulada (MSW). Trocar de cenário recarrega a página com dados restaurados.</SheetDescription>
        </SheetHeader>
        <div className="space-y-6 px-4 pb-6">
          <div className="space-y-2">
            <label htmlFor="scenario-select" className="text-sm font-bold">
              Cenário
            </label>
            <select
              id="scenario-select"
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
              className="h-10 w-full rounded-sm border border-input bg-background px-2 text-sm"
            >
              {Object.entries(api.scenarios).map(([name, description]) => (
                <option key={name} value={name}>
                  {name} — {description}
                </option>
              ))}
            </select>
            <Button className="w-full" onClick={() => window.location.assign(`/?scenario=${scenario}`)}>
              Aplicar e restaurar dados
            </Button>
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-bold">Eventos e falhas</h3>
            {actions.map((a) => (
              <Button key={a.label} variant="outline" className="h-auto w-full justify-start py-2 text-left whitespace-normal" onClick={a.run}>
                {a.label}
              </Button>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
