# m3ters / Diff

A Vite + React state comparison workbench using TanStack Router, TanStack Query, Hey API, and Bun. It loads the two latest proposals from m3terscan, converts their meter records to CSV with `json-2-csv`, and automatically highlights differing records side by side.

## Run

Requires Bun 1.4+ and Node.js 22.12+ for the Vite/tooling executables.

```sh
bun install
bun run dev
```

Open http://localhost:3000 (use `localhost`, not `127.0.0.1`: the API allows localhost ports 3000 and 5173 through CORS). Both development and preview default to port 3000. The TanStack scaffold was created with:

```sh
bunx @tanstack/cli create m3ters-diff --router-only --add-ons tanstack-query
bun add @hey-api/vite-plugin -D
```

The current CLI ignores add-ons in router-only mode, so TanStack Query was installed and wired manually. The app lives in `m3ters-diff/`; run the commands from that directory.

## State workflow

- GET `/recent-blocks` supplies history in API order (oldest first). The last two entries are selected initially.
- `queries.getProposals(txHash)` uses the generated SDK and returns a CSV string. It validates the response and fixes the columns to `m3ter_no,account,nonce`, retaining API record order.
- **Compare previous state** moves both selections one position backward. It is disabled while loading or at the oldest pair. **Back to latest** resets the selection.
- Queries share cached proposal responses by transaction hash. Errors throw and show a retry button; missing hashes never trigger requests.
- **Refresh history** explicitly POSTs `/recent-blocks` via a mutation, then invalidates the history GET query and resets to the latest pair. The API may process its refresh asynchronously; a subsequent refresh may be necessary if its returned history has not updated yet.
- The viewer has a shared meter column, separated state columns, 100-record pagination, and full JSON export. Hover anywhere on a changed row, or focus it with the keyboard, to see transaction (nonce) and energy (account, in kWh) differences on two lines. Both use newer minus previous. Other rows have no tooltip; Escape dismisses it.
- **Differences only** persists in localStorage (and still works if storage is unavailable). When unchecked, the sticky **Previous difference / Next difference** controls scroll through differences across pages.
- Visible cards show Changed, Added, Total Transactions, and Total kWh. Totals sum signed deltas across all changed records, independent of pagination and filtering, using decimal arithmetic. Added/removed records are excluded from totals. Invalid numeric values make the affected total unavailable. Exported row statuses and counts are retained.
- Transaction hashes link to Etherscan in a new tab, with an external-link icon.

## API generation

`openapi-ts.config.ts` uses the requested live schema:

```ts
import { defineConfig } from '@hey-api/openapi-ts'

export default defineConfig({
  input: 'https://m3terscan-api.onrender.com/openapi.json',
  output: 'src/client',
})
```

The Hey API Vite plugin generates the client on development startup and build. Run `bun run generate-client` to regenerate it separately. Generated code in `src/client` should not be edited by hand. Generation requires network access and an available schema endpoint. Browser requests require the API to allow the site's origin through CORS.

## Reusable comparison module

`src/diff.ts` is independent of React and the DOM and works in frontend/backend TypeScript with Papa Parse installed:

```ts
import { compareInputs } from './src/diff'

const result = compareInputs('id,name\n1,Ada', 'id,name\n1,Grace\n2,Lin')
console.log(result.differentIndices) // [1, 2]
// result.rows: { index, status, left, right }[]
// result.counts: { equal, changed, added, removed }
```

Records compare by position, not meter identity or sequence alignment. Headers count at index 0 in exports. The viewer shows only meter records, with a shared `m3ter_no` column; mismatched meter numbers appear as previous → newer. Middle insertions shift subsequent comparisons. CSV fields are decoded before equality checks. BOM and line endings are normalized, a final newline does not add a record, and blank records are retained. Text mode and optional trimming remain available in the module.

## Checks and deployment

```sh
bun run test
bun run typecheck
bunx playwright install chromium
bun run test:e2e
bun run build
```

Unit tests cover comparison rules, CSV conversion and invalid payloads. Browser tests mock API requests to verify navigation, cache reuse, loading, errors/retry, history boundaries, refresh, and export without modifying the live API.

Build output is a static site in `dist/` plus reusable JavaScript/types in `dist/lib/`. Deploy `dist/` to a static host. Browser comparison is synchronous and keeps the parsed proposals in memory; pagination limits DOM size, not parsing memory.
