import type { Share } from '@/types'

/**
 * 端数は先頭のメンバーから順に1円ずつ配分する（合計は必ずamountと一致する）
 */
export function distributeEqual(amount: number, count: number): number[] {
  if (count <= 0) return []
  const base = Math.floor(amount / count)
  const remainder = amount - base * count
  return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0))
}

/**
 * 比率の端数は小数部が大きいメンバーから順に1円ずつ配分する（最大剰余法）
 */
export function distributeRatio(amount: number, ratios: number[]): number[] {
  const total = ratios.reduce((sum, r) => sum + r, 0)
  if (total <= 0) return distributeEqual(amount, ratios.length)

  const raw = ratios.map((r) => (amount * r) / total)
  const floored = raw.map((v) => Math.floor(v))
  const remainder = amount - floored.reduce((sum, v) => sum + v, 0)

  const order = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac)

  const result = [...floored]
  for (let k = 0; k < remainder; k++) {
    result[order[k % order.length].i] += 1
  }
  return result
}

export function sumBurden(shares: Share[]): number {
  return shares.reduce((sum, s) => sum + s.burden, 0)
}

export type Balance = { member: string; balance: number }
export type Transfer = { from: string; to: string; amount: number }

/**
 * 各メンバーの収支(支払った額 - 負担額)から、精算に必要な最小限の送金リストを求める
 */
export function simplifyDebts(balances: Balance[]): Transfer[] {
  const creditors = balances
    .filter((b) => b.balance > 0)
    .map((b) => ({ ...b }))
    .sort((a, b) => b.balance - a.balance)
  const debtors = balances
    .filter((b) => b.balance < 0)
    .map((b) => ({ member: b.member, balance: -b.balance }))
    .sort((a, b) => b.balance - a.balance)

  const transfers: Transfer[] = []
  let i = 0
  let j = 0
  while (i < creditors.length && j < debtors.length) {
    const amount = Math.min(creditors[i].balance, debtors[j].balance)
    if (amount > 0) {
      transfers.push({ from: debtors[j].member, to: creditors[i].member, amount })
    }
    creditors[i].balance -= amount
    debtors[j].balance -= amount
    if (creditors[i].balance === 0) i++
    if (debtors[j].balance === 0) j++
  }
  return transfers
}
