import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { queries } from "#/queries";
import { GENESIS_STATE, transactionUrl } from "#/event-history";
import type { StateReference } from "#/event-history";
import { Comparison } from "./Comparison";

export function ProposalWorkbench() {
  const history = useQuery(queries.getHistory());
  const [offset, setOffset] = useState(1);
  const states = history.data?.states ?? [];
  const newState = states[states.length - offset];
  const oldState = states[states.length - offset - 1];
  const newBlock = newState?.event;
  const oldBlock: StateReference | undefined = oldState?.event ?? (newState ? GENESIS_STATE : undefined);
  const isLoading = history.isPending;
  const canGoBack = offset < states.length;
  const nextState = () => { if (canGoBack) setOffset(value => value + 1); };
  const refresh = async () => {
    const result = await history.refetch();
    if (result.isSuccess) setOffset(1);
  };

  return (
    <>
      <header>
        <a className="brand" href="./">
          <span className="mark">≠</span>m3ters
          <span className="muted"> / </span>Diff
        </a>
        <span className="local">
          <i />
          State history explorer
        </span>
      </header>
      <main>
        <div className="intro">
          <div className="eyebrow">THE STATE COMPARISON WORKBENCH</div>
          <h1>
            State changes.
            <br />
            <span>Nothing missed.</span>
          </h1>
          <p>
            Two states. One clear view of what changed.
            <br />
            Meter records, compared side by side.
          </p>
        </div>
        <section className="inputs" aria-label="Selected states">
          <ProposalCard
            label={oldBlock?.isGenesis ? "Genesis state" : "Previous state"}
            number="01"
            block={oldBlock}
            loading={isLoading}
          />
          <ProposalCard
            label="Newer state"
            number="02"
            block={newBlock}
            loading={isLoading}
          />
        </section>
        <div className="controls">
          <span className="history-caption">
            {history.isLoading
              ? "Loading state history…"
              : `${states.length ? states.length + 1 : 0} states in history${oldBlock ? ` · Comparing ${states.length - offset + 1} and ${states.length - offset + 2}` : ""}`}
          </span>
          <div className="actions">
            {offset > 1 && (
              <button
                className="secondary"
                onClick={() => setOffset(1)}
                disabled={history.isPending}
              >
                Back to latest
              </button>
            )}
            <button
              className="secondary"
              onClick={() => void refresh()}
              disabled={history.isPending || history.isRefetching}
            >
              {history.isRefetching ? "Refreshing…" : "Refresh history"}
            </button>
            <button
              className="primary"
              onClick={nextState}
              disabled={!canGoBack || isLoading || history.isFetching}
            >
              Compare previous state <span>←</span>
            </button>
          </div>
        </div>
        {history.error ? (
          <div className="error" role="alert">
            <p>Unable to load the comparison. {errorMessage(history.error)}</p>
            <button className="secondary" onClick={() => void refresh()}>Retry</button>
          </div>
        ) : isLoading ? (
          <section className="results empty" role="status">Loading states…</section>
        ) : states.length === 0 ? (
          <section className="results empty" role="status">
            No indexed commits yet. The first commit will be compared with genesis. Try refreshing history.
          </section>
        ) : oldBlock && newState ? (
          <Comparison key={`${newBlock?.transactionHash}:${newBlock?.logIndex}`} result={newState.diff} />
        ) : (
          <section className="results empty">
            This pair is no longer available.{" "}
            <button className="secondary" onClick={() => setOffset(1)}>Back to latest</button>
          </section>
        )}
        <footer>
          <span>m3ters / Diff</span>
          <span>
            State data from ponder.m3ter.ing · Comparison runs in your browser
          </span>
        </footer>
      </main>
    </>
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "The API request failed. Please try again.";
}

function ProposalCard({
  label,
  number,
  block,
  loading,
}: {
  label: string;
  number: string;
  block?: StateReference;
  loading: boolean;
}) {
  return (
    <article className="input-card">
      <div className="card-heading">
        <span>
          <span className="badge">{number}</span>
          {label}
        </span>
        <span className="state-status">
          {loading ? "Loading…" : block?.isGenesis ? "Zero baseline" : block ? "Indexed commit" : "Unavailable"}
        </span>
      </div>
      <div className="state-meta">
        <span className="eyebrow">TRANSACTION HASH</span>
        {block && transactionUrl(block) ? (
          <a
            className="transaction-link"
            href={transactionUrl(block)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`View transaction ${block.transactionHash} on Etherscan (opens in a new tab)`}
          >
            <code>{block.transactionHash}</code>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M14 3h7v7M10 14 21 3M21 14v7H3V3h7" />
            </svg>
          </a>
        ) : (
          <code>{block?.transactionHash ?? "Waiting for state history…"}</code>
        )}
        <dl>
          <div>
            <dt>Block time</dt>
            <dd>
              {block?.timestamp
                ? `${new Date(Number(block.timestamp) * 1000).toLocaleString('en-GB', {
                    timeZone: 'UTC', year: 'numeric', month: 'short', day: '2-digit',
                    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
                  })} UTC`
                : "—"}
            </dd>
          </div>
          <div>
            <dt>Block</dt>
            <dd>{block?.blockNumber ?? "—"}</dd>
          </div>
          <div>
            <dt>Log index</dt>
            <dd>{block?.logIndex ?? (block?.isGenesis ? "Not specified" : "—")}</dd>
          </div>
          <div>
            <dt>Network</dt>
            <dd>{block?.chainId === "11155111" ? "Sepolia" : block?.chainId === "1" ? "Ethereum" : block?.chainId ?? "—"}</dd>
          </div>
        </dl>
      </div>
    </article>
  );
}
