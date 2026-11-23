import { createFileRoute, Link } from '@tanstack/react-router'
import { AppHeader } from '#/components/AppHeader'
import { ProposalWorkbench } from '#/components/ProposalWorkbench'
import { parseDiffSearch } from '#/diff-selection'

export const Route = createFileRoute('/diff')({
  validateSearch: parseDiffSearch,
  component: ProposalWorkbench,
  errorComponent: () => <>
    <AppHeader page="diff" />
    <main><section className="error" role="alert">
      <h1>Invalid diff link</h1>
      <p>The commit parameter must contain a transaction hash and log index separated by a colon.</p>
      <Link to="/diff" search={{}}>View latest diff</Link>
    </section></main>
  </>,
})
