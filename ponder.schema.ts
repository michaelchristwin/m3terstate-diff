import { onchainTable, primaryKey, index, relations } from "ponder";

export const commit = onchainTable(
  "commits",
  (t) => ({
    chainLength: t.bigint().notNull(),
    txHash: t.hex().notNull(),
    blockTime: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    sender: t.hex().notNull(),
  }),
  (table) => ({
    pk: primaryKey({ columns: [table.chainLength, table.txHash] }),
    timeIdx: index().on(table.blockTime),
  }),
);

export const meterState = onchainTable(
  "meter_states",
  (t) => ({
    chainLength: t.bigint().notNull(),
    txHash: t.hex().notNull(),
    meterNo: t.integer().notNull(),
    account: t.bigint().notNull(),
    nonce: t.bigint().notNull(),
  }),
  (table) => ({
    pk: primaryKey({
      columns: [table.chainLength, table.txHash, table.meterNo],
    }),
    meterIdx: index().on(table.meterNo),
  }),
);

export const commitsRelations = relations(commit, ({ many }) => ({
  state: many(meterState),
}));

export const meterStatesRelations = relations(meterState, ({ one }) => ({
  commit: one(commit, {
    fields: [meterState.chainLength, meterState.txHash],
    references: [commit.chainLength, commit.txHash],
  }),
}));
