import { test } from 'node:test'
import assert from 'node:assert/strict'
import { proposalToCsv } from '../src/proposal-csv'
import { compareInputs, parseRows } from '../src/diff'

test('proposal conversion fixes column order and preserves escaped values', () => {
  const csv = proposalToCsv([{ nonce: 2, account: 'a,"b"\nc', m3ter_no: 1 }])
  assert.deepEqual(parseRows(csv), [['m3ter_no', 'account', 'nonce'], ['1', 'a,"b"\nc', '2']])
})

test('empty proposals retain the header for comparison', () => {
  const result = compareInputs(proposalToCsv([]), proposalToCsv([{ m3ter_no: 1, account: '10.1', nonce: 2 }]))
  assert.deepEqual(result.differentIndices, [1])
  assert.equal(result.rows[1].status, 'added')
})

test('invalid proposal payloads throw instead of looking like empty comparisons', () => {
  for (const value of [undefined, null, {}, [null], [{ m3ter_no: 1 }]]) {
    assert.throws(() => proposalToCsv(value), /invalid state/)
  }
})
