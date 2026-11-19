import { test, expect, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { event, hash, status, word } from '../tests/event-fixtures'
import type { Event as IndexedEvent } from '../src/client/types.gen'

const api = 'https://ponder.m3ter.ing'
const events = [event(1), event(2), event(3)]
async function mockHistory(page: Page, data: IndexedEvent[] = events) {
  await page.route(`${api}/v1/status`, route => route.fulfill({ json: status }))
  await page.route(`${api}/v1/events?*`, route => route.fulfill({ json: { data, page: 1, offset: 1000, hasMore: false } }))
}

test('compares and exports only diffs, walks history, and reuses cached history', async ({ page }) => {
  const requested: string[] = []
  page.on('request', request => { if (request.url().startsWith(api)) requested.push(request.url()) })
  await mockHistory(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '1 record differs.' })).toBeVisible()
  await expect(page.locator('tbody tr')).toHaveCount(1)
  await expect(page.locator('tr.equal')).toHaveCount(0)
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export JSON' }).click()
  const result = JSON.parse(await readFile((await (await downloadPromise).path())!, 'utf8'))
  expect(result.differentIndices).toEqual([0])
  expect(result.rows).toHaveLength(1)
  expect(result.rows[0].left).toEqual(['0', '2', '2'])
  expect(result.rows[0].right).toEqual(['0', '3', '3'])
  expect(result.rows.every((row: { status: string }) => row.status === 'changed')).toBe(true)
  await page.getByRole('button', { name: 'Compare previous state' }).click()
  await expect(page.getByText('3 states in history · Comparing 1 and 2')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Compare previous state' })).toBeDisabled()
  await page.getByRole('button', { name: 'Back to latest' }).click()
  await expect(page.getByText('3 states in history · Comparing 2 and 3')).toBeVisible()
  expect(requested.filter(url => url.includes('/v1/events'))).toHaveLength(1)
  await page.screenshot({ path: 'test-results/rest-workbench.png', fullPage: true })
})

test('waits for history before rendering and handles matching states', async ({ page }) => {
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  await mockHistory(page)
  await page.route(`${api}/v1/events?*`, async route => {
    await gate
    await route.fulfill({ json: { data: [event(1), event(2, event(1).words)], page: 1, offset: 1000, hasMore: false } })
  })
  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText('Loading states…')
  await expect(page.getByRole('button', { name: 'Export JSON' })).toHaveCount(0)
  release()
  await expect(page.getByRole('heading', { name: 'These states match.' })).toBeVisible()
  await expect(page.getByText('No differences to show.')).toBeVisible()
  await expect(page.locator('tbody tr')).toHaveCount(0)
})

test('insufficient history shows a helpful empty state', async ({ page }) => {
  await mockHistory(page, events.slice(0, 1))
  await page.goto('/')
  await expect(page.getByRole('status')).toContainText('At least two states')
  await expect(page.getByRole('button', { name: 'Compare previous state' })).toBeDisabled()
})

test('REST errors surface problem details and allow retry', async ({ page }) => {
  let fail = true
  await mockHistory(page)
  await page.route(`${api}/v1/events?*`, route => route.fulfill(fail ?
    { status: 503, json: { detail: 'Indexer replay in progress' } } :
    { json: { data: events, page: 1, offset: 1000, hasMore: false } }))
  await page.goto('/')
  await expect(page.getByRole('alert')).toContainText('Indexer replay in progress')
  await expect(page.getByRole('button', { name: 'Export JSON' })).toHaveCount(0)
  fail = false
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.getByRole('heading', { name: '1 record differs.' })).toBeVisible()
})

test('refresh uses GET, incorporates new commits, and resets to the latest pair', async ({ page }) => {
  let gets = 0
  let fresh = false
  await mockHistory(page)
  await page.route(`${api}/v1/events?*`, route => {
    expect(route.request().method()).toBe('GET')
    gets++
    return route.fulfill({ json: { data: fresh ? [...events, event(4)] : events, page: 1, offset: 1000, hasMore: false } })
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '1 record differs.' })).toBeVisible()
  await page.getByRole('button', { name: 'Compare previous state' }).click()
  fresh = true
  await page.getByRole('button', { name: 'Refresh history' }).click()
  await expect(page.getByText('4 states in history · Comparing 3 and 4')).toBeVisible()
  expect(gets).toBe(2)
})

test('malformed history displays an error', async ({ page }) => {
  await mockHistory(page)
  await page.route(`${api}/v1/events?*`, route => route.fulfill({ json: { data: [{}], page: 1, offset: 1000, hasMore: false } }))
  await page.goto('/')
  await expect(page.getByRole('alert')).toContainText('invalid state history')
})

test('diff-only display ignores old localStorage preference and has no snapshot controls', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('m3ters-diff:only-differences', 'false'))
  await mockHistory(page, [event(1, [word(0, [['100', '10'], ['300', '2']])]), event(2, [word(0, [['300', '8'], ['300', '2']])])])
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '1 record differs.' })).toBeVisible()
  await expect(page.locator('tbody tr')).toHaveCount(1)
  await expect(page.getByRole('checkbox')).toHaveCount(0)
  await expect(page.getByRole('navigation', { name: 'Difference navigation' })).toHaveCount(0)
  const row = page.locator('tr.changed')
  await row.hover()
  await expect(page.getByRole('tooltip')).toContainText('Transaction diff: -2')
  await expect(page.getByRole('tooltip')).toContainText('Energy diff: +0.2 kWh')
  await row.focus()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('tooltip')).toHaveCount(0)
  await page.reload()
  await expect(page.locator('tbody tr')).toHaveCount(1)
})

test('paginates changed meters, keeps complete totals, and uses Sepolia links', async ({ page }) => {
  const before = Array.from({ length: 51 }, (_, i) => word(i, [['100', '1'], ['100', '1'], ['100', '1'], ['100', '1']]))
  const after = Array.from({ length: 51 }, (_, i) => word(i, [['101', '2'], ['101', '2'], ['100', '1'], ['100', '1']]))
  await mockHistory(page, [event(1, before), event(2, after)])
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '102 records differ.' })).toBeVisible()
  await expect(page.locator('tbody tr')).toHaveCount(100)
  await expect(page.locator('.stat.transactions strong')).toHaveText('102')
  await expect(page.locator('.stat.energy strong')).toHaveText('0.102')
  const link = page.getByRole('link', { name: `View transaction ${hash(2)} on Etherscan (opens in a new tab)` })
  await expect(link).toHaveAttribute('href', `https://sepolia.etherscan.io/tx/${hash(2)}`)
  await expect(link).toHaveAttribute('target', '_blank')
  await page.getByRole('button', { name: 'Next →', exact: true }).click()
  await expect(page.locator('tbody tr')).toHaveCount(2)
  await expect(page.getByText('Page 2 of 2 · 102 records')).toBeVisible()
  await expect(page.locator('.stat.energy strong')).toHaveText('0.102')
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
  await page.screenshot({ path: 'test-results/rest-mobile.png', fullPage: true })
})

test('sparse unrelated updates retain earlier meter values and same-transaction logs are distinct states', async ({ page }) => {
  await mockHistory(page, [
    event(1, [word(0, [['100', '1']])]),
    event(2, [word(2, [['500', '3']])]),
    event(3, [word(0, [['200', '2']])], { blockNumber: '2', transactionHash: hash(2), logIndex: '1' }),
  ])
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '1 record differs.' })).toBeVisible()
  const cells = page.locator('tbody tr td')
  await expect(cells.nth(0)).toHaveText('0.1')
  await expect(cells.nth(3)).toHaveText('0.2')
  await expect(page.locator('.stat.energy strong')).toHaveText('0.1')
})
