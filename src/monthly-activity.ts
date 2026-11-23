import Decimal from 'decimal.js'
import { GENESIS_STATE } from './event-history'
import type { StateHistory, StateChange } from './event-history'
import { stateTotals } from './state-deltas'

const Value = Decimal.clone({ precision: 100 })
export type HeatMetric = 'transactions' | 'energy'
export type DailyCommitment = { event: StateChange['event']; transactions: string; energy: string; changedMeters: number }
export type CommitmentDay = {
  date: string
  transactions: string | null
  energy: string | null
  commitments: DailyCommitment[]
}
export const utcDay = (timestamp: number) => new Date(timestamp).toISOString().slice(0, 10)
export function shiftMonth(month: string, amount: number) {
  const [year, index] = month.split('-').map(Number)
  return utcDay(Date.UTC(year, index - 1 + amount, 1)).slice(0, 7)
}
export function monthLabel(month: string) {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}
export function dayLabel(day: string) {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}
export function historyRange(history: StateHistory, now = Date.now()) {
  const genesis = Number(GENESIS_STATE.timestamp) * 1000
  const first = history.states[0], last = history.states.at(-1)
  const firstTimestamp = first ? Number(first.event.timestamp) * 1000 : genesis
  const lastTimestamp = last ? Number(last.event.timestamp) * 1000 : genesis
  const poll = Date.parse(history.status.lastSuccessfulPoll ?? '')
  const through = Math.min(now, Math.max(lastTimestamp, Number.isFinite(poll) ? poll : lastTimestamp))
  return { firstDay: utcDay(Math.min(genesis, firstTimestamp)), lastDay: utcDay(through) }
}

/** Sum all commitment diffs into UTC days, never sum cumulative meter snapshots. */
export function monthlyActivity(history: StateHistory, month: string, now = Date.now()) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Choose a valid month.')
  const { firstDay, lastDay } = historyRange(history, now)
  const [year, monthNumber] = month.split('-').map(Number)
  const dayCount = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
  const days: CommitmentDay[] = Array.from({ length: dayCount }, (_, i) => {
    const date = `${month}-${String(i + 1).padStart(2, '0')}`
    const available = date >= firstDay && date <= lastDay
    return { date, transactions: available ? '0' : null, energy: available ? '0' : null, commitments: [] }
  })
  const byDate = new Map(days.map(day => [day.date, day]))
  let totalTransactions = new Value(0), totalEnergy = new Value(0), totalCommitments = 0
  for (const { event, diff } of history.states) {
    const day = byDate.get(utcDay(Number(event.timestamp) * 1000))
    if (!day || day.transactions === null) continue
    const totals = stateTotals(diff.rows)
    if (totals.transactions === null || totals.energy === null) throw new Error('A commitment contains invalid transaction or energy values.')
    day.transactions = new Value(day.transactions).plus(totals.transactions).toFixed()
    day.energy = new Value(day.energy!).plus(totals.energy).toFixed()
    day.commitments.push({ event, transactions: totals.transactions.toFixed(), energy: totals.energy.toFixed(), changedMeters: diff.rows.filter(row => row.status !== 'equal').length })
    totalTransactions = totalTransactions.plus(totals.transactions)
    totalEnergy = totalEnergy.plus(totals.energy)
    totalCommitments++
  }
  const max: Record<HeatMetric, string> = { transactions: '0', energy: '0' }
  for (const day of days) for (const metric of Object.keys(max) as HeatMetric[]) {
    if (day[metric] !== null && new Value(day[metric]).abs().greaterThan(max[metric])) max[metric] = new Value(day[metric]).abs().toFixed()
  }
  return { days, firstDay, lastDay, max, totalCommitments, activeDays: days.filter(day => day.commitments.length > 0).length,
    totalTransactions: totalTransactions.toFixed(), totalEnergy: totalEnergy.toFixed() }
}

/** Shared linear scale across the days of a month; negative deltas retain their sign. */
export function heatLevel(value: string | null, maximum: string) {
  if (value === null) return -1
  const amount = new Value(value).abs()
  if (amount.isZero() || new Value(maximum).isZero()) return 0
  return Math.max(1, Math.min(5, amount.div(maximum).times(5).ceil().toNumber()))
}
