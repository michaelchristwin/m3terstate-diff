import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseHeatmapSearch } from '../src/heatmap-selection'
import { parseDiffSearch } from '../src/diff-selection'
import { hash } from './event-fixtures'

test('heatmap URLs retain valid view settings and infer a month from a day', () => {
  const view = { month: '2026-11', day: '2026-11-01', metric: 'energy' }
  assert.deepEqual(parseHeatmapSearch(view), view)
  assert.deepEqual(parseHeatmapSearch({ day: view.day, metric: view.metric }), view)
  assert.deepEqual(parseDiffSearch({ ...view, commit: `${hash(2)}:0` }), { ...view, commit: `${hash(2)}:0` })
  assert.deepEqual(parseDiffSearch(view), view)
})

test('heatmap URLs reject impossible dates, conflicting months, and malformed view settings', () => {
  for (const day of ['2026-02-29', '2026-11-31', '2026-13-01', 'not-a-date', [], 1]) {
    assert.deepEqual(parseHeatmapSearch({ day }), {})
  }
  assert.deepEqual(parseHeatmapSearch({ month: '2026-10', day: '2026-11-01' }), { month: '2026-10' })
  assert.deepEqual(parseHeatmapSearch({ month: '2026-13', metric: 'unknown' }), {})
  assert.deepEqual(parseHeatmapSearch({ day: '2028-02-29' }), { month: '2028-02', day: '2028-02-29' })
})
