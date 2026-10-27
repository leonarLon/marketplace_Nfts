import { sessionSchema, type Session, type User } from '@/contracts/account'
import { safeStorage } from '@/lib/storage'

/**
 * Fonte única da sessão no cliente. Persistida em localStorage para sobreviver ao refresh.
 * O token é opaco (emitido pela API simulada); senhas nunca passam por aqui.
 */
export type SessionState =
  | { status: 'anonymous'; session: null }
  | { status: 'authenticated'; session: Session }
  /** Token rejeitado pela API. Mantém o usuário para retomar o contexto após novo login. */
  | { status: 'expired'; session: Session }

const STORAGE_KEY = 'kurio:session'

type Listener = (state: SessionState, previous: SessionState) => void

function readPersisted(): SessionState {
  const raw = safeStorage.get(STORAGE_KEY)
  if (!raw) return { status: 'anonymous', session: null }
  try {
    const session = sessionSchema.parse(JSON.parse(raw))
    return { status: 'authenticated', session }
  } catch {
    safeStorage.remove(STORAGE_KEY)
    return { status: 'anonymous', session: null }
  }
}

let state: SessionState = readPersisted()
const listeners = new Set<Listener>()

function setState(next: SessionState) {
  const previous = state
  state = next
  if (next.status === 'authenticated') safeStorage.set(STORAGE_KEY, JSON.stringify(next.session))
  else if (next.status === 'anonymous') safeStorage.remove(STORAGE_KEY)
  listeners.forEach((l) => l(next, previous))
}

export const sessionStore = {
  getState: () => state,
  subscribe(listener: Listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  getToken: () => (state.status === 'authenticated' ? state.session.token : null),
  getUserId: () => state.session?.user.id ?? null,
  signIn(session: Session) {
    setState({ status: 'authenticated', session })
  },
  updateUser(user: User) {
    if (state.status === 'anonymous') return
    setState({ ...state, session: { ...state.session, user } })
  },
  markExpired() {
    if (state.status !== 'authenticated') return
    setState({ status: 'expired', session: state.session })
  },
  signOut() {
    if (state.status === 'anonymous') return
    setState({ status: 'anonymous', session: null })
  },
}
