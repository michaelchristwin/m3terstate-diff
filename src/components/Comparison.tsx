import { useEffect, useMemo, useRef, useState } from 'react'
import type { DiffResult } from '#/diff'
import { formatDelta, stateTotals } from '#/state-deltas'
import { RowTooltip } from './RowTooltip'

const pageSize = 100

export function Comparison({ result }: { result: DiffResult }) {
  const [tooltip, setTooltip] = useState<{ index: number; x: number; y: number } | null>(null)
  const [page, setPage] = useState(0)
  const rowRefs = useRef(new Map<number, HTMLTableRowElement>())
  const differences = useMemo(() => result.rows.filter(row => row.status !== 'equal'), [result])
  const totals = useMemo(() => stateTotals(differences), [differences])
  const tooltipRow = tooltip ? differences.find(row => row.index === tooltip.index) : undefined
  const pages = Math.max(1, Math.ceil(differences.length / pageSize))
  const currentPage = Math.min(page, pages - 1)

  useEffect(() => {
    if (!tooltip) return
    const reposition = () => {
      const row = rowRefs.current.get(tooltip.index)
      if (!row || !row.matches(':hover, :focus')) { setTooltip(null); return }
      const rect = row.getBoundingClientRect()
      if (rect.bottom <= 0 || rect.top >= window.innerHeight) { setTooltip(null); return }
      setTooltip(current => current ? { ...current, x: rect.left, y: Math.max(0, rect.top) } : null)
    }
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    return () => { window.removeEventListener('scroll', reposition, true); window.removeEventListener('resize', reposition) }
  }, [tooltip?.index])
  useEffect(() => { setTooltip(null) }, [currentPage])

  return <>
    {tooltip && tooltipRow && <RowTooltip row={tooltipRow} x={tooltip.x} y={tooltip.y} />}
    <section className="results" aria-label="Comparison results">
      <div className="results-heading"><div><div className="eyebrow">COMPARISON RESULTS</div><h2 aria-live="polite">{differences.length ? `${differences.length.toLocaleString()} ${differences.length === 1 ? 'record differs' : 'records differ'}.` : 'These states match.'}</h2></div><button className="secondary" onClick={() => exportResult({ ...result, rows: differences })}>Export JSON ↓</button></div>
      <div id="stats"><div className="stat changed"><strong>{differences.length.toLocaleString()}</strong><span>Changed</span></div><div className="stat transactions"><strong>{formatDelta(totals.transactions)}</strong><span>Total Transactions</span></div><div className="stat energy"><strong>{formatDelta(totals.energy)}</strong><span>Total kWh</span></div></div>
      <div className="table-toolbar"><span>Changed meters only</span><span id="range">Account values in kWh</span></div>
      <div className="table-wrap">
        {differences.length ? <table className="state-table">
          <colgroup><col className="meter-col" /><col /><col className="nonce-col" /><col className="gap-col" /><col /><col className="nonce-col" /></colgroup>
          <thead><tr><th scope="col" rowSpan={2}>m3ter_no</th><th scope="colgroup" colSpan={2}>Previous state</th><th className="state-gap" rowSpan={2} aria-hidden="true" /><th scope="colgroup" colSpan={2}>Newer state</th></tr><tr><th scope="col">Account</th><th scope="col">Nonce</th><th scope="col">Account</th><th scope="col">Nonce</th></tr></thead>
          <tbody>{differences.slice(currentPage * pageSize, (currentPage + 1) * pageSize).map(row => <tr key={row.index} data-record-index={row.index}
            tabIndex={row.status === 'changed' ? 0 : undefined}
            aria-describedby={tooltip?.index === row.index ? 'row-delta-tooltip' : undefined}
            onMouseEnter={event => { if (row.status === 'changed') setTooltip({ index: row.index, x: event.clientX, y: event.clientY }) }}
            onMouseMove={event => { if (row.status === 'changed') setTooltip({ index: row.index, x: event.clientX, y: event.clientY }) }}
            onMouseLeave={() => setTooltip(null)}
            onFocus={event => { if (row.status === 'changed') { const rect = event.currentTarget.getBoundingClientRect(); setTooltip({ index: row.index, x: rect.left, y: rect.top }) } }}
            onBlur={() => setTooltip(null)} onKeyDown={event => { if (event.key === 'Escape') setTooltip(null) }} ref={node => { if (node) rowRefs.current.set(row.index, node); else rowRefs.current.delete(row.index) }} className={row.status}>
            <th scope="row">{row.left && row.right && row.left[0] !== row.right[0] ? `${row.left[0]} → ${row.right[0]}` : (row.left?.[0] ?? row.right?.[0])}</th>
            <td>{row.left?.[1] ?? '—'}</td><td>{row.left?.[2] ?? '—'}</td>
            <td className="state-gap" aria-hidden="true" />
            <td>{row.right?.[1] ?? '—'}</td><td>{row.right?.[2] ?? '—'}</td>
          </tr>)}</tbody>
        </table> : <div className="empty">No differences to show.</div>}
      </div>
      <div className="pagination"><button className="secondary" disabled={currentPage === 0} onClick={() => { setPage(currentPage - 1) }}>← Previous</button><span>Page {currentPage + 1} of {pages} · {differences.length.toLocaleString()} records</span><button className="secondary" disabled={currentPage >= pages - 1} onClick={() => { setPage(currentPage + 1) }}>Next →</button></div>
    </section>
  </>
}

function exportResult(result: DiffResult) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'state-diff.json'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
