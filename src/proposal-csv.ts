import { json2csv } from 'json-2-csv'

export const proposalColumns = ['m3ter_no', 'account', 'nonce']

/** Keep API record order and a stable column order across proposals. */
export function proposalToCsv(data: unknown): string {
  if (!Array.isArray(data) || !data.every((row) =>
    row !== null && typeof row === 'object' &&
    typeof row.m3ter_no === 'number' && Number.isFinite(row.m3ter_no) &&
    typeof row.account === 'string' &&
    typeof row.nonce === 'number' && Number.isFinite(row.nonce),
  )) throw new Error('The API returned an invalid state. Expected meter records.')

  // Keep the header for empty proposals so their data rows remain aligned.
  return data.length ? json2csv(data, { keys: proposalColumns }) : proposalColumns.join(',')
}
