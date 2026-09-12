import Decimal from 'decimal.js'
import type { RowDiff } from './diff'

// Preserve the API's decimal energy values through subtraction and summation.
const Value = Decimal.clone({ precision: 100 })
export function rowDeltas(row: RowDiff) {
  if (row.status !== 'changed' || !row.left || !row.right) return null
  const difference = (column: number) => {
    const left = row.left![column], right = row.right![column]
    if (!left?.trim() || !right?.trim()) return null
    try {
      const a = new Value(left), b = new Value(right)
      return a.isFinite() && b.isFinite() ? b.minus(a) : null
    } catch { return null }
  }
  return { transactions: difference(2), energy: difference(1) }
}

export function stateTotals(rows: RowDiff[]) {
  let transactions: Decimal | null = new Value(0)
  let energy: Decimal | null = new Value(0)
  for (const row of rows) {
    const delta = rowDeltas(row)
    if (!delta) continue
    transactions = transactions && delta.transactions ? transactions.plus(delta.transactions) : null
    energy = energy && delta.energy ? energy.plus(delta.energy) : null
  }
  return { transactions, energy }
}

export function formatDelta(value: Decimal | null, signed = false) {
  if (value === null) return 'Unavailable'
  return `${signed && value.isPositive() && !value.isZero() ? '+' : ''}${value.toFixed()}`
}
