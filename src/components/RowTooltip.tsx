import { createPortal } from 'react-dom'
import type { RowDiff } from '#/diff'
import { formatDelta, rowDeltas } from '#/state-deltas'

export function RowTooltip({ row, x, y }: { row: RowDiff; x: number; y: number }) {
  const delta = rowDeltas(row)
  if (!delta) return null
  const width = Math.min(340, window.innerWidth - 24)
  return createPortal(<div id="row-delta-tooltip" role="tooltip" className="row-tooltip" style={{
    width, left: Math.max(12, Math.min(x + 12, window.innerWidth - width - 12)),
    top: Math.max(12, Math.min(y + 16, window.innerHeight - 100)),
  }}>
    <div>Transaction diff: {formatDelta(delta.transactions, true)}</div>
    <div>Energy diff: {formatDelta(delta.energy, true)}{delta.energy !== null ? ' kWh' : ''}</div>
  </div>, document.body)
}
