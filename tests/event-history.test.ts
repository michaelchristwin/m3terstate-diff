import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isEvent, replayEvents, transactionUrl } from '../src/event-history'
import { formatDelta, stateTotals } from '../src/state-deltas'
import { event, hash, word } from './event-fixtures'

test('sparse events preserve untouched meters and omit unchanged and zero lanes', () => {
  const states = replayEvents([
    event(1, [word(0, [['100', '1'], ['500', '2']])]),
    event(2, [word(2, [['200', '1']])]),
    event(3, [word(0, [['300', '3'], ['500', '2']])]),
  ])
  assert.deepEqual(states[2].diff.rows, [{ index: 0, status: 'changed', left: ['0', '0.1', '1'], right: ['0', '0.3', '3'] }])
  assert.equal(formatDelta(stateTotals(states[2].diff.rows).energy), '0.2')
  assert.equal(formatDelta(stateTotals(states[2].diff.rows).transactions), '2')
})

test('compare by meter identity, sort numeric IDs, and retain exact Wh conversion', () => {
  const states = replayEvents([
    event(1, [word(3, [['1099511627774', '16777214']]), word(1, [['1', '1']])]),
    event(2, [word(1, [['3', '2']]), word(3, [['1099511627775', '16777215']])]),
  ])
  assert.deepEqual(states[1].diff.differentIndices, [4, 12])
  assert.equal(formatDelta(stateTotals(states[1].diff.rows).energy), '0.003')
})

test('zero is a replacement, new meters start at zero, and duplicate slots use final replacement', () => {
  const states = replayEvents([
    event(1, [word(0, [['100', '1']])]),
    event(2, [word(0, [['200', '2']]), word(0), word(1, [['300', '3']])]),
  ])
  assert.deepEqual(states[1].diff.rows.map(row => [row.left, row.right]), [
    [['0', '0.1', '1'], ['0', '0', '0']], [['4', '0', '0'], ['4', '0.3', '3']],
  ])
  assert.equal(formatDelta(stateTotals(states[1].diff.rows).energy), '0.2')
})

test('no-op commits produce an empty diff', () => {
  assert.deepEqual(replayEvents([event(1), event(2, event(1).words)])[1].diff.rows, [])
})

test('same transaction and block can have multiple ordered logs', () => {
  const first = event(1)
  const second = event(2, undefined, { blockNumber: '1', logIndex: '1', transactionHash: first.transactionHash })
  assert.equal(replayEvents([first, second])[1].diff.rows[0].right?.[2], '2')
  assert.throws(() => replayEvents([second, first]), /out-of-order/)
  assert.throws(() => replayEvents([first, first]), /duplicate/)
})

test('REST validators reject malformed lanes and unsafe numeric payloads', () => {
  assert.ok(isEvent(event(1)))
  for (const value of [null, {}, { ...event(1), words: [] },
    { ...event(1), words: [{ ...word(0), meters: word(0).meters.slice(1) }] },
    event(1, [word(0, [['NaN', '1']])]), event(1, [word(0, [['1099511627776', '1']])]),
    event(1, [{ ...word(0), slot: '2' }]),
  ]) assert.equal(isEvent(value), false)
})

test('transaction links use the indexed chain', () => {
  assert.equal(transactionUrl(event(1)), `https://sepolia.etherscan.io/tx/${hash(1)}`)
  assert.equal(transactionUrl(event(1, undefined, { chainId: '1' })), `https://etherscan.io/tx/${hash(1)}`)
  assert.equal(transactionUrl(event(1, undefined, { chainId: '999' })), undefined)
})
