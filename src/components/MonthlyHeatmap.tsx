import { useEffect, useMemo, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useLocation, useNavigate, useSearch } from '@tanstack/react-router'
import { commitmentKey } from '#/diff-selection'
import { parseHeatmapSearch, type HeatmapSearch } from '#/heatmap-selection'
import { queries } from '#/queries'
import type { StateHistory } from '#/event-history'
import { transactionUrl } from '#/event-history'
import { dayLabel, heatLevel, historyRange, monthLabel, monthlyActivity, shiftMonth } from '#/monthly-activity'
import type { HeatMetric } from '#/monthly-activity'
import { AppHeader } from './AppHeader'

export function MonthlyHeatmap() {
  const history = useQuery(queries.getHistory())
  return <>
    <AppHeader page="heatmap" />
    <main className="activity-main">
      <div className="intro activity-intro">
        <div className="eyebrow">STATE COMMITMENT ACTIVITY</div>
        <h1>Commitments,<br /><span>day by day.</span></h1>
        <p>A month of transaction and energy totals.<br />Every commitment combined into its UTC day.</p>
      </div>
      <div className="activity-source">
        <span>Daily totals across all state commitments</span>
        <button className="secondary" disabled={history.isFetching} onClick={() => void history.refetch()}>{history.isFetching ? 'Loading history…' : 'Refresh history'}</button>
      </div>
      {history.error ? <div className="error" role="alert">
        <p>Unable to load commitment activity. {history.error.message}</p>
        <button className="secondary" onClick={() => void history.refetch()}>Retry</button>
      </div> : history.isPending ? <section className="results empty" role="status">Loading commitment activity…</section>
        : !history.data.states.length ? <section className="results empty" role="status">No indexed commitments yet. Daily activity will appear after the first commitment.</section>
        : <ActivityMonth history={history.data} />}
      <footer><span>m3ters / Activity</span><span>State data from ponder.m3ter.ing · All times UTC</span></footer>
    </main>
  </>
}

function ActivityMonth({ history }: { history: StateHistory }) {
  const search = parseHeatmapSearch(useSearch({ strict: false }))
  const navigate = useNavigate()
  const path = useLocation({ select: location => location.pathname === '/heatmap' ? '/heatmap' as const : '/' as const })
  const requestedMonth = search.month
  const metric = search.metric ?? 'transactions'
  const cells = useRef(new Map<string, HTMLButtonElement>())
  const range = useMemo(() => historyRange(history), [history])
  const firstMonth = range.firstDay.slice(0, 7), lastMonth = range.lastDay.slice(0, 7)
  const month = requestedMonth && requestedMonth >= firstMonth && requestedMonth <= lastMonth ? requestedMonth : lastMonth
  const { data, error } = useMemo(() => {
    try { return { data: monthlyActivity(history, month), error: null } }
    catch (error) { return { data: null, error: error instanceof Error ? error.message : 'Unable to calculate daily activity.' } }
  }, [history, month])
  const selectedDay = data && (data.days.find(day => day.date === search.day) ?? [...data.days].reverse().find(day => day.commitments.length > 0) ?? data.days.find(day => day.transactions !== null) ?? data.days[0])
  const selectedDate = selectedDay?.date
  // Make automatic defaults shareable too, without adding a redundant browser history entry.
  useEffect(() => {
    if (selectedDate && (search.month !== month || search.day !== selectedDate || search.metric !== metric)) {
      void navigate({ to: path, search: { month, day: selectedDate, metric }, replace: true, resetScroll: false })
    }
  }, [month, selectedDate, metric, search.month, search.day, search.metric, navigate, path])
  if (!data || !selectedDay) return <div className="error" role="alert">{error}</div>
  const view = { month, day: selectedDay.date, metric }
  function updateView(next: HeatmapSearch) {
    void navigate({ to: path, search: next, resetScroll: false })
  }
  function selectDay(day: string) {
    if (day !== selectedDate) updateView({ ...view, day })
  }
  function setMetric(value: HeatMetric) {
    if (value !== metric) updateView({ ...view, metric: value })
  }
  const leadingDays = (new Date(`${month}-01T00:00:00Z`).getUTCDay() + 6) % 7
  const trailingDays = (7 - (leadingDays + data.days.length) % 7) % 7
  const label = metric === 'transactions' ? 'Transactions' : 'Energy'
  const unit = metric === 'transactions' ? 'tx' : 'kWh'
  const negative = data.days.some(day => day[metric]?.startsWith('-'))

  function changeMonth(value: string) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value) || value < firstMonth || value > lastMonth) return
    updateView({ month: value, metric })
  }
  return <>
    <section className="activity-controls" aria-label="Heatmap controls">
      <div className="month-picker">
        <button className="secondary" aria-label="Previous month" disabled={month === firstMonth} onClick={() => changeMonth(shiftMonth(month, -1))}>‹</button>
        <label><span>Month</span><input type="month" aria-label="Month" value={month} min={firstMonth} max={lastMonth} onChange={event => changeMonth(event.target.value)} /></label>
        <button className="secondary" aria-label="Next month" disabled={month === lastMonth} onClick={() => changeMonth(shiftMonth(month, 1))}>›</button>
      </div>
    </section>
    <div className="activity-stats" aria-label="Month summary">
      <div><span>Transactions this month</span><strong data-testid="month-transactions">{data.totalTransactions}</strong><small>Summed across all commitments</small></div>
      <div><span>Cumulative energy this month</span><strong data-testid="month-energy">{data.totalEnergy}<span> kWh</span></strong><small>Sum of energy deltas</small></div>
      <div><span>State commitments</span><strong data-testid="month-commitments">{data.totalCommitments}</strong><small>Across {data.activeDays} active {data.activeDays === 1 ? 'day' : 'days'}</small></div>
    </div>
    <div className="calendar-layout">
      <section className={`results calendar-panel metric-${metric}`} aria-label="Daily commitment heatmap">
        <div className="results-heading"><div><div className="eyebrow">{label.toUpperCase()} PER UTC DAY</div><h2>{monthLabel(month)}</h2></div><span className="calendar-zone">UTC</span></div>
        <div className="calendar-metric-controls">
          <div className="metric-switch" role="group" aria-label="Heat metric">
            <button aria-pressed={metric === 'transactions'} onClick={() => setMetric('transactions')}>Transaction count</button>
            <button aria-pressed={metric === 'energy'} onClick={() => setMetric('energy')}>Energy (kWh)</button>
          </div>
        </div>
        <p className="calendar-description">{metric === 'transactions' ? 'Total nonce changes across every commitment that day.' : 'Total energy changes across every commitment that day, in kWh.'}</p>
        <div className="calendar-weekdays" aria-hidden="true">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <span key={day}>{day}</span>)}</div>
        <div className="calendar-grid" role="group" aria-label={`${monthLabel(month)} daily ${label.toLowerCase()}`}>
          {Array.from({ length: leadingDays }, (_, i) => <div className="calendar-spacer" key={`before-${i}`} aria-hidden="true" />)}
          {data.days.map((day, index) => {
            const level = heatLevel(day[metric], data.max[metric])
            const available = day[metric] !== null
            const cellLabel = `${dayLabel(day.date)}: ${available ? `${day.transactions} transactions, ${day.energy} kWh, ${day.commitments.length} commitments` : 'No indexed data'}`
            return <button key={day.date} data-day={day.date} data-value={day[metric] ?? 'unavailable'}
              ref={node => { if (node) cells.current.set(day.date, node); else cells.current.delete(day.date) }}
              className={`calendar-day heat-${level < 0 ? 'unavailable' : level}${day[metric]?.startsWith('-') ? ' heat-negative' : ''}`}
              aria-label={cellLabel} aria-pressed={selectedDay.date === day.date} title={cellLabel}
              onClick={() => selectDay(day.date)}
              onKeyDown={event => {
                const delta: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
                if (!(event.key in delta)) return
                event.preventDefault()
                const target = data.days[index + delta[event.key]]
                if (target) { cells.current.get(target.date)?.focus(); selectDay(target.date) }
              }}>
              <span className="calendar-date">{Number(day.date.slice(-2))}</span>
              <strong>{day[metric] ?? '—'}</strong>
              <span className="calendar-unit">{available ? unit : 'No data'}</span>
              {day.commitments.length > 0 && <span className="commit-marker" aria-hidden="true">{day.commitments.length} {day.commitments.length === 1 ? 'commit' : 'commits'}</span>}
            </button>
          })}
          {Array.from({ length: trailingDays }, (_, i) => <div className="calendar-spacer" key={`after-${i}`} aria-hidden="true" />)}
        </div>
        <div className="heatmap-legend" aria-label="Heatmap scale"><span>0</span><div className="heat-swatches">{[0, 1, 2, 3, 4, 5].map(level => <i key={level} className={`heat-${level}`} />)}</div><span>{data.max[metric]} {unit}</span><span className="legend-unavailable"><i className="heat-unavailable" />No indexed data</span>{negative && <span className="legend-unavailable"><i className="heat-negative" />Negative correction</span>}</div>
        <p className="coverage-note">History through {dayLabel(data.lastDay)} UTC. The latest day may be partial.</p>
      </section>
      <aside className="commitment-detail" aria-label="Selected day commitments">
        <div className="eyebrow">SELECTED DAY</div><h2>{dayLabel(selectedDay.date)}</h2>
        {selectedDay.transactions === null ? <p className="detail-empty">No indexed data for this day.</p> : <>
          <dl className="day-totals"><div><dt>Transactions</dt><dd>{selectedDay.transactions}</dd></div><div><dt>Energy</dt><dd>{selectedDay.energy} <small>kWh</small></dd></div></dl>
          <h3>{selectedDay.commitments.length} state {selectedDay.commitments.length === 1 ? 'commitment' : 'commitments'}</h3>
          {selectedDay.commitments.length ? <ol className="commitment-list">{selectedDay.commitments.map(({ event, transactions, energy, changedMeters }) => {
            const href = transactionUrl(event)
            const shortHash = `${event.transactionHash.slice(0, 10)}…${event.transactionHash.slice(-6)}`
            return <li key={`${event.transactionHash}:${event.logIndex}`}>
              <div className="commitment-time"><time>{new Date(Number(event.timestamp) * 1000).toLocaleTimeString('en-GB', { timeZone: 'UTC', hour12: false })} UTC</time><span>Log {event.logIndex}</span></div>
              {href ? <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`View commitment ${event.transactionHash}, log ${event.logIndex} on Etherscan (opens in a new tab)`}>{shortHash}<span aria-hidden="true"> ↗</span></a> : <code>{shortHash}</code>}
              <div className="commitment-values"><span>{transactions} tx</span><span>{energy} kWh</span></div>
              <small>{changedMeters} changed {changedMeters === 1 ? 'meter' : 'meters'}</small>
              <Link className="commitment-diff-link" to="/diff" search={{ ...view, commit: commitmentKey(event) }} aria-label={`View diff for commitment ${event.transactionHash}, log ${event.logIndex}`}>View diff<span aria-hidden="true">→</span></Link>
            </li>
          })}</ol> : <p className="detail-empty">No state commitments recorded on this day.</p>}
        </>}
      </aside>
    </div>
    <p className="activity-footnote">Daily totals sum the same transaction and energy deltas shown on the Diff page, including the first commitment compared with genesis. Negative values represent corrections. Days are based on commitment time, not individual meter transaction times.</p>
  </>
}
