import Papa from 'papaparse';

export type Status = 'equal' | 'changed' | 'added' | 'removed';
export interface DiffOptions { mode?: 'csv' | 'text'; delimiter?: string; trim?: boolean }
export interface RowDiff { index: number; status: Status; left: string[] | null; right: string[] | null }
export interface DiffResult { rows: RowDiff[]; differentIndices: number[]; counts: Record<Status, number> }

/** Parse logical CSV records, retaining blank rows but ignoring a final record terminator. */
export function parseRows(input: string, options: DiffOptions = {}): string[][] {
  const text = input.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  if (!text) return [];
  if (options.mode === 'text') return text.replace(/\n$/, '').split('\n').map(line => [line]);
  const delimiter = options.delimiter ?? ',';
  if (delimiter.length !== 1 || /["\r\n\uFEFF]/.test(delimiter)) throw new Error('Choose a single delimiter other than a quote or newline.');
  const parsed = Papa.parse<string[]>(text, { delimiter, skipEmptyLines: false });
  if (parsed.errors.length) throw new Error(parsed.errors.map(e => `${e.message}${e.row === undefined ? '' : ` (record ${e.row + 1})`}`).join('; '));
  if (text.endsWith('\n')) parsed.data.pop();
  return parsed.data;
}

/** Compare records at the same zero-based index. Header records are included. */
export function compareInputs(leftInput: string, rightInput: string, options: DiffOptions = {}): DiffResult {
  const left = parseRows(leftInput, options);
  const right = parseRows(rightInput, options);
  const result: DiffResult = { rows: [], differentIndices: [], counts: { equal: 0, changed: 0, added: 0, removed: 0 } };
  const normalize = (value: string) => options.trim ? value.trim() : value;
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    const a = left[index] ?? null, b = right[index] ?? null;
    const status: Status = a === null ? 'added' : b === null ? 'removed' :
      a.length === b.length && a.every((value, i) => normalize(value) === normalize(b[i])) ? 'equal' : 'changed';
    result.rows.push({ index, status, left: a, right: b });
    result.counts[status]++;
    if (status !== 'equal') result.differentIndices.push(index);
  }
  return result;
}
