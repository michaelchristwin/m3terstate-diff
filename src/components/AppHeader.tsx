import { Link, useSearch } from '@tanstack/react-router'
import { parseHeatmapSearch } from '#/heatmap-selection'

export function AppHeader({ page }: { page: 'diff' | 'heatmap' }) {
  const search = useSearch({ strict: false })
  const heatmap = parseHeatmapSearch(search)
  return <header className="app-header">
    <Link className="brand" to="/" search={heatmap}>
      <span className="mark">≠</span>m3ters<span className="muted"> / </span>{page === 'diff' ? 'Diff' : 'Activity'}
    </Link>
    <nav className="page-nav" aria-label="Main navigation">
      <Link to="/" search={heatmap} aria-current={page === 'heatmap' ? 'page' : undefined}>Heatmap</Link>
      <Link to="/diff" search={page === 'diff' ? search : heatmap} aria-current={page === 'diff' ? 'page' : undefined}>Diff</Link>
    </nav>
  </header>
}
