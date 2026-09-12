import { useEffect, useMemo, useRef, useState } from 'react'
import { compareInputs } from '#/diff'
import type { DiffResult } from '#/diff'
import { formatDelta, stateTotals } from '#/state-deltas'
import { RowTooltip } from './RowTooltip'

const preferenceKey = 'm3ters-diff:only-differences'
const pageSize = 100

export function Comparison({ oldValue, newValue }: { oldValue: string; newValue: string }) {
  const [onlyDifferences, setOnlyDifferences] = useState(() => {
    try { return localStorage.getItem(preferenceKey) === 'true' } catch { return false }
  })
  const [tooltip, setTooltip] = useState<{ index: number; x: number; y: number } | null>(null)
  const [page, setPage] = useState(0)
  const [activeDifference, setActiveDifference] = useState(-1)
  const rowRefs = useRef(new Map<number, HTMLTableRowElement>())
  const result = useMemo(() => compareInputs(oldValue, newValue), [oldValue, newValue])
  // CSV headers become table headings, not a data record in the viewer.
  const records = useMemo(() => result.rows.slice(1), [result])
  const totals = useMemo(() => stateTotals(records), [records])
  const tooltipRow = tooltip ? records.find(row => row.index === tooltip.index) : undefined
  const differences = useMemo(() => records.filter(row => row.status !== 'equal'), [records])
  const visible = useMemo(() => onlyDifferences ? differences : records, [records, differences, onlyDifferences])
  const pages = Math.max(1, Math.ceil(visible.length / pageSize))
  const currentPage = Math.min(page, pages - 1)
  const targetIndex = differences[activeDifference]?.index

  useEffect(() => {
    try { localStorage.setItem(preferenceKey, String(onlyDifferences)) } catch { /* Storage can be unavailable. */ }
  }, [onlyDifferences])

  useEffect(() => {
    if (onlyDifferences || targetIndex === undefined) return
    rowRefs.current.get(targetIndex)?.scrollIntoView({ block: 'center', behavior: 'instant' })
  }, [targetIndex, currentPage, onlyDifferences])

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
  useEffect(() => { setTooltip(null) }, [currentPage, onlyDifferences])

  function navigateDifference(direction: number) {
    const next = activeDifference + direction
    const row = differences[next]
    if (!row) return
    setActiveDifference(next)
    setPage(Math.floor(records.findIndex(record => record.index === row.index) / pageSize))
  }

  return <>
    {tooltip && tooltipRow && <RowTooltip row={tooltipRow} x={tooltip.x} y={tooltip.y} />}
    <section className="results" aria-label="Comparison results">
      <div className="results-heading"><div><div className="eyebrow">COMPARISON RESULTS</div><h2 aria-live="polite">{differences.length ? `${differences.length.toLocaleString()} ${differences.length === 1 ? 'record differs' : 'records differ'}.` : 'These states match.'}</h2></div><button className="secondary" onClick={() => exportResult(result)}>Export JSON ↓</button></div>
      <div id="stats">{(['changed', 'added'] as const).map(status => <div key={status} className={`stat ${status}`}><strong>{records.filter(row => row.status === status).length.toLocaleString()}</strong><span>{status === 'changed' ? 'Changed' : 'Added'}</span></div>)}<div className="stat transactions"><strong>{formatDelta(totals.transactions)}</strong><span>Total Transactions</span></div><div className="stat energy"><strong>{formatDelta(totals.energy)}</strong><span>Total kWh</span></div></div>
      <div className="table-toolbar"><label className="check"><input type="checkbox" checked={onlyDifferences} onChange={event => { setOnlyDifferences(event.target.checked); setPage(0); setActiveDifference(-1) }} />Differences only</label><span id="range">Exported indices are 0-based and include the CSV header.</span></div>
      <div className="table-wrap">
        {visible.length ? <table className="state-table">
          <colgroup><col className="meter-col" /><col /><col className="nonce-col" /><col className="gap-col" /><col /><col className="nonce-col" /></colgroup>
          <thead><tr><th scope="col" rowSpan={2}>m3ter_no</th><th scope="colgroup" colSpan={2}>Previous state</th><th className="state-gap" rowSpan={2} aria-hidden="true" /><th scope="colgroup" colSpan={2}>Newer state</th></tr><tr><th scope="col">Account</th><th scope="col">Nonce</th><th scope="col">Account</th><th scope="col">Nonce</th></tr></thead>
          <tbody>{visible.slice(currentPage * pageSize, (currentPage + 1) * pageSize).map(row => <tr key={row.index} data-record-index={row.index}
            tabIndex={row.status === 'changed' ? 0 : undefined}
            aria-describedby={tooltip?.index === row.index ? 'row-delta-tooltip' : undefined}
            onMouseEnter={event => { if (row.status === 'changed') setTooltip({ index: row.index, x: event.clientX, y: event.clientY }) }}
            onMouseMove={event => { if (row.status === 'changed') setTooltip({ index: row.index, x: event.clientX, y: event.clientY }) }}
            onMouseLeave={() => setTooltip(null)}
            onFocus={event => { if (row.status === 'changed') { const rect = event.currentTarget.getBoundingClientRect(); setTooltip({ index: row.index, x: rect.left, y: rect.top }) } }}
            onBlur={() => setTooltip(null)} onKeyDown={event => { if (event.key === 'Escape') setTooltip(null) }} ref={node => { if (node) rowRefs.current.set(row.index, node); else rowRefs.current.delete(row.index) }} className={`${row.status}${row.index === targetIndex ? ' active-difference' : ''}`}>
            <th scope="row">{row.left && row.right && row.left[0] !== row.right[0] ? `${row.left[0]} → ${row.right[0]}` : (row.left?.[0] ?? row.right?.[0])}</th>
            <td>{row.left?.[1] ?? '—'}</td><td>{row.left?.[2] ?? '—'}</td>
            <td className="state-gap" aria-hidden="true" />
            <td>{row.right?.[1] ?? '—'}</td><td>{row.right?.[2] ?? '—'}</td>
          </tr>)}</tbody>
        </table> : <div className="empty">{onlyDifferences ? 'No differences to show.' : 'These states contain no meter records.'}</div>}
      </div>
      <div className="pagination"><button className="secondary" disabled={currentPage === 0} onClick={() => { setPage(currentPage - 1); setActiveDifference(-1) }}>← Previous</button><span>Page {currentPage + 1} of {pages} · {visible.length.toLocaleString()} records</span><button className="secondary" disabled={currentPage >= pages - 1} onClick={() => { setPage(currentPage + 1); setActiveDifference(-1) }}>Next →</button></div>
      <details><summary>Developer output <span>JSON</span></summary><pre>{JSON.stringify({ differentIndices: result.differentIndices, counts: result.counts }, null, 2)}</pre></details>
    </section>
    {!onlyDifferences && <nav className="diff-navigation" aria-label="Difference navigation">
      <button className="secondary" disabled={activeDifference <= 0} onClick={() => navigateDifference(-1)}>↑ Previous difference</button>
      <span role="status">{differences.length ? `${activeDifference + 1} of ${differences.length} differences` : 'No differences'}</span>
      <button className="primary" disabled={activeDifference >= differences.length - 1} onClick={() => navigateDifference(1)}>Next difference ↓</button>
    </nav>}
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
