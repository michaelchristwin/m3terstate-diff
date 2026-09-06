import { queries } from '#/queries/state'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { VirtualDiffViewer } from 'virtual-react-json-diff'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  const [offsetA, setOffsetA] = useState(1)
  const [offsetB, setOffsetB] = useState(2)

  const { data, isLoading: isLoadingRecentBlocks } = useQuery(
    queries.getRecentBlocks(),
  )

  const lastHash = data?.[data.length - offsetA]?.hash
  const secondToLastHash = data?.[data.length - offsetB]?.hash

  const {
    data: diffRight,
    isSuccess: diff1Success,
    isLoading: isLoadingProposalsA,
  } = useQuery({
    ...queries.getProposals(lastHash!),
    enabled: !!lastHash,
  })
  const {
    data: diffLeft,
    isSuccess: diff2Success,
    isLoading: isLoadingProposalsB,
  } = useQuery({
    ...queries.getProposals(secondToLastHash!),
    enabled: !!secondToLastHash,
  })

  const nextState = () => {
    setOffsetA((v) => v + 1)
    setOffsetB((v) => v + 1)
  }
  const diffsSuccess = diff1Success && diff2Success
  const isLoading =
    isLoadingRecentBlocks || isLoadingProposalsA || isLoadingProposalsB
  return (
    <div className="w-screen h-screen overflow-hidden">
      {diffsSuccess && (
        <div className="w-full h-full relative">
          <VirtualDiffViewer
            oldValue={diffLeft}
            newValue={diffRight}
            leftTitle={`Proposal ${data ? data.length - offsetB : 0}`}
            rightTitle={`Proposal ${data ? data.length - offsetA : 0}`}
            height={window.screen.availHeight}
            theme="github-dark"
            reviewMode
          />
          <button
            type="button"
            onClick={nextState}
            className="absolute right-8 bottom-6 px-3 flex justify-center items-center rounded font-medium z-20 text-gray-800 h-10 bg-white hover:-translate-y-1 transition-all active:scale-95"
          >
            Compare Previous State
          </button>
        </div>
      )}
      {isLoading && (
        <div className="w-full h-full flex justify-center items-center">
          <div className="block w-fit">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="lucide lucide-loader animate-spin mx-auto"
            >
              <path d="M12 2v4" />
              <path d="m16.2 7.8 2.9-2.9" />
              <path d="M18 12h4" />
              <path d="m16.2 16.2 2.9 2.9" />
              <path d="M12 18v4" />
              <path d="m4.9 19.1 2.9-2.9" />
              <path d="M2 12h4" />
              <path d="m4.9 4.9 2.9 2.9" />
            </svg>
            <span className="italic">Loading proposals....</span>
          </div>
        </div>
      )}
    </div>
  )
}
