/**
 * Aritmética monetária em ETH sem ponto flutuante binário.
 *
 * Valores trafegam como strings decimais ("1.19", "0.016") e são convertidos para
 * bigint em wei (10^18) para qualquer cálculo. Nunca use Number para somar preços.
 */

export const ETH_DECIMALS = 18
const SCALE = 10n ** BigInt(ETH_DECIMALS)
const DECIMAL_RE = /^(\d+)(?:\.(\d{1,18}))?$/

export type EthString = string

export function isEthString(value: string): boolean {
  return DECIMAL_RE.test(value)
}

export function toWei(value: EthString): bigint {
  const match = DECIMAL_RE.exec(value.trim())
  if (!match) throw new Error(`Valor ETH inválido: "${value}"`)
  const [, int = '0', frac = ''] = match
  return BigInt(int) * SCALE + BigInt(frac.padEnd(ETH_DECIMALS, '0'))
}

export function fromWei(wei: bigint): EthString {
  if (wei < 0n) throw new Error('Valor ETH negativo não suportado')
  const int = wei / SCALE
  const frac = (wei % SCALE).toString().padStart(ETH_DECIMALS, '0').replace(/0+$/, '')
  return frac ? `${int}.${frac}` : int.toString()
}

export function add(...values: EthString[]): EthString {
  return fromWei(values.reduce((acc, v) => acc + toWei(v), 0n))
}

export function subtract(a: EthString, b: EthString): EthString {
  const diff = toWei(a) - toWei(b)
  return fromWei(diff < 0n ? 0n : diff)
}

export function multiply(value: EthString, quantity: number): EthString {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new Error(`Quantidade deve ser inteira e não negativa: ${quantity}`)
  }
  return fromWei(toWei(value) * BigInt(quantity))
}

/** Percentual em pontos-base (1000 = 10%), arredondado para baixo em wei. */
export function percentOf(value: EthString, basisPoints: number): EthString {
  if (!Number.isInteger(basisPoints) || basisPoints < 0) throw new Error('Basis points inválido')
  return fromWei((toWei(value) * BigInt(basisPoints)) / 10_000n)
}

export function compare(a: EthString, b: EthString): -1 | 0 | 1 {
  const diff = toWei(a) - toWei(b)
  return diff === 0n ? 0 : diff > 0n ? 1 : -1
}

export function equals(a: EthString, b: EthString): boolean {
  return compare(a, b) === 0
}

/**
 * Formata para exibição com no mínimo `minFraction` casas e no máximo `maxFraction`,
 * truncando (sem arredondar via float). Ex.: "26.846" → "26.846", "1.2" → "1.20".
 */
export function formatEth(value: EthString, { minFraction = 2, maxFraction = 6 } = {}): string {
  const [int = '0', frac = ''] = fromWei(toWei(value)).split('.')
  const trimmed = frac.slice(0, maxFraction).replace(/0+$/, '')
  const padded = trimmed.padEnd(minFraction, '0')
  return padded ? `${int}.${padded}` : int
}
