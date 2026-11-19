import { test } from 'node:test'
import assert from 'node:assert/strict'
import { client } from '../src/client/client.gen'
import { loadHistory } from '../src/queries'
import { event, status, word } from './event-fixtures'

function mockApi(handler: (url: URL, request: Request) => unknown | Response) {
  client.setConfig({ fetch: (async (input: RequestInfo | URL) => {
    const request = input as Request
    const result = handler(new URL(request.url), request)
    return result instanceof Response ? result : Response.json(result)
  }) as typeof fetch })
}
const page = (data: unknown[], hasMore = false, number = 1) => ({ data, hasMore, page: number, offset: 1000 })

test('loads bounded REST history, follows hasMore, and deduplicates boundary blocks', async () => {
  const requests: string[] = []
  const a = event(1), b = event(2), c = event(3)
  mockApi(url => {
    requests.push(url.pathname + url.search)
    if (url.pathname === '/v1/status') return status
    assert.equal(url.searchParams.get('toBlock'), '10000')
    assert.equal(url.searchParams.get('sort'), 'asc')
    return url.searchParams.get('fromBlock') === '1' ? page([a, b], true) : page([b, c])
  })
  const result = await loadHistory()
  assert.equal(result.states.length, 3)
  assert.equal(result.states[2].diff.rows[0].left?.[2], '2')
  assert.equal(requests.length, 4)
})

test('paginates within one block without dropping logs or splitting transaction identities', async () => {
  const events = [event(1), event(2, undefined, { blockNumber: '1', logIndex: '1' }), event(3, undefined, { blockNumber: '1', logIndex: '2' })]
  mockApi(url => url.pathname === '/v1/status' ? status :
    url.searchParams.get('page') === '1' ? page(events.slice(0, 2), true) : page(events.slice(2), false, 2))
  assert.equal((await loadHistory()).states.length, 3)
})

test('returns no states for empty completed history', async () => {
  mockApi(url => url.pathname === '/v1/status' ? status : page([]))
  assert.equal((await loadHistory()).states.length, 0)
})

test('does not silently accept malformed or unordered history', async () => {
  for (const payload of [{}, page([{}]), page([], true), page([event(2), event(1)]),
    page([event(1, [word(0, [['invalid', '2']])])])]) {
    mockApi(url => url.pathname === '/v1/status' ? status : payload)
    await assert.rejects(loadHistory(), /invalid|inconsistent/)
  }
})

test('surfaces problem details and indexer errors', async () => {
  mockApi(() => Response.json({ detail: 'Database unavailable' }, { status: 503 }))
  await assert.rejects(loadHistory(), /Database unavailable/)
  mockApi(() => ({ ...status, lastError: 'Replay failed' }))
  await assert.rejects(loadHistory(), /Replay failed/)
  mockApi(() => ({ ...status, scannedThrough: null }))
  await assert.rejects(loadHistory(), /first scan/)
})

test('rejects history changed during pagination or replay', async () => {
  let reads = 0
  mockApi(url => url.pathname === '/v1/status' ? { ...status, updatedAt: String(reads++) } : page([event(1)]))
  await assert.rejects(loadHistory(), /changed while loading/)
  mockApi(url => url.pathname === '/v1/status' ? status : url.searchParams.get('fromBlock') === '1' ?
    page([event(1), event(2)], true) : page([event(2, [word(0, [['999', '2']])])]))
  await assert.rejects(loadHistory(), /changed while loading/)
})

test('passes cancellation through the generated client', async () => {
  const controller = new AbortController()
  controller.abort()
  mockApi((_url, request) => { request.signal.throwIfAborted(); return status })
  await assert.rejects(loadHistory(controller.signal), /abort/i)
})
