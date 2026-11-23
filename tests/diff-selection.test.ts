import { test } from 'node:test'
import assert from 'node:assert/strict'
import { commitmentKey, parseDiffSearch } from '../src/diff-selection'
import { hash } from './event-fixtures'

test('diff links distinguish logs within a transaction and normalize their identifiers', () => {
  assert.notEqual(commitmentKey({ transactionHash: hash(1), logIndex: '0' }), commitmentKey({ transactionHash: hash(1), logIndex: '1' }))
  const transactionHash = `0x${'AB'.repeat(32)}`
  assert.deepEqual(parseDiffSearch({ commit: `${transactionHash}:0002` }), { commit: `${transactionHash.toLowerCase()}:2` })
  assert.deepEqual(parseDiffSearch({ commit: `${hash(1)}:9007199254740993` }), { commit: `${hash(1)}:9007199254740993` })
  assert.deepEqual(parseDiffSearch({}), {})
})

test('malformed diff links never silently select the latest commitment', () => {
  for (const commit of ['', null, 1, [], {}, hash(1), `${hash(1)}:-1`, `${hash(1)}:1.5`, `${hash(1)}:0:1`, 'invalid:0']) {
    assert.throws(() => parseDiffSearch({ commit }), /Invalid diff link/)
  }
})
