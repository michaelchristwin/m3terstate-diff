import { queryOptions } from '@tanstack/react-query'
import { client } from './client/client.gen'
import { getIndexerStatus, listEvents } from './client/sdk.gen'
import type { Event as IndexedEvent } from './client/types.gen'
import { compareEventOrder, isEvent, isStatus, replayEvents } from './event-history'
import type { StateHistory } from './event-history'

export const INDEXER_API = 'https://ponder.m3ter.ing'
client.setConfig({ baseUrl: INDEXER_API })

function apiError(error: unknown): Error {
  if (error instanceof Error) return error
  const problem = error as { detail?: unknown; title?: unknown } | null
  const message = problem?.detail ?? problem?.title
  return new Error(typeof message === 'string' ? message : 'The indexer request failed. Please try again.')
}

async function readStatus(signal?: AbortSignal) {
  const { data } = await getIndexerStatus({ signal, throwOnError: true })
  if (!isStatus(data)) throw new Error('The API returned an invalid indexer status.')
  if (data.lastError) throw new Error(`The indexer is not ready: ${data.lastError}`)
  return data
}

/** Fetch a bounded history before replaying; never treat current meters as historical snapshots. */
export async function loadHistory(signal?: AbortSignal): Promise<StateHistory> {
  try {
    const status = await readStatus(signal)
    if (status.scannedThrough === null) throw new Error('The indexer has not completed its first scan. Try refreshing history.')
    const events: IndexedEvent[] = []
    const seen = new Map<string, IndexedEvent>()
    // The API limits page offsets. Advance the block window at page boundaries instead.
    let fromBlock = status.fromBlock
    let page = 1
    let last: IndexedEvent | undefined
    while (true) {
      const { data: response } = await listEvents({
        query: { fromBlock, toBlock: status.scannedThrough, sort: 'asc', page, offset: 1000 },
        signal, throwOnError: true,
      })
      if (!response || !Array.isArray(response.data) || !response.data.every(isEvent) ||
        response.page !== page || response.offset !== 1000 || typeof response.hasMore !== 'boolean' ||
        (response.hasMore && response.data.length === 0)) {
        throw new Error('The API returned an invalid state history.')
      }
      let previousInPage: IndexedEvent | undefined
      for (const event of response.data) {
        if (event.chainId !== status.chainId || event.address !== status.address ||
          BigInt(event.blockNumber) < BigInt(fromBlock) || BigInt(event.blockNumber) > BigInt(status.scannedThrough) ||
          (previousInPage && compareEventOrder(previousInPage, event) >= 0)) {
          throw new Error('The API returned inconsistent state history. Refresh history.')
        }
        previousInPage = event
        // Inclusive block pagination repeats the boundary block, but never applies an event twice.
        if (last && compareEventOrder(last, event) >= 0) {
          const existing = seen.get(`${event.blockNumber}:${event.logIndex}`)
          if (!existing || JSON.stringify(existing) !== JSON.stringify(event)) {
            throw new Error('Indexed history changed while loading. Refresh history.')
          }
          continue
        }
        events.push(event)
        seen.set(`${event.blockNumber}:${event.logIndex}`, event)
      }
      if (!response.hasMore) break
      const newest = events.at(-1)
      if (!newest || (last && compareEventOrder(last, newest) >= 0 && page > 1000)) {
        throw new Error('The API did not advance state history. Try refreshing history.')
      }
      last = newest
      if (fromBlock !== newest.blockNumber) {
        fromBlock = newest.blockNumber
        page = 1
      } else {
        if (page >= 1001) throw new Error('A single block exceeds the API pagination limit.')
        page++
      }
    }
    const after = await readStatus(signal)
    if (status.updatedAt !== after.updatedAt || status.scannedThrough !== after.scannedThrough ||
      status.lastBlockHash !== after.lastBlockHash || status.fromBlock !== after.fromBlock ||
      status.chainId !== after.chainId || status.address !== after.address) {
      throw new Error('Indexed history changed while loading. Refresh history to compare a consistent history.')
    }
    return { status, states: replayEvents(events) }
  } catch (error) { throw apiError(error) }
}

export const queries = {
  getHistory: () => queryOptions({
    queryKey: ['state-history', INDEXER_API],
    staleTime: 60_000,
    queryFn: ({ signal }) => loadHistory(signal),
  }),
}
