import { test } from 'node:test'
import assert from 'node:assert/strict'
import { replayEvents } from '../src/event-history'
import type { StateHistory } from '../src/event-history'
import { heatLevel, monthlyActivity, shiftMonth } from '../src/monthly-activity'
import { event, status, word } from './event-fixtures'

const at = (time: string) => String(Date.parse(time) / 1000)
const now = Date.parse('2026-11-23T12:00:00Z')
const history: StateHistory = {
  status: { ...status, lastSuccessfulPoll: '2026-11-20T10:00:00Z' },
  states: replayEvents([
    event(1, [word(0, [['1000', '10']])], { timestamp: at('2026-10-31T23:59:59Z') }),
    event(2, [word(0, [['1500', '12']]), word(1, [['250', '1']])], { timestamp: at('2026-11-01T00:00:00Z') }),
    event(3, [word(0, [['1700', '15']])], { timestamp: at('2026-11-01T23:59:59Z') }),
    event(4, [word(1, [['500', '3']])], { timestamp: at('2026-11-02T00:00:00Z') }),
    event(5, [word(1, [['500', '3']])], { timestamp: at('2026-11-03T10:00:00Z') }),
    event(6, [word(0, [['1600', '14']])], { timestamp: at('2026-11-04T10:00:00Z') }),
  ]),
}

test('aggregates all meter diffs and all commitments into each UTC day', () => {
  const month = monthlyActivity(history, '2026-11', now)
  assert.equal(month.days.length, 30)
  assert.equal(month.days[0].transactions, '6')
  assert.equal(month.days[0].energy, '0.95')
  assert.equal(month.days[0].commitments.length, 2)
  assert.deepEqual(month.days[0].commitments.map(commit => commit.transactions), ['3', '3'])
  assert.equal(month.days[1].transactions, '2')
  assert.equal(month.days[1].energy, '0.25')
  assert.equal(month.totalTransactions, '7')
  assert.equal(month.totalEnergy, '1.1')
  assert.equal(month.totalCommitments, 5)
  assert.equal(month.activeDays, 4)
})

test('retains no-op commitments, zeros on quiet days, and signed corrections', () => {
  const { days } = monthlyActivity(history, '2026-11', now)
  assert.equal(days[2].transactions, '0')
  assert.equal(days[2].energy, '0')
  assert.equal(days[2].commitments.length, 1)
  assert.equal(days[3].transactions, '-1')
  assert.equal(days[3].energy, '-0.1')
  assert.equal(days[4].energy, '0')
  assert.equal(days[4].commitments.length, 0)
})

test('first commitment includes genesis deltas without adding a fake commitment', () => {
  const month = monthlyActivity(history, '2026-10', now)
  assert.equal(month.days[30].transactions, '10')
  assert.equal(month.days[30].energy, '1')
  assert.equal(month.totalCommitments, 1)
  assert.equal(month.days[26].transactions, null)
  assert.equal(month.days[27].transactions, '0')
})

test('unindexed and future dates are distinct from zero activity', () => {
  const month = monthlyActivity(history, '2026-11', now)
  assert.equal(month.days[19].transactions, '0')
  assert.equal(month.days[20].transactions, null)
  assert.equal(month.days[20].energy, null)
  const clipped = monthlyActivity(history, '2026-11', Date.parse('2026-11-02T12:00:00Z'))
  assert.equal(clipped.days[2].transactions, null)
})

test('month boundaries include leap years and year rollover', () => {
  assert.equal(monthlyActivity(history, '2028-02', now).days.length, 29)
  assert.equal(monthlyActivity(history, '2027-02', now).days.length, 28)
  assert.equal(shiftMonth('2026-12', 1), '2027-01')
  assert.equal(shiftMonth('2026-01', -1), '2025-12')
  assert.throws(() => monthlyActivity(history, '2026-13'), /valid month/)
})

test('heat scale distinguishes no data, zero, positive values, and negative magnitudes', () => {
  assert.equal(heatLevel(null, '10'), -1)
  assert.equal(heatLevel('0', '10'), 0)
  assert.equal(heatLevel('0.001', '10'), 1)
  assert.equal(heatLevel('10', '10'), 5)
  assert.equal(heatLevel('-10', '10'), 5)
  assert.equal(heatLevel('0', '0'), 0)
})
