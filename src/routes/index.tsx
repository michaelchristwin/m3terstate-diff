import { queries } from '#/queries/state'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

import { VirtualDiffViewer } from 'virtual-react-json-diff'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  const { data } = useQuery(queries.getRecentBlocks())

  const lastHash = data?.[data.length - 1]?.hash
  const secondToLastHash = data?.[data.length - 2]?.hash

  const { data: diffleft, isSuccess: diff1Success } = useQuery({
    ...queries.getProposals(lastHash!),
    enabled: !!lastHash,
  })
  const { data: diffright, isSuccess: diff2Success } = useQuery({
    ...queries.getProposals(secondToLastHash!),
    enabled: !!secondToLastHash,
  })

  const diffsSuccess = diff1Success && diff2Success
  return (
    <div>
      {diffsSuccess && (
        <VirtualDiffViewer
          oldValue={diffleft}
          newValue={diffright}

          height={800}
          theme="github-dark"
          reviewMode
        />
      )}
    </div>
  )
}
