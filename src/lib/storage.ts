/** Acesso a Web Storage tolerante a modo privado / storage bloqueado. */
function make(getStore: () => Storage) {
  return {
    get(key: string): string | null {
      try {
        return getStore().getItem(key)
      } catch {
        return null
      }
    },
    set(key: string, value: string) {
      try {
        getStore().setItem(key, value)
      } catch {
        /* storage indisponível: estado fica apenas em memória */
      }
    },
    remove(key: string) {
      try {
        getStore().removeItem(key)
      } catch {
        /* ignore */
      }
    },
  }
}

export const safeStorage = make(() => window.localStorage)
export const safeSession = make(() => window.sessionStorage)
