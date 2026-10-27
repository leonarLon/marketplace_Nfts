import { safeStorage } from '@/lib/storage'

/** Identificador do carrinho do visitante. O conteúdo vive na API; aqui só guardamos a referência. */
const KEY = 'kurio:guest-cart'

export const guestCart = {
  get: () => safeStorage.get(KEY),
  set: (id: string) => safeStorage.set(KEY, id),
  clear: () => safeStorage.remove(KEY),
}
