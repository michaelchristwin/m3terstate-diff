import type { Event as IndexedEvent, Status, Word } from '../src/client/types.gen'

export const hash = (n: number) => `0x${n.toString(16).padStart(64, '0')}`
export const status: Status = {
  chainId: '11155111', address: `0x${'a'.repeat(40)}`, topic0: hash(123),
  fromBlock: '1', nextBlock: '10001', scannedThrough: '10000', lastBlockHash: hash(10000),
  observedHead: '10064', lastSuccessfulPoll: '2026-11-19T00:00:00Z', lastError: null,
  updatedAt: '2026-11-19T00:00:00Z',
}
export function word(slot: number, values: [string, string][] = []): Word {
  return { slot: String(slot), word: '0', meters: Array.from({ length: 4 }, (_, lane) => ({
    meterId: String(slot * 4 + lane), accountWh: values[lane]?.[0] ?? '0', nonce: values[lane]?.[1] ?? '0',
  })) as Word['meters'] }
}
export function event(n: number, words: Word[] = [word(0, [[String(n * 1000), String(n)]])], overrides: Partial<IndexedEvent> = {}): IndexedEvent {
  return {
    chainId: status.chainId, address: status.address, topics: [status.topic0], data: '0x', updates: '0x',
    blockNumber: String(n), blockHash: hash(n + 100), timestamp: String(1795046400 + n * 12),
    transactionHash: hash(n), transactionIndex: '0', logIndex: '0', words, ...overrides,
  }
}
