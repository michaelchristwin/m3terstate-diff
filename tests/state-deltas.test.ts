import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compareInputs } from '../src/diff'
import { formatDelta, rowDeltas, stateTotals } from '../src/state-deltas'

test('signed transaction and energy deltas use exact decimals', () => {
  const rows = compareInputs('0,0.1,10\n1,0.2,20', '0,0.3,12\n1,0.1,17').rows
  const first = rowDeltas(rows[0])!
  assert.equal(formatDelta(first.energy, true), '+0.2')
  assert.equal(formatDelta(first.transactions, true), '+2')
  const total = stateTotals(rows)
  assert.equal(formatDelta(total.energy), '0.1')
  assert.equal(formatDelta(total.transactions), '-1')
})

test('totals include changed rows only and handle empty comparisons', () => {
  const rows = compareInputs('0,10,1\n1,20,2', '0,11,3\n1,20,2\n2,100,100').rows
  assert.equal(rowDeltas(rows[1]), null)
  assert.equal(rowDeltas(rows[2]), null)
  assert.equal(formatDelta(stateTotals(rows).energy), '1')
  assert.equal(formatDelta(stateTotals(rows).transactions), '2')
  assert.equal(formatDelta(stateTotals([]).energy), '0')
})

test('invalid energy is unavailable rather than a misleading partial total', () => {
  const rows = compareInputs('0,invalid,1', '0,2,2').rows
  assert.equal(formatDelta(stateTotals(rows).energy), 'Unavailable')
  assert.equal(formatDelta(stateTotals(rows).transactions), '1')
})
