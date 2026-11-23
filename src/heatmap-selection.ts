import type { HeatMetric } from './monthly-activity'

export type HeatmapSearch = { month?: string; day?: string; metric?: HeatMetric }

/** Ignore malformed optional view settings; the calendar resolves defaults against loaded history. */
export function parseHeatmapSearch(search: Record<string, unknown>): HeatmapSearch {
  const result: HeatmapSearch = {}
  if (typeof search.month === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(search.month)) result.month = search.month
  if (typeof search.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(search.day)) {
    const date = new Date(`${search.day}T00:00:00Z`)
    if (Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === search.day) {
      if (!result.month) result.month = search.day.slice(0, 7)
      if (search.day.startsWith(`${result.month}-`)) result.day = search.day
    }
  }
  if (search.metric === 'transactions' || search.metric === 'energy') result.metric = search.metric
  return result
}
