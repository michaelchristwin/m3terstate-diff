import { client } from '#/client/client.gen'
import { getProposalProposalTxHashGet } from '#/client/sdk.gen'
import { queryOptions } from '@tanstack/react-query'

const M3TERSCAN_API = 'https://m3terscan-api.onrender.com'

client.setConfig({
  baseUrl: M3TERSCAN_API,
})

export const queries = {
  getProposals: (txHash: string) =>
    queryOptions({
      queryKey: ['getProposals', txHash],
      queryFn: () =>
        getProposalProposalTxHashGet({ path: { tx_hash: txHash } }).then(
          (r) => {
            return { state: r.data }
          },
        ),
    }),
  refreshRecentBlocks: () =>
    queryOptions({
      queryKey: ['refreshRecentBlocks'],
      queryFn: async () => {
        const response = await fetch(`${M3TERSCAN_API}/recent-blocks`, {
          method: 'POST',
        })

        return response
      },
    }),
  getRecentBlocks: () =>
    queryOptions({
      queryKey: ['getRecentBlocks'],
      queryFn: async () => {
        const response = await fetch(`${M3TERSCAN_API}/recent-blocks`, {
          method: 'GET',
        })
        const data = await response.json()
        return data as RecentBlocks[]
      },
    }),
}

export type RecentBlocks = {
  block_time: string
  from: string
  hash: string
  transaction_status: boolean
}
