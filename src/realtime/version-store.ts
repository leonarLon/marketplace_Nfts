import { useSyncExternalStore } from 'react'

/**
 * Última versão conhecida de cada NFT (vinda de REST ou de `nft.updated`).
 * O checkout compara a versão de cada linha da cotação com esta tabela: se o catálogo
 * avançou, a cotação está desatualizada e a confirmação fica bloqueada.
 */
const versions = new Map<string, number>()
const listeners = new Set<() => void>()
let snapshot = 0

function emit() {
  snapshot += 1
  listeners.forEach((l) => l())
}

export const nftVersions = {
  get: (nftId: string) => versions.get(nftId) ?? 0,
  /** Registra a versão se for mais nova. Retorna false para versões repetidas ou antigas. */
  observe(nftId: string, version: number) {
    if (version <= (versions.get(nftId) ?? 0)) return false
    versions.set(nftId, version)
    emit()
    return true
  },
  clear() {
    versions.clear()
    emit()
  },
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
}

/** Re-renderiza quando qualquer versão muda. */
export function useNftVersions() {
  useSyncExternalStore(nftVersions.subscribe, () => snapshot)
  return nftVersions
}
