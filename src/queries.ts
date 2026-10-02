import { client } from "#/client/client.gen";
import { getProposalProposalTxHashGet } from "#/client/sdk.gen";
import { mutationOptions, queryOptions } from "@tanstack/react-query";
import { proposalToCsv } from "#/proposal-csv";
import { createClient } from "@ponder/client";
import * as schema from "../ponder.schema";

export const ponderClient = createClient("https://ponder.m3ter.ing/sql", {
  schema,
});

export const M3TERSCAN_API = "https://m3terscan-api.onrender.com";

client.setConfig({ baseUrl: M3TERSCAN_API });

export type RecentBlocksV1 = {
  block_time: string;
  from: string;
  hash: string;
  transaction_status: boolean;
};
export type RecentBlocksV2 = {
  chainLength: bigint;
  txHash: `0x${string}`;
  blockTime: bigint;
  blockNumber: bigint;
  sender: `0x${string}`;
};

export const queries = {
  getProposals: (txHash: string) =>
    queryOptions({
      queryKey: ["getProposals", txHash],
      staleTime: Infinity,
      queryFn: async ({ signal }) => {
        const response = await getProposalProposalTxHashGet({
          path: { tx_hash: txHash },
          signal,
          throwOnError: true,
        });
        return proposalToCsv(response.data);
      },
    }),

  // POST changes server state, so consume this with useMutation.
  refreshRecentBlocks: () =>
    mutationOptions({
      mutationKey: ["refreshRecentBlocks"],
      mutationFn: async () => {
        const response = await fetch(`${M3TERSCAN_API}/recent-blocks`, {
          method: "POST",
        });
        if (!response.ok)
          throw new Error(`Could not refresh history (${response.status}).`);
        return response;
      },
    }),

  getRecentBlocks: () =>
    queryOptions({
      queryKey: ["getRecentBlocks"],
      staleTime: 60_000,
      queryFn: async ({ signal }): Promise<RecentBlocksV1[]> => {
        const response = await fetch(`${M3TERSCAN_API}/recent-blocks`, {
          signal,
        });
        if (!response.ok)
          throw new Error(`Could not load state history (${response.status}).`);
        const data: unknown = await response.json();
        if (!Array.isArray(data) || !data.every(isRecentBlock)) {
          throw new Error("The API returned an invalid state history.");
        }
        // Preserve API order: oldest first, newest last.
        return data;
      },
    }),
};

function isRecentBlock(value: unknown): value is RecentBlocksV1 {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.hash === "string" &&
    row.hash.length > 0 &&
    typeof row.block_time === "string" &&
    typeof row.from === "string" &&
    typeof row.transaction_status === "boolean"
  );
}
