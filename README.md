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

Pagination follows `hasMore`. At a page boundary, the loader advances the inclusive lower block bound and deduplicates already loaded logs; multiple pages within one block remain supported. This avoids the API's deep page-offset limit. TanStack Query caches the loaded history, so navigating between adjacent states makes no extra requests. **Refresh history** performs fresh GET requests and returns to the latest pair.

The API does not promise a transactionally consistent snapshot across requests. The bounded scan, overlap checks, and status checks detect observable changes, but cannot guarantee consistency against an undetectable concurrent rewrite. Retry after indexing settles if history changes during loading.

## Diff behavior

Events are sparse word replacements, not complete snapshots. The app replays them in `(blockNumber, logIndex)` order and remembers the last value of each meter by `meterId`. Meters absent from an event retain their prior values. All four lanes are applied, including zero values; unchanged lanes never appear in the diff. If a word repeats within one commit, the last replacement wins.

The initial baseline is zero for meters with no earlier replacement in the configured indexed stream. Accurate historical values therefore depend on the indexer's `fromBlock` covering the contract's initial history. Current-meter endpoints are not used to reconstruct historical states.

- The latest two commits are selected initially. **Compare previous state** walks backward through adjacent pairs; **Back to latest** resets the selection. At least two indexed commits are required.
- The table and JSON download contain only changed meters. There is no full-snapshot toggle or persisted filter setting. Matching states have an explicit empty result.
- Values from `accountWh` are converted from whole watt-hours to kWh with decimal arithmetic. Nonces remain decimal strings.
- Changed meters are sorted by numeric meter ID and paginated in groups of 100. Totals include every change, including first updates from zero, independent of the current table page.
- Hover or focus a changed row to see transaction and energy deltas, calculated as newer minus previous. Escape dismisses the tooltip.
- The API describes a fixed meter address space, so zero-to-value and value-to-zero transitions are changes, not additions or removals. The visible cards are Changed, Total Transactions, and Total kWh.
- Commit cards identify the block, log index, and chain. Transaction links use Ethereum or Sepolia Etherscan according to `chainId`; other chains show the hash without an assumed explorer URL. The API does not return the transaction sender.

JSON retains `rows`, `differentIndices`, and `counts`. For REST diffs, `index` and `differentIndices` are **meter IDs**, not CSV line numbers. Each row's `left` and `right` are `[meterId, accountKWh, nonce]`. Only `changed` rows are exported; the other count fields remain zero for compatibility with the shared result type.

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

`dist/` is a static production build ready for a static host. `dist/lib/` contains the reusable comparison module. History is replayed in browser memory; table pagination limits rendered rows, not history download or replay memory.

The delivery ZIP includes the source, generated client, local OpenAPI schema, lockfile, tests, and `dist/`. It excludes `node_modules`, Git metadata, caches, test artifacts, and local environment files.
