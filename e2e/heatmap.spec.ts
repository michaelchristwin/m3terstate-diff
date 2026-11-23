import { test, expect, type Page } from '@playwright/test'
import { event, hash, status, word } from '../tests/event-fixtures'

const api = 'https://ponder.m3ter.ing'
const at = (time: string) => String(Date.parse(time) / 1000)
const events = [
  event(1, [word(0, [['1000', '10']])], { timestamp: at('2026-10-31T23:59:59Z') }),
  event(2, [word(0, [['1500', '12']]), word(1, [['250', '1']])], { timestamp: at('2026-11-01T00:00:00Z') }),
  event(3, [word(0, [['1700', '15']])], { timestamp: at('2026-11-01T23:59:59Z') }),
  event(4, [word(1, [['500', '3']])], { timestamp: at('2026-11-02T00:00:00Z') }),
]
async function mockHistory(page: Page, data = events) {
  await page.route(`${api}/v1/status`, route => route.fulfill({ json: { ...status, lastSuccessfulPoll: '2026-11-20T10:00:00Z' } }))
  await page.route(`${api}/v1/events?*`, route => route.fulfill({ json: { data, page: 1, offset: 1000, hasMore: false } }))
}

test('calendar sums commitments by day and switches transaction and energy heat', async ({ page }) => {
  await mockHistory(page)
  await page.goto('/heatmap')
  await expect(page.getByRole('heading', { name: 'November 2026' })).toBeVisible()
  await expect(page.locator('.calendar-day')).toHaveCount(30)
  await expect(page.getByTestId('month-transactions')).toHaveText('8')
  await expect(page.getByTestId('month-energy')).toHaveText('1.2 kWh')
  await expect(page.getByTestId('month-commitments')).toHaveText('3')
  const first = page.locator('[data-day="2026-11-01"]')
  await expect(first).toHaveAttribute('data-value', '6')
  await first.click()
  const detail = page.getByRole('complementary', { name: 'Selected day commitments' })
  await expect(detail.getByRole('heading', { name: '2 state commitments' })).toBeVisible()
  await expect(detail.locator('.commitment-list li')).toHaveCount(2)
  await expect(detail.getByRole('link').first()).toHaveAttribute('href', `https://sepolia.etherscan.io/tx/${hash(2)}`)
  await page.getByRole('button', { name: 'Energy (kWh)', exact: true }).click()
  await expect(first).toHaveAttribute('data-value', '0.95')
  await expect(page.locator('[data-day="2026-11-02"]')).toHaveAttribute('data-value', '0.25')
  await expect(page.locator('[data-day="2026-11-03"]')).toHaveAttribute('data-value', '0')
  await expect(page.locator('[data-day="2026-11-21"]')).toHaveAttribute('data-value', 'unavailable')
  await page.screenshot({ path: 'test-results/commitment-heatmap.png', fullPage: true })
})

test('month navigation reaches genesis and reuses history when returning to the Diff page', async ({ page }) => {
  let calls = 0
  page.on('request', request => { if (request.url().includes('/v1/events?')) calls++ })
  await mockHistory(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '1 record differs.' })).toBeVisible()
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Heatmap' }).click()
  await expect(page.getByRole('heading', { name: 'November 2026' })).toBeVisible()
  await page.getByRole('button', { name: 'Previous month' }).click()
  await expect(page.getByRole('heading', { name: 'October 2026' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Previous month' })).toBeDisabled()
  await expect(page.locator('[data-day="2026-10-31"]')).toHaveAttribute('data-value', '10')
  await page.getByRole('button', { name: 'Next month' }).click()
  await expect(page.getByRole('button', { name: 'Next month' })).toBeDisabled()
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Diff', exact: true }).click()
  await expect(page.getByRole('heading', { name: '1 record differs.' })).toBeVisible()
  expect(calls).toBe(1)
})

test('supports keyboard day selection, quiet and unavailable days, and a mobile calendar', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mockHistory(page)
  await page.goto('/heatmap')
  const first = page.locator('[data-day="2026-11-01"]')
  await first.focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.locator('[data-day="2026-11-02"]')).toBeFocused()
  const detail = page.getByRole('complementary', { name: 'Selected day commitments' })
  await expect(detail.getByRole('heading', { name: '2 Nov 2026' })).toBeVisible()
  await page.locator('[data-day="2026-11-03"]').click()
  await expect(detail).toContainText('No state commitments recorded on this day.')
  await page.locator('[data-day="2026-11-21"]').click()
  await expect(detail).toContainText('No indexed data for this day.')
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
  await page.screenshot({ path: 'test-results/commitment-heatmap-mobile.png', fullPage: true })
})

test('empty history and API failures never appear as zero-filled successful calendars', async ({ page }) => {
  await mockHistory(page, [])
  await page.goto('/heatmap')
  await expect(page.getByRole('status')).toContainText('No indexed commitments yet')
  await expect(page.locator('.calendar-day')).toHaveCount(0)
  await page.route(`${api}/v1/events?*`, route => route.fulfill({ status: 503, json: { detail: 'Indexer unavailable' } }))
  await page.getByRole('button', { name: 'Refresh history' }).click()
  await expect(page.getByRole('alert')).toContainText('Indexer unavailable')
  await expect(page.locator('.calendar-day')).toHaveCount(0)
})
