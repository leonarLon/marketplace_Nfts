import { useSyncExternalStore } from 'react'

/**
 * Estado do drawer de filtros (mobile/tablet). Pode ser aberto por gatilhos em lugares
 * diferentes (botão da busca no mobile, botão da barra no tablet); guardamos quem abriu
 * para devolver o foco a ele ao fechar.
 */
let open = false
let opener: HTMLElement | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export const filtersDrawer = {
  open(trigger: HTMLElement | null) {
    opener = trigger
    open = true
    emit()
  },
  setOpen(next: boolean) {
    open = next
    emit()
  },
  restoreFocus() {
    opener?.focus()
  },
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
}

export function useFiltersDrawerOpen() {
  return useSyncExternalStore(filtersDrawer.subscribe, () => open)
}
