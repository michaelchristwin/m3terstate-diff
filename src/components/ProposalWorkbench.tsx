import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queries } from '#/queries'
import type { RecentBlocks } from '#/queries'
import { Comparison } from './Comparison'

export function ProposalWorkbench() {
  // One offset keeps the two adjacent selections together.
  const [offset, setOffset] = useState(1)
  const queryClient = useQueryClient()
  const history = useQuery(queries.getRecentBlocks())
  const blocks = history.data ?? []
  const newBlock = blocks[blocks.length - offset]
  const oldBlock = blocks[blocks.length - offset - 1]
  const newProposal = useQuery({
    ...queries.getProposals(newBlock?.hash ?? ''), enabled: !!newBlock && !!oldBlock,
  })
  const oldProposal = useQuery({
    ...queries.getProposals(oldBlock?.hash ?? ''), enabled: !!newBlock && !!oldBlock,
  })
  const refresh = useMutation({
    ...queries.refreshRecentBlocks(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queries.getRecentBlocks().queryKey })
      setOffset(1)
    },
  })
  const isLoading = history.isLoading || newProposal.isLoading || oldProposal.isLoading
  const error = history.error ?? oldProposal.error ?? newProposal.error
  const ready = !!oldBlock && !!newBlock && oldProposal.isSuccess && newProposal.isSuccess
  const canGoBack = offset + 1 < blocks.length

  const nextState = () => {
    if (canGoBack) setOffset((value) => value + 1)
  }
  const retry = () => {
    if (history.isError) void history.refetch()
    if (oldProposal.isError) void oldProposal.refetch()
    if (newProposal.isError) void newProposal.refetch()
  }

  return <>
    <header><a className="brand" href="./"><span className="mark">≠</span>m3ters<span className="muted"> / </span>Diff</a><span className="local"><i />State history explorer</span></header>
    <main>
      <div className="intro"><div className="eyebrow">THE STATE COMPARISON WORKBENCH</div><h1>State changes.<br /><span>Nothing missed.</span></h1><p>Two states. One clear view of what changed.<br />Meter records, compared side by side.</p></div>
      <section className="inputs" aria-label="Selected states">
        <ProposalCard label="Previous state" number="01" block={oldBlock} loading={oldProposal.isLoading} />
        <ProposalCard label="Newer state" number="02" block={newBlock} loading={newProposal.isLoading} />
      </section>
      <div className="controls">
        <span className="history-caption">{history.isLoading ? 'Loading state history…' : `${blocks.length} states in history${oldBlock ? ` · Comparing ${blocks.length - offset} and ${blocks.length - offset + 1}` : ''}`}</span>
        <div className="actions">
          {offset > 1 && <button className="secondary" onClick={() => setOffset(1)} disabled={refresh.isPending}>Back to latest</button>}
          <button className="secondary" onClick={() => refresh.mutate()} disabled={refresh.isPending || history.isFetching}>{refresh.isPending ? 'Refreshing…' : 'Refresh history'}</button>
          <button className="primary" onClick={nextState} disabled={!canGoBack || isLoading || refresh.isPending}>Compare previous state <span>←</span></button>
        </div>
      </div>
      <p className="note">Compared by position · CSV headers are included in exports · Inserted rows can shift subsequent comparisons{!canGoBack && blocks.length >= 2 ? ' · Beginning of history reached' : ''}</p>
      {refresh.isError && <p className="error" role="alert">History refresh failed. {errorMessage(refresh.error)}</p>}
      {error ? <div className="error" role="alert"><p>Unable to load the comparison. {errorMessage(error)}</p><button className="secondary" onClick={retry}>Retry</button></div> :
        isLoading ? <section className="results empty" role="status">Loading states…</section> :
        blocks.length < 2 ? <section className="results empty" role="status">At least two states are needed to compare states. Try refreshing history.</section> :
        ready ? <Comparison key={`${oldBlock.hash}:${newBlock.hash}`} oldValue={oldProposal.data} newValue={newProposal.data} /> :
        <section className="results empty">This pair is no longer available. <button className="secondary" onClick={() => setOffset(1)}>Back to latest</button></section>}
      <footer><span>m3ters / Diff</span><span>State data from m3terscan · Comparison runs in your browser</span></footer>
    </main>
  </>
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'The API request failed. Please try again.'
}

function ProposalCard({ label, number, block, loading }: { label: string; number: string; block?: RecentBlocks; loading: boolean }) {
  return <article className="input-card">
    <div className="card-heading"><span><span className="badge">{number}</span>{label}</span><span className="state-status">{loading ? 'Loading…' : block ? (block.transaction_status ? 'Successful transaction' : 'Failed transaction') : 'Unavailable'}</span></div>
    <div className="state-meta"><span className="eyebrow">TRANSACTION HASH</span><code>{block?.hash ?? 'Waiting for state history…'}</code><dl><div><dt>Block time</dt><dd>{block?.block_time ?? '—'}</dd></div><div><dt>From</dt><dd>{block?.from ?? '—'}</dd></div></dl></div>
  </article>
}
