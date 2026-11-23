import { createFileRoute } from '@tanstack/react-router'
import { MonthlyHeatmap } from '#/components/MonthlyHeatmap'

export const Route = createFileRoute('/heatmap')({ component: MonthlyHeatmap })
