import { createFileRoute } from '@tanstack/react-router'
import { MonthlyHeatmap } from '#/components/MonthlyHeatmap'
import { parseHeatmapSearch } from '#/heatmap-selection'

export const Route = createFileRoute('/')({ validateSearch: parseHeatmapSearch, component: MonthlyHeatmap })
