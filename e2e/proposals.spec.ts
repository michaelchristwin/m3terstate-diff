import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'

const api = 'https://m3terscan-api.onrender.com'
const blocks = [1, 2, 3].map((n) => ({
  hash: `0xproposal${n}`, block_time: `2026-08-0${n} 00:00:00 UTC`,
  from: '0xsender', transaction_status: true,
}))
const proposal = (nonce: number) => [{ m3ter_no: 0, account: '573.099144', nonce }]

test('compares, exports, walks to the history boundary, and reuses cached proposals', async ({ page }) => {
  const requested: string[] = []
  await page.route(`${api}/recent-blocks`, route => route.fulfill({ json: blocks }))
  await page.route(`${api}/proposal/*`, route => {
    requested.push(route.request().url())
    return route.fulfill({ json: proposal(Number(route.request().url().slice(-1))) })
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '1 record differs.' })).toBeVisible()
  await expect(page.locator('textarea')).toHaveCount(0)
  await expect(page.locator('tbody tr')).toHaveCount(1)
  await page.getByLabel('Differences only').check()
  await expect(page.locator('tbody tr')).toHaveCount(1)
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export JSON' }).click()
  const download = await downloadPromise
  const result = JSON.parse(await readFile((await download.path())!, 'utf8'))
  expect(result.differentIndices).toEqual([1])
  expect(result.rows[1].left[2]).toBe('2')
  expect(result.rows[1].right[2]).toBe('3')
  await page.getByRole('button', { name: 'Compare previous state' }).click()
  await expect(page.getByText('3 states in history · Comparing 1 and 2')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Compare previous state' })).toBeDisabled()
  await expect(page.getByRole('heading', { name: '1 record differs.' })).toBeVisible()
  expect(requested.filter(url => url.endsWith('0xproposal2'))).toHaveLength(1)
  await page.getByRole('button', { name: 'Back to latest' }).click()
  await expect(page.getByText('3 states in history · Comparing 2 and 3')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Compare previous state' })).toBeEnabled()
  await page.screenshot({ path: 'test-results/proposal-workbench.png', fullPage: true })
})

test('waits for both proposal states before showing comparison', async ({ page }) => {
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route(`${api}/recent-blocks`, route => route.fulfill({ json: blocks }))
  await page.route(`${api}/proposal/*`, async route => {
    if (route.request().url().endsWith('3')) await gate
    await route.fulfill({ json: proposal(1) })
  })
  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText('Loading states…')
  await expect(page.getByRole('button', { name: 'Export JSON' })).toHaveCount(0)
  release()
  await expect(page.getByRole('heading', { name: 'These states match.' })).toBeVisible()
})

test('insufficient history never requests undefined proposal hashes', async ({ page }) => {
  let requests = 0
  await page.route(`${api}/recent-blocks`, route => route.fulfill({ json: blocks.slice(0, 1) }))
  await page.route(`${api}/proposal/*`, route => { requests++; return route.fulfill({ json: [] }) })
  await page.goto('/')
  await expect(page.getByRole('status')).toContainText('At least two states')
  await expect(page.getByRole('button', { name: 'Compare previous state' })).toBeDisabled()
  expect(requests).toBe(0)
})

test('proposal errors are retryable and do not appear as matching states', async ({ page }) => {
  let fail = true
  await page.route(`${api}/recent-blocks`, route => route.fulfill({ json: blocks }))
  await page.route(`${api}/proposal/*`, route => route.fulfill(fail ?
    { status: 500, json: { detail: 'unavailable' } } : { json: proposal(1) }))
  await page.goto('/')
  await expect(page.getByRole('alert')).toContainText('Unable to load the comparison')
  await expect(page.getByRole('button', { name: 'Export JSON' })).toHaveCount(0)
  fail = false
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'These states match.' })).toBeVisible()
})

test('refresh posts only when clicked and refetches history', async ({ page }) => {
  let posts = 0
  let gets = 0
  await page.route(`${api}/recent-blocks`, route => {
    if (route.request().method() === 'POST') { posts++; return route.fulfill({ json: {} }) }
    gets++
    return route.fulfill({ json: blocks })
  })
  await page.route(`${api}/proposal/*`, route => route.fulfill({ json: proposal(1) }))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'These states match.' })).toBeVisible()
  expect(posts).toBe(0)
  await page.getByRole('button', { name: 'Refresh history' }).click()
  await expect.poll(() => posts).toBe(1)
  await expect.poll(() => gets).toBe(2)
})

test('malformed history displays an error', async ({ page }) => {
  await page.route(`${api}/recent-blocks`, route => route.fulfill({ json: { error: 'bad response' } }))
  await page.goto('/')
  await expect(page.getByRole('alert')).toContainText('invalid state history')
})

test('shared meter column, nonce tooltips, and persistent differences filter', async ({ page }) => {
  await page.route(`${api}/recent-blocks`, route => route.fulfill({ json: blocks }))
  await page.route(`${api}/proposal/*`, route => route.fulfill({ json: [
    { m3ter_no: 12, account: 'a', nonce: route.request().url().endsWith('3') ? 8 : 10 },
    { m3ter_no: 13, account: 'b', nonce: 0 },
  ] }))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '1 record differs.' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'm3ter_no', exact: true })).toHaveCount(1)
  await expect(page.getByRole('columnheader', { name: 'Row', exact: true })).toHaveCount(0)
  await expect(page.locator('#stats .stat')).toHaveCount(3)
  await expect(page.getByText('CSV columns: m3ter_no, account, nonce')).toHaveCount(0)
  const changed = page.locator('tr.changed .status-label')
  await changed.hover()
  await expect(page.getByRole('tooltip')).toHaveText('Nonce difference (newer − previous): -2')
  await page.locator('tr.equal .status-label').focus()
  await page.mouse.move(0, 0)
  await expect(page.getByRole('tooltip')).toHaveText('Nonce difference (newer − previous): 0')
  await page.getByLabel('Differences only').check()
  await expect(page.getByRole('navigation', { name: 'Difference navigation' })).toHaveCount(0)
  await page.reload()
  await expect(page.getByLabel('Differences only')).toBeChecked()
  await expect(page.locator('tbody tr')).toHaveCount(1)
  await page.getByRole('button', { name: 'Compare previous state' }).click()
  await expect(page.getByLabel('Differences only')).toBeChecked()
  await expect(page.getByText('No differences to show.')).toBeVisible()
  await page.getByLabel('Differences only').uncheck()
  await page.reload()
  await expect(page.getByLabel('Differences only')).not.toBeChecked()
  await expect(page.getByRole('navigation', { name: 'Difference navigation' })).toBeVisible()
})

test('sticky navigation visits differences in order across pages', async ({ page }) => {
  await page.route(`${api}/recent-blocks`, route => route.fulfill({ json: blocks }))
  await page.route(`${api}/proposal/*`, route => route.fulfill({ json:
    Array.from({ length: 205 }, (_, i) => ({ m3ter_no: i, account: '10', nonce: route.request().url().endsWith('3') && [1,150,204].includes(i) ? 2 : 1 })),
  }))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '3 records differ.' })).toBeVisible()
  const next = page.getByRole('button', { name: 'Next difference', exact: false })
  const previous = page.getByRole('button', { name: 'Previous difference', exact: false })
  await expect(previous).toBeDisabled()
  for (const index of [2,151,205]) {
    await next.click()
    await expect(page.locator('.active-difference')).toHaveAttribute('data-record-index', String(index))
    await expect(page.locator('.active-difference')).toBeInViewport()
  }
  await expect(next).toBeDisabled()
  await previous.click()
  await expect(page.locator('.active-difference')).toHaveAttribute('data-record-index', '151')
  await expect(page.locator('.active-difference')).toBeInViewport()
  await page.screenshot({ path: 'test-results/state-navigation.png', fullPage: false })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('navigation', { name: 'Difference navigation' })).toBeInViewport()
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
})

test('added and removed rows explain missing nonce deltas', async ({ page }) => {
  await page.route(`${api}/recent-blocks`, route => route.fulfill({ json: blocks }))
  await page.route(`${api}/proposal/*`, route => route.fulfill({ json: route.request().url().endsWith('2') ? [] : proposal(5) }))
  await page.goto('/')
  await page.locator('tr.added .status-label').hover()
  await expect(page.getByRole('tooltip')).toContainText('previous state has no record')
  await page.getByRole('button', { name: 'Compare previous state' }).click()
  await page.locator('tr.removed .status-label').focus()
  await expect(page.getByRole('tooltip')).toContainText('newer state has no record')
  await expect(page.locator('#stats .removed')).toHaveCount(0)
})
