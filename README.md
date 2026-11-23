# m3ters / Diff

A React + Vite workbench showing only the meter changes between adjacent indexed commits. History comes from the REST API at https://ponder.m3ter.ing; the app no longer uses Ponder SQL/GraphQL or m3terscan snapshots.

## Run

Requires Node.js 22.12+ (or a supported newer release), pnpm 10+, and Bun for unit tests.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open http://localhost:3000. Development and preview both use port 3000. The API must allow the deployed site's origin through CORS.

## REST integration

The checked-in `openapi.json` was downloaded from https://ponder.m3ter.ing/openapi.json. `src/client` is generated from this local schema with Hey API. Development and builds work without contacting the schema endpoint. To update it deliberately:

```sh
curl -fLsS https://ponder.m3ter.ing/openapi.json -o openapi.json
pnpm generate-client
```

The workbench uses:

- `GET /v1/status` to bound history to the indexed `fromBlock` and `scannedThrough` watermark.
- `GET /v1/events?fromBlock=…&toBlock=…&sort=asc&page=…&offset=1000` to read ordered commit events, including their decoded `words[].meters[]`.
- A second status read to detect an indexer change during loading. Inconsistent history, malformed responses, and API problem details are surfaced with Retry. No comparison is presented as successful when loading fails.

Pagination follows `hasMore`. At a page boundary, the loader advances the inclusive lower block bound and deduplicates already loaded logs; multiple pages within one block remain supported. This avoids the API's deep page-offset limit. TanStack Query caches the loaded history, so navigating between adjacent states makes no extra requests. **Refresh history** performs fresh GET requests. On `/diff`, the latest pair updates automatically; a URL targeting a specific commitment keeps that selection.

The API does not promise a transactionally consistent snapshot across requests. The bounded scan, overlap checks, and status checks detect observable changes, but cannot guarantee consistency against an undetectable concurrent rewrite. Retry after indexing settles if history changes during loading.

## Diff behavior

Events are sparse word replacements, not complete snapshots. The app replays them in `(blockNumber, logIndex)` order and remembers the last value of each meter by `meterId`. Meters absent from an event retain their prior values. All four lanes are applied, including zero values; unchanged lanes never appear in the diff. If a word repeats within one commit, the last replacement wins.

The static genesis state is [the supplied Sepolia transaction](https://sepolia.etherscan.io/tx/0xaeb2af588768e5fce1e407e673d38500a2992282b8ea36d46f9ad864c5216161), configured in `src/event-history.ts`. Every meter in the first diff has account and nonce values of zero on the genesis side. Its static block is `12010691`, with timestamp `2026-10-28 07:02:36 UTC`. Block times are displayed in UTC. The genesis log index has not been supplied and is labeled “Not specified”; it is distinct from the block number. No extra network request is made for genesis. The initial baseline is also zero for meters with no earlier replacement in the configured indexed stream. Accurate historical values therefore depend on the indexer's `fromBlock` covering the contract's initial history. Current-meter endpoints are not used to reconstruct historical states.

- On the Diff page (`/diff`), the latest two commits are selected initially. **Compare previous state** walks backward through adjacent pairs; **Back to latest** resets the selection. A static genesis state precedes the first indexed commit, so a single indexed commit is enough to compare. History counts include genesis when commits are available.
- The table and JSON download contain only changed meters. There is no full-snapshot toggle or persisted filter setting. Matching states have an explicit empty result.
- Values from `accountWh` are converted from whole watt-hours to kWh with decimal arithmetic. Nonces remain decimal strings.
- Changed meters are sorted by numeric meter ID and paginated in groups of 100. Totals include every change, including first updates from zero, independent of the current table page.
- Hover or focus a changed row to see transaction and energy deltas, calculated as newer minus previous. Escape dismisses the tooltip.
- The API describes a fixed meter address space, so zero-to-value and value-to-zero transitions are changes, not additions or removals. The visible cards are Changed, Total Transactions, and Total kWh.
- Commit cards identify the block, log index, and chain. Transaction links use Ethereum or Sepolia Etherscan according to `chainId`; other chains show the hash without an assumed explorer URL. The API does not return the transaction sender.

JSON retains `rows`, `differentIndices`, and `counts`. For REST diffs, `index` and `differentIndices` are **meter IDs**, not CSV line numbers. Each row's `left` and `right` are `[meterId, accountKWh, nonce]`. Only `changed` rows are exported; the other count fields remain zero for compatibility with the shared result type.

## Daily commitment heatmap

The default page (`/`) is the heatmap; `/heatmap` remains available as an alias. Open **Diff** in the navigation to compare commitments at `/diff`. The heatmap shows a monthly calendar with one cell per UTC day, aggregating all state commitments recorded that day. There are no per-meter heatmaps.

- **Transaction count** sums nonce deltas across every changed meter in every commitment that day.
- **Energy (kWh)** sums energy deltas across the same commitments. It is the day's combined energy change, not a sum of cumulative meter snapshots or a running lifetime total. The monthly energy card sums the daily totals.
- The first commitment includes its comparison against the static zero genesis state. Genesis itself is not counted as a state commitment.
- The Transaction count / Energy toggle sits inside the heatmap panel. Select a day to inspect its totals and commitment breakdown, including Etherscan links and a **View diff** link for every commitment. Hover for exact totals; keyboard users can focus days and navigate with arrow keys.
- Month navigation is bounded by genesis and the loaded history. A day with no commitments has zero activity. Dates before genesis or beyond the latest indexed coverage are hatched as unavailable; the latest covered day may be partial.
- The color scale is shared across the month for the chosen metric. Negative corrections are preserved and use a separate color. No-op commitments are still listed even when their deltas are zero.
- Both pages share the cached REST history. Switching pages or months makes no extra API request; **Refresh history** explicitly reloads it.

## Shareable commitment diffs

Each **View diff** link opens `/diff?commit=<transactionHash>:<logIndex>`, with the colon URL-encoded when generated by the router. Both fields identify the commitment, including when one transaction emits multiple logs. The page compares that commitment against its immediate predecessor; the first commitment uses genesis.

The URL preserves selection on direct visits, reloads, browser back/forward navigation, and history refreshes. **Compare previous state** updates the URL to the previous commitment. **Back to latest** clears the selection and returns to `/diff`. Invalid identifiers and commitments missing from the indexed history show an explicit error with a link back to the latest diff.

## Reusable CSV comparison module

`src/diff.ts` remains independent of React and the REST integration. It accepts CSV or text and compares records by position. Its indices are still zero-based record positions (including CSV headers). It is built into `dist/lib/` with declarations and requires Papa Parse when consumed separately. The app's REST comparisons use identity-based replay in `src/event-history.ts` instead.

## Validation and output

```sh
pnpm test
pnpm typecheck
pnpm exec playwright install chromium
pnpm test:e2e
pnpm build
```

Unit tests cover sparse replay, exact units, zero lanes, order and identity, REST pagination, cancellation, consistency checks, and malformed/error responses, alongside the reusable CSV and delta modules. Browser tests mock the REST endpoints and cover navigation, caching, refresh, loading, retry, matching states, diff-only exports, pagination, tooltips, and mobile layout.

`dist/` is a static production build ready for a static host. Configure SPA fallback to `index.html` so direct visits and reloads at `/diff` and `/heatmap` work. `dist/lib/` contains the reusable comparison module. History is replayed in browser memory; table pagination limits rendered rows, not history download or replay memory.

The delivery ZIP includes the source, generated client, local OpenAPI schema, lockfile, tests, and `dist/`. It excludes `node_modules`, Git metadata, caches, test artifacts, and local environment files.
