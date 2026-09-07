import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareInputs, parseRows } from '../src/diff';

test('returns zero-based changes and trailing additions', () => {
  const result = compareInputs('id,name\n1,A\n2,B', 'id,name\n1,Z\n2,B\n3,C');
  assert.deepEqual(result.differentIndices, [1,3]);
  assert.deepEqual(result.counts, { equal: 2, changed: 1, added: 1, removed: 0 });
  assert.equal(result.rows[3].left, null);
});
test('removals and empty inputs', () => {
  assert.equal(compareInputs('a','').rows[0].status, 'removed');
  assert.deepEqual(compareInputs('','').rows, []);
});
test('CSV handles quoted commas, escaped quotes, and multiline fields', () => {
  assert.deepEqual(parseRows('id,note\n1,"a,b\n""quoted"""\n'), [['id','note'], ['1','a,b\n"quoted"']]);
  assert.deepEqual(compareInputs('1,"a"', '1,a').differentIndices, []);
});
test('normalizes BOM and line endings, ignores final terminator, retains blank records', () => {
  assert.deepEqual(compareInputs('\uFEFFa,b\r\n1,2\r\n','a,b\n1,2').differentIndices, []);
  assert.deepEqual(parseRows('a\n\n'), [['a'],['']]);
  assert.deepEqual(parseRows('\n'), [['']]);
});
test('whitespace and missing columns remain significant unless configured', () => {
  assert.deepEqual(compareInputs('a,b','a, b').differentIndices, [0]);
  assert.deepEqual(compareInputs('a,b','a, b', {trim:true}).differentIndices, []);
  assert.deepEqual(compareInputs('a','a,').differentIndices, [0]);
});
test('plain text uses literal equality and physical lines', () => {
  assert.deepEqual(compareInputs('a.*\nx','abc\nx', {mode:'text'}).differentIndices, [0]);
  assert.deepEqual(parseRows('"a\nb"', {mode:'text'}), [['"a'],['b"']]);
});
test('custom delimiters and malformed CSV', () => {
  assert.deepEqual(parseRows('a;b', {delimiter:';'}), [['a','b']]);
  assert.throws(() => parseRows('a,"unfinished'), /quote/i);
  assert.throws(() => parseRows('a', {delimiter:'xx'}), /delimiter/i);
});
test('insertions use positional semantics, including duplicate rows', () => {
  assert.deepEqual(compareInputs('a\nb\nc', 'a\nx\nb\nc').differentIndices, [1,2,3]);
  assert.deepEqual(compareInputs('a\na', 'a\na').differentIndices, []);
});
