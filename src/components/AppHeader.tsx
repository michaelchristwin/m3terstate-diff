import { Link } from '@tanstack/react-router'

export function AppHeader({ page }: { page: 'diff' | 'heatmap' }) {
  return <header className="app-header">
    <Link className="brand" to="/">
      <span className="mark">≠</span>m3ters<span className="muted"> / </span>{page === 'diff' ? 'Diff' : 'Activity'}
    </Link>
    <nav className="page-nav" aria-label="Main navigation">
      <Link to="/" aria-current={page === 'diff' ? 'page' : undefined}>Diff</Link>
      <Link to="/heatmap" aria-current={page === 'heatmap' ? 'page' : undefined}>Heatmap</Link>
    </nav>
  </header>
}
