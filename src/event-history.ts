import Decimal from 'decimal.js'
import type { Event as IndexedEvent, Meter, Status } from './client/types.gen'
import type { DiffResult, RowDiff } from './diff'

export type StateChange = { event: IndexedEvent; diff: DiffResult }
export type StateHistory = { states: StateChange[]; status: Status }
export type StateReference = Pick<IndexedEvent, 'chainId' | 'transactionHash'> &
  Partial<Pick<IndexedEvent, 'blockNumber' | 'logIndex' | 'timestamp'>> & { isGenesis?: boolean }

// Static zero baseline supplied for the first indexed commit. No API lookup is needed.
export const GENESIS_STATE: StateReference = {
  chainId: '11155111',
  transactionHash: '0xaeb2af588768e5fce1e407e673d38500a2992282b8ea36d46f9ad864c5216161',
  blockNumber: '12010691',
  timestamp: '1793170956', // 2026-10-28 07:02:36 UTC
  isGenesis: true,
}

const decimal = (value: unknown): value is string => typeof value === 'string' && /^\d+$/.test(value)
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object'
const hash = (value: unknown) => typeof value === 'string' && /^0x[\da-f]{64}$/.test(value)

export function isStatus(value: unknown): value is Status {
  return object(value) && decimal(value.chainId) && decimal(value.fromBlock) &&
    decimal(value.nextBlock) && (value.scannedThrough === null || decimal(value.scannedThrough)) &&
    (value.lastBlockHash === null || hash(value.lastBlockHash)) &&
    typeof value.address === 'string' && typeof value.topic0 === 'string' &&
    typeof value.updatedAt === 'string' &&
    (value.lastError === null || typeof value.lastError === 'string')
}

export function isEvent(value: unknown): value is IndexedEvent {
  return object(value) && decimal(value.chainId) && decimal(value.blockNumber) &&
    decimal(value.timestamp) && decimal(value.logIndex) && hash(value.transactionHash) &&
    hash(value.blockHash) && Array.isArray(value.words) && value.words.length > 0 &&
    value.words.every(word => object(word) && decimal(word.slot) && decimal(word.word) &&
      Array.isArray(word.meters) && word.meters.length === 4 &&
      word.meters.every((meter, lane) => object(meter) && decimal(meter.meterId) &&
        BigInt(meter.meterId) === BigInt(word.slot as string) * 4n + BigInt(lane) &&
        BigInt(meter.meterId) <= 17179869183n &&
        decimal(meter.accountWh) && BigInt(meter.accountWh) <= 1099511627775n &&
        decimal(meter.nonce) && BigInt(meter.nonce) <= 16777215n))
}

export function compareEventOrder(a: IndexedEvent, b: IndexedEvent) {
  const block = BigInt(a.blockNumber) - BigInt(b.blockNumber)
  const order = block || BigInt(a.logIndex) - BigInt(b.logIndex)
  return order < 0n ? -1 : order > 0n ? 1 : 0
}

/** Replay sparse word replacements. Absent lanes retain their last accepted values. */
export function replayEvents(events: IndexedEvent[]): StateChange[] {
  const meters = new Map<string, Meter>()
  return events.map((event, index) => {
    if (index && compareEventOrder(events[index - 1], event) >= 0) {
      throw new Error('The API returned duplicate or out-of-order events. Refresh history.')
    }
    // A slot may be replaced more than once in an event; its last replacement wins.
    const replacements = new Map<string, Meter>()
    for (const word of event.words) for (const meter of word.meters) replacements.set(meter.meterId, meter)
    const rows: RowDiff[] = []
    for (const [meterId, current] of replacements) {
      const previous = meters.get(meterId) ?? { meterId, accountWh: '0', nonce: '0' }
      meters.set(meterId, current)
      if (BigInt(previous.accountWh) === BigInt(current.accountWh) && BigInt(previous.nonce) === BigInt(current.nonce)) continue
      const values = (meter: Meter) => [meterId, new Decimal(meter.accountWh).div(1000).toFixed(), meter.nonce]
      // Meter identity is stable even when sparse words arrive in a different order.
      rows.push({ index: Number(meterId), status: 'changed', left: values(previous), right: values(current) })
    }
    rows.sort((a, b) => a.index - b.index)
    return { event, diff: { rows, differentIndices: rows.map(row => row.index),
      counts: { equal: 0, changed: rows.length, added: 0, removed: 0 } } }
  })
}

export function transactionUrl(event: Pick<IndexedEvent, 'chainId' | 'transactionHash'>) {
  const hosts: Record<string, string> = { '1': 'https://etherscan.io', '11155111': 'https://sepolia.etherscan.io' }
  const host = hosts[event.chainId]
  return host ? `${host}/tx/${encodeURIComponent(event.transactionHash)}` : undefined
}
