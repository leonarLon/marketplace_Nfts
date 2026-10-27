import type { User, Wallet } from '@/contracts/account'

/**
 * Usuários fictícios. As senhas NÃO são armazenadas: guardamos apenas sal + SHA-256.
 * Credenciais de demonstração (documentadas no README): senha "Kurio2026" para ambos.
 */
export interface UserSeed {
  user: User
  credential: { salt: string; hash: string }
  favorites: string[]
  wallets: { primary: Wallet | null; secondary: Wallet | null }
}

const SEED_DATE = '2026-07-01T12:00:00.000Z'

export const USER_SEEDS: UserSeed[] = [
  {
    user: {
      id: 'usr_ana',
      username: 'ana.lima',
      displayName: 'Ana Lima',
      email: 'ana@kurio.test',
      ensName: 'analima',
      walletNickname: 'Cofre principal',
      avatarUrl: null,
      updatedAt: SEED_DATE,
    },
    credential: { salt: 's4lt-ana', hash: 'acbfdde917ab8e2e3f7b0439de09f8b24bcaab2af51731db9f4965d8e364a568' },
    favorites: ['ivory-baron-088'],
    wallets: {
      primary: {
        id: 'wal_ana_primary',
        slot: 'primary',
        displayName: 'Ana Lima',
        nickname: 'Cofre principal',
        network: 'ethereum',
        profileName: 'analima',
        address: '0xA91F3c2B7d4E5f6A8b9C0d1E2f3A4b5C6d7EE82C',
        secondaryAddress: '',
        provider: 'metamask',
        referralCode: 'KURIO01',
        email: 'ana@kurio.test',
        ensName: 'analima',
        updatedAt: SEED_DATE,
      },
      secondary: null,
    },
  },
  {
    user: {
      id: 'usr_bruno',
      username: 'bruno.costa',
      displayName: 'Bruno Costa',
      email: 'bruno@kurio.test',
      ensName: 'brunocosta',
      walletNickname: 'Carteira Coinbase',
      avatarUrl: null,
      updatedAt: SEED_DATE,
    },
    credential: { salt: 's4lt-bruno', hash: 'f07a3239b44f946a2596b2c40af809ef276c4ee14ce889cf4f579bbab1c7b874' },
    favorites: ['golden-beat-207', 'neon-vessel-552'],
    wallets: {
      primary: {
        id: 'wal_bruno_primary',
        slot: 'primary',
        displayName: 'Bruno Costa',
        nickname: 'Carteira Coinbase',
        network: 'polygon',
        profileName: 'brunocosta',
        address: '0x5B38Da6a701c568545dCfcB03FcB875f56beddC4',
        secondaryAddress: '',
        provider: 'coinbase',
        referralCode: 'KURIO02',
        email: 'bruno@kurio.test',
        ensName: 'brunocosta',
        updatedAt: SEED_DATE,
      },
      secondary: {
        id: 'wal_bruno_secondary',
        slot: 'secondary',
        displayName: 'Bruno Costa',
        nickname: 'Reserva MetaMask',
        network: 'ethereum',
        profileName: 'brunocosta',
        address: '0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2',
        secondaryAddress: '',
        provider: 'metamask',
        referralCode: 'KURIO02',
        email: 'bruno@kurio.test',
        ensName: 'brunocosta',
        updatedAt: SEED_DATE,
      },
    },
  },
]

export const DEMO_PASSWORD = 'Kurio2026'

export const COUPONS: Record<string, { discountBps: number; expiresAt: string }> = {
  KURIO10: { discountBps: 1000, expiresAt: '2099-12-31T23:59:59.000Z' },
  GENESIS5: { discountBps: 500, expiresAt: '2099-12-31T23:59:59.000Z' },
  EXPIRADO: { discountBps: 2000, expiresAt: '2025-01-01T00:00:00.000Z' },
}
