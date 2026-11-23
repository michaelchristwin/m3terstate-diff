import type { Event as IndexedEvent } from './client/types.gen'
import { parseHeatmapSearch, type HeatmapSearch } from './heatmap-selection'

export type DiffSearch = HeatmapSearch & { commit?: string }

/** A transaction can emit multiple commitments; the block-wide log index disambiguates them. */
export function commitmentKey(event: Pick<IndexedEvent, 'transactionHash' | 'logIndex'>) {
  return `${event.transactionHash.toLowerCase()}:${BigInt(event.logIndex).toString()}`
}

export function parseDiffSearch(search: Record<string, unknown>): DiffSearch {
  const heatmap = parseHeatmapSearch(search)
  if (search.commit === undefined) return heatmap
  if (typeof search.commit !== 'string' || !/^0x[\da-fA-F]{64}:\d+$/.test(search.commit)) {
    throw new Error('Invalid diff link. The commit parameter must contain a transaction hash and log index separated by a colon.')
  }
  const [transactionHash, logIndex] = search.commit.split(':')
  return { ...heatmap, commit: commitmentKey({ transactionHash, logIndex }) }
}
